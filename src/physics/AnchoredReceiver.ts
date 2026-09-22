import type { PhysicsImpact, PhysicsReceiverRegistration, WorldPoint } from './types';

export type AnchoredReceiverState = Readonly<{
  id: string;
  anchor: WorldPoint;
  offset: WorldPoint;
  velocity: WorldPoint;
  rotation: number;
  angularVelocity: number;
  active: boolean;
  receivedImpactCount: number;
  latestInfluence: number;
}>;
export type AnchoredReceiverOptions = Readonly<{
  id?: string;
  position?: WorldPoint;
  reducedMotion?: boolean;
  stiffness?: number;
  damping?: number;
  maxDisplacement?: number;
  maxRotation?: number;
}>;

/** Minimal anchored material: collision impulse, bounded response, spring recovery, sleep. */
export function createAnchoredReceiver(options: AnchoredReceiverOptions = {}) {
  const id = options.id ?? 'test-plate';
  const anchor = options.position ?? { x: 0.5, y: 0.5 };
  const reducedMotion = options.reducedMotion ?? false;
  const stiffness = options.stiffness ?? 34;
  const damping = options.damping ?? 9;
  const maxDisplacement = (options.maxDisplacement ?? 0.08) * (reducedMotion ? 0.18 : 1);
  const maxRotation = (options.maxRotation ?? 0.14) * (reducedMotion ? 0.14 : 1);
  let x = 0; let y = 0; let vx = 0; let vy = 0;
  let rotation = 0; let angularVelocity = 0;
  let receivedImpactCount = 0; let latestInfluence = 0;
  const active = () => Math.abs(x) + Math.abs(y) + Math.abs(vx) + Math.abs(vy)
    + Math.abs(rotation) + Math.abs(angularVelocity) > 0.0001;
  const reset = () => {
    x = 0; y = 0; vx = 0; vy = 0; rotation = 0; angularVelocity = 0;
    receivedImpactCount = 0; latestInfluence = 0;
  };
  const receive = (impact: PhysicsImpact, influence: number) => {
    const dx = anchor.x - impact.position.x;
    const dy = anchor.y - impact.position.y;
    const distance = Math.hypot(dx, dy);
    const directionLength = Math.hypot(impact.direction.x, impact.direction.y) || 1;
    const radialX = distance > 1e-6 ? dx / distance : impact.direction.x / directionLength;
    const radialY = distance > 1e-6 ? dy / distance : impact.direction.y / directionLength;
    const directionX = impact.direction.x / directionLength;
    const directionY = impact.direction.y / directionLength;
    const scale = impact.strength * influence * (reducedMotion ? 0.15 : 1);
    const impulseX = radialX * 0.8 + directionX * 0.2;
    const impulseY = radialY * 0.8 + directionY * 0.2;
    vx += impulseX * scale * 1.35;
    vy += impulseY * scale * 1.35;
    angularVelocity += (impulseX * dy - impulseY * dx) * scale * 2.8;
    receivedImpactCount += 1;
    latestInfluence = influence;
  };
  const registration: PhysicsReceiverRegistration = { id, position: anchor, receive };
  const read = (): AnchoredReceiverState => ({
    id, anchor, offset: { x, y }, velocity: { x: vx, y: vy }, rotation,
    angularVelocity, active: active(), receivedImpactCount, latestInfluence,
  });
  return {
    registration, read, reset,
    step(dt: number) {
      if (!active()) return;
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
      }
    },
  };
}
