import type {
  PhysicsImpact, PhysicsReceiverRegistration, PhysicsWake, PhysicsWakeReception, WorldPoint,
} from './types';

export type AnchoredReceiverState = Readonly<{
  id: string;
  anchor: WorldPoint;
  worldPosition: WorldPoint;
  offset: WorldPoint;
  displacement: number;
  velocity: WorldPoint;
  rotation: number;
  angularVelocity: number;
  active: boolean;
  springState: 'settled' | 'responding' | 'recovering';
  receivedImpactCount: number;
  latestInfluence: number;
  latestImpactId: string | null;
  latestImpactDistance: number | null;
  latestReceivedImpulse: WorldPoint;
  receivedWakeSamples: number;
  latestWakeSource: string | null;
  latestWakeDistance: number | null;
  latestWakeAlignment: number;
  latestWakeFalloff: number;
  latestReceivedForce: WorldPoint;
}>;
export type AnchoredReceiverOptions = Readonly<{
  id?: string;
  position?: WorldPoint;
  reducedMotion?: boolean;
  stiffness?: number;
  damping?: number;
  maxDisplacement?: number;
  maxRotation?: number;
  /** Temporary manual-QA amplification. Displacement and rotation bounds still apply. */
  debugResponseGain?: number;
}>;

/** Minimal anchored material: collision impulse, bounded response, spring recovery, sleep. */
export function createAnchoredReceiver(options: AnchoredReceiverOptions = {}) {
  const id = options.id ?? 'test-plate';
  let anchor = options.position ?? { x: 0.5, y: 0.5 };
  const reducedMotion = options.reducedMotion ?? false;
  const stiffness = options.stiffness ?? 34;
  const damping = options.damping ?? 9;
  const maxDisplacement = (options.maxDisplacement ?? 0.08) * (reducedMotion ? 0.18 : 1);
  const maxRotation = (options.maxRotation ?? 0.14) * (reducedMotion ? 0.14 : 1);
  const debugResponseGain = Math.max(0, options.debugResponseGain ?? 1);
  let x = 0; let y = 0; let vx = 0; let vy = 0;
  let rotation = 0; let angularVelocity = 0;
  let receivedImpactCount = 0; let latestInfluence = 0;
  let latestImpactId: string | null = null;
  let latestImpactDistance: number | null = null;
  let latestReceivedImpulse: WorldPoint = { x: 0, y: 0 };
  let receivedWakeSamples = 0; let latestWakeSource: string | null = null;
  let latestWakeDistance: number | null = null; let latestWakeAlignment = 0; let latestWakeFalloff = 0;
  let latestReceivedForce: WorldPoint = { x: 0, y: 0 };
  let springState: AnchoredReceiverState['springState'] = 'settled';
  let justReceived = false;
  const active = () => Math.abs(x) + Math.abs(y) + Math.abs(vx) + Math.abs(vy)
    + Math.abs(rotation) + Math.abs(angularVelocity) > 0.0001;
  const reset = () => {
    x = 0; y = 0; vx = 0; vy = 0; rotation = 0; angularVelocity = 0;
    receivedImpactCount = 0; latestInfluence = 0;
    latestImpactId = null; latestImpactDistance = null;
    latestReceivedImpulse = { x: 0, y: 0 };
    receivedWakeSamples = 0; latestWakeSource = null; latestWakeDistance = null;
    latestWakeAlignment = 0; latestWakeFalloff = 0; latestReceivedForce = { x: 0, y: 0 };
    springState = 'settled'; justReceived = false;
  };
  const receiveWake = (wake: PhysicsWake, reception: PhysicsWakeReception, dt: number) => {
    const boundedDt = Math.min(0.1, Math.max(0, dt));
    const responseScale = (reducedMotion ? 0.15 : 1) * debugResponseGain;
    const force = {
      x: reception.force.x * responseScale,
      y: reception.force.y * responseScale,
    };
    vx += force.x * boundedDt * 2.2;
    vy += force.y * boundedDt * 2.2;
    const armX = anchor.x - wake.position.x;
    const armY = anchor.y - wake.position.y;
    angularVelocity += (armX * force.y - armY * force.x) * boundedDt * 3.2;
    receivedWakeSamples += 1;
    latestWakeSource = wake.sourceId;
    latestWakeDistance = reception.distance;
    latestWakeAlignment = reception.alignment;
    latestWakeFalloff = reception.falloff;
    latestReceivedForce = force;
    latestInfluence = reception.falloff;
    springState = 'responding';
    justReceived = true;
  };
  const receive = (impact: PhysicsImpact, influence: number, receiverDistance: number) => {
    const dx = anchor.x - impact.position.x;
    const dy = anchor.y - impact.position.y;
    const distance = Math.hypot(dx, dy);
    const directionLength = Math.hypot(impact.direction.x, impact.direction.y) || 1;
    const radialX = distance > 1e-6 ? dx / distance : impact.direction.x / directionLength;
    const radialY = distance > 1e-6 ? dy / distance : impact.direction.y / directionLength;
    const directionX = impact.direction.x / directionLength;
    const directionY = impact.direction.y / directionLength;
    const scale = impact.strength * influence * (reducedMotion ? 0.15 : 1) * debugResponseGain;
    const impulseX = radialX * 0.8 + directionX * 0.2;
    const impulseY = radialY * 0.8 + directionY * 0.2;
    const receivedImpulse = { x: impulseX * scale * 1.35, y: impulseY * scale * 1.35 };
    vx += receivedImpulse.x;
    vy += receivedImpulse.y;
    angularVelocity += (impulseX * dy - impulseY * dx) * scale * 2.8;
    receivedImpactCount += 1;
    latestInfluence = influence;
    latestImpactId = impact.id;
    latestImpactDistance = receiverDistance;
    latestReceivedImpulse = receivedImpulse;
    springState = 'responding';
    justReceived = true;
  };
  const registration: PhysicsReceiverRegistration = {
    id,
    get position() { return anchor; },
    receive,
    receiveWake,
  };
  const read = (): AnchoredReceiverState => ({
    id, anchor, worldPosition: { x: anchor.x + x, y: anchor.y + y },
    offset: { x, y }, displacement: Math.hypot(x, y),
    velocity: { x: vx, y: vy }, rotation, angularVelocity,
    active: active(), springState, receivedImpactCount, latestInfluence,
    latestImpactId, latestImpactDistance, latestReceivedImpulse,
    receivedWakeSamples, latestWakeSource, latestWakeDistance,
    latestWakeAlignment, latestWakeFalloff, latestReceivedForce,
  });
  return {
    registration, read, reset,
    /** Layout changes replace the recovery anchor without adding response velocity. */
    setAnchor(position: WorldPoint) { anchor = { x: position.x, y: position.y }; },
    step(dt: number) {
      if (!active()) { springState = 'settled'; justReceived = false; return; }
      const boundedDt = Math.min(0.1, Math.max(0, dt));
      const steps = Math.max(1, Math.ceil(boundedDt * 120));
      const h = boundedDt / steps;
      for (let step = 0; step < steps; step += 1) {
        vx += (-stiffness * x - damping * vx) * h;
        vy += (-stiffness * y - damping * vy) * h;
        angularVelocity += (-42 * rotation - 10 * angularVelocity) * h;
        x += vx * h; y += vy * h; rotation += angularVelocity * h;
        const displacement = Math.hypot(x, y);
        if (displacement > maxDisplacement) {
          x *= maxDisplacement / displacement; y *= maxDisplacement / displacement;
          vx *= 0.2; vy *= 0.2;
        }
        if (Math.abs(rotation) > maxRotation) {
          rotation = Math.sign(rotation) * maxRotation;
          angularVelocity *= -0.1;
        }
      }
      if (Math.abs(x) + Math.abs(y) + Math.abs(vx) + Math.abs(vy)
        + Math.abs(rotation) + Math.abs(angularVelocity) < 0.0001) {
        x = 0; y = 0; vx = 0; vy = 0; rotation = 0; angularVelocity = 0;
        springState = 'settled';
        justReceived = false;
      } else if (justReceived) {
        springState = 'responding';
        justReceived = false;
      } else {
        springState = 'recovering';
      }
    },
  };
}
