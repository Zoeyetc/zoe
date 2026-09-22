import type { PhysicsImpact, PhysicsReceiverRegistration, PhysicsWake, PhysicsWakeReception, WorldPoint } from '../physics/types';
import type { FreeBodiesInput } from './adapter';

export const FREE_BODIES_SEED = 7301;
export const FREE_BODY_COUNT = 8;
export const FREE_BODY_MAX_SPEED = 0.34;

export type FreeBodyState = Readonly<{
  id: string;
  position: WorldPoint;
  velocity: WorldPoint;
  mass: number;
  drag: number;
  radius: number;
  atmosphericForce: WorldPoint;
  physicsForce: WorldPoint;
  combinedForce: WorldPoint;
  latestImpactImpulse: WorldPoint;
  latestWakeSource: string | null;
  active: boolean;
  sleeping: boolean;
}>;

export type FreeBodiesState = Readonly<{
  status: 'milestone-seven-a';
  seed: number;
  reducedMotion: boolean;
  spectrumAvailable: boolean;
  brightness: number;
  texture: number;
  averageSpeed: number;
  maxSpeed: number;
  activeCount: number;
  sleepingCount: number;
  selectedBodyId: string;
  bodies: readonly FreeBodyState[];
}>;

type MutableBody = {
  id: string;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  mass: number;
  drag: number;
  radius: number;
  phaseX: number;
  phaseY: number;
  frequencyX: number;
  frequencyY: number;
  atmosphericForce: { x: number; y: number };
  physicsForce: { x: number; y: number };
  combinedForce: { x: number; y: number };
  pendingWakeForce: { x: number; y: number };
  pendingImpactImpulse: { x: number; y: number };
  latestImpactImpulse: { x: number; y: number };
  latestWakeSource: string | null;
  sleeping: boolean;
};

type InitialBody = Readonly<{ position: WorldPoint; velocity?: WorldPoint; mass?: number }>;
type FreeBodiesOptions = Readonly<{
  seed?: number;
  bodyCount?: number;
  reducedMotion?: boolean;
  initialBodies?: readonly InitialBody[];
}>;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const zero = () => ({ x: 0, y: 0 });
const magnitude = (point: WorldPoint) => Math.hypot(point.x, point.y);

function seeded(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function createInitialBodies(seed: number, count: number, supplied?: readonly InitialBody[]): MutableBody[] {
  const random = seeded(seed);
  return Array.from({ length: supplied?.length ?? count }, (_, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4) % 2;
    const initial = supplied?.[index];
    return {
      id: `orb-${index + 1}`,
      position: initial ? { ...initial.position } : {
        x: 0.2 + column * 0.2 + (random() - 0.5) * 0.06,
        y: 0.32 + row * 0.43 + (random() - 0.5) * 0.06,
      },
      velocity: initial?.velocity ? { ...initial.velocity } : zero(),
      mass: initial?.mass ?? 0.72 + random() * 0.58,
      drag: 1.15 + random() * 0.65,
      radius: 0.018 + random() * 0.01,
      phaseX: random() * Math.PI * 2,
      phaseY: random() * Math.PI * 2,
      frequencyX: 0.55 + random() * 0.42,
      frequencyY: 0.48 + random() * 0.38,
      atmosphericForce: zero(), physicsForce: zero(), combinedForce: zero(),
      pendingWakeForce: zero(), pendingImpactImpulse: zero(), latestImpactImpulse: zero(),
      latestWakeSource: null,
      sleeping: false,
    };
  });
}

/** Small actor-local free-body system in canonical PhysicsWorld normalized coordinates. */
export function createFreeBodiesSimulation(options: FreeBodiesOptions = {}) {
  const seed = options.seed ?? FREE_BODIES_SEED;
  const reducedMotion = options.reducedMotion ?? false;
  let bodies = createInitialBodies(seed, options.bodyCount ?? FREE_BODY_COUNT, options.initialBodies);
  let fieldTime = 0;
  let spectrumAvailable = false;
  let brightness = 0;
  let texture = 0;

  const registrations: PhysicsReceiverRegistration[] = bodies.map(body => ({
    id: `free-body:${body.id}`,
    roles: ['receiver', 'dynamic-body'],
    get position() { return body.position; },
    receive(impact: PhysicsImpact, influence: number, distance: number) {
      if (influence <= 0) return;
      const dx = body.position.x - impact.position.x;
      const dy = body.position.y - impact.position.y;
      const length = Math.hypot(dx, dy);
      const direction = length > 1e-8
        ? { x: dx / length, y: dy / length }
        : impact.direction;
      const scale = impact.strength * influence * (reducedMotion ? 0.018 : 0.12) / body.mass;
      body.pendingImpactImpulse.x += direction.x * scale;
      body.pendingImpactImpulse.y += direction.y * scale;
      body.latestImpactImpulse = { x: direction.x * scale, y: direction.y * scale };
      body.sleeping = false;
      void distance;
    },
    receiveWake(wake: PhysicsWake, reception: PhysicsWakeReception) {
      const scale = (reducedMotion ? 0.12 : 0.72) / body.mass;
      body.pendingWakeForce.x += reception.force.x * scale;
      body.pendingWakeForce.y += reception.force.y * scale;
      body.latestWakeSource = wake.sourceId;
      if (reception.falloff > 0) body.sleeping = false;
    },
  }));

  const reset = () => {
    const resetBodies = createInitialBodies(seed, options.bodyCount ?? FREE_BODY_COUNT, options.initialBodies);
    bodies.forEach((body, index) => Object.assign(body, resetBodies[index]));
    fieldTime = 0;
  };

  const integrateStep = (body: MutableBody, step: number, applyImpulse: boolean) => {
    const motionScale = reducedMotion ? 0.12 : 1;
    const turbulence = texture * 0.075 * motionScale;
    const atmosphericForce = spectrumAvailable ? {
      x: Math.sin(fieldTime * body.frequencyX + body.phaseX) * turbulence,
      y: -brightness * 0.055 * motionScale
        + Math.cos(fieldTime * body.frequencyY + body.phaseY) * turbulence * 0.72,
    } : zero();
    const margin = body.radius + 0.04;
    const containment = { x: 0, y: 0 };
    const stiffness = reducedMotion ? 0.8 : 1.8;
    if (body.position.x < margin) containment.x += (margin - body.position.x) * stiffness;
    if (body.position.x > 1 - margin) containment.x -= (body.position.x - (1 - margin)) * stiffness;
    if (body.position.y < margin) containment.y += (margin - body.position.y) * stiffness;
    if (body.position.y > 1 - margin) containment.y -= (body.position.y - (1 - margin)) * stiffness;
    const physicsForce = { ...body.pendingWakeForce };
    const combinedForce = {
      x: atmosphericForce.x + physicsForce.x + containment.x - body.velocity.x * body.drag,
      y: atmosphericForce.y + physicsForce.y + containment.y - body.velocity.y * body.drag,
    };
    body.velocity.x += (combinedForce.x / body.mass) * step + (applyImpulse ? body.pendingImpactImpulse.x : 0);
    body.velocity.y += (combinedForce.y / body.mass) * step + (applyImpulse ? body.pendingImpactImpulse.y : 0);
    const maxSpeed = reducedMotion ? FREE_BODY_MAX_SPEED * 0.16 : FREE_BODY_MAX_SPEED;
    const speed = magnitude(body.velocity);
    if (speed > maxSpeed) {
      body.velocity.x *= maxSpeed / speed;
      body.velocity.y *= maxSpeed / speed;
    }
    body.position.x += body.velocity.x * step;
    body.position.y += body.velocity.y * step;
    const min = body.radius;
    const max = 1 - body.radius;
    if (body.position.x < min || body.position.x > max) {
      body.position.x = Math.min(max, Math.max(min, body.position.x));
      body.velocity.x *= -0.28;
    }
    if (body.position.y < min || body.position.y > max) {
      body.position.y = Math.min(max, Math.max(min, body.position.y));
      body.velocity.y *= -0.28;
    }
    body.atmosphericForce = atmosphericForce;
    body.physicsForce = physicsForce;
    body.combinedForce = combinedForce;
    body.sleeping = magnitude(body.velocity) < 0.0025
      && magnitude(atmosphericForce) < 0.0025 && magnitude(physicsForce) < 0.0025;
  };

  const read = (): FreeBodiesState => {
    const states = bodies.map(body => ({
      id: body.id, position: { ...body.position }, velocity: { ...body.velocity },
      mass: body.mass, drag: body.drag, radius: body.radius,
      atmosphericForce: { ...body.atmosphericForce }, physicsForce: { ...body.physicsForce },
      combinedForce: { ...body.combinedForce }, latestImpactImpulse: { ...body.latestImpactImpulse },
      latestWakeSource: body.latestWakeSource,
      active: !body.sleeping, sleeping: body.sleeping,
    }));
    const speeds = states.map(body => magnitude(body.velocity));
    const sleepingCount = states.filter(body => body.sleeping).length;
    return {
      status: 'milestone-seven-a', seed, reducedMotion, spectrumAvailable,
      brightness, texture,
      averageSpeed: speeds.reduce((sum, speed) => sum + speed, 0) / Math.max(1, speeds.length),
      maxSpeed: Math.max(0, ...speeds), activeCount: states.length - sleepingCount, sleepingCount,
      selectedBodyId: states[0]?.id ?? '—', bodies: states,
    };
  };

  return {
    registrations,
    read,
    reset,
    accept(input: FreeBodiesInput, dt: number) {
      spectrumAvailable = input.spectrumAvailable;
      brightness = clamp01(input.brightness);
      texture = clamp01(input.texture);
      if (input.restart) { reset(); return; }
      if (input.seek || dt <= 0) return;
      const boundedDt = Math.min(0.1, Math.max(0, dt));
      const steps = Math.max(1, Math.ceil(boundedDt / 0.025));
      const step = boundedDt / steps;
      for (let index = 0; index < steps; index += 1) {
        fieldTime += step;
        for (const body of bodies) integrateStep(body, step, index === 0);
      }
      for (const body of bodies) {
        body.pendingWakeForce = zero();
        body.pendingImpactImpulse = zero();
      }
    },
  };
}
