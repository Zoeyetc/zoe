import type { PercussionKind } from '../../audio/types';
import type { BumperCarsInput } from './adapter';

export type BumperArena = Readonly<{ width: number; height: number }>;
export type BumperBodyState = Readonly<{
  id: number; x: number; y: number; width: number; height: number;
  vx: number; vy: number; angle: number; angularVelocity: number;
}>;
export type BumperCollision = Readonly<{
  id: string;
  bodyA: number;
  bodyB: number;
  point: Readonly<{ x: number; y: number }>;
  normal: Readonly<{ x: number; y: number }>;
  relativeSpeed: number;
  impulse: number;
  time: number;
}>;
export type BumperCarsState = Readonly<{
  status: 'milestone-two-a';
  mode: 'resting' | 'active' | 'settling';
  reducedMotion: boolean;
  seed: number;
  arena: BumperArena;
  bodies: readonly BumperBodyState[];
  latestPercussion: PercussionKind | null;
  eventStrength: number;
  selectedBody: number | null;
  kineticActivity: number;
  collisionCount: number;
  sharedCollisionCount: number;
  latestCollision: BumperCollision | null;
}>;
export type BumperCarsOptions = Readonly<{
  seed?: number;
  reducedMotion?: boolean;
  arena?: BumperArena;
  initialBodies?: readonly BumperBodyState[];
}>;

type MutableBody = { -readonly [K in keyof BumperBodyState]: BumperBodyState[K] };
type PercussionEvent = Extract<BumperCarsInput['events'][number], { type: PercussionKind }>;

export const DEFAULT_BUMPER_ARENA: BumperArena = { width: 560, height: 280 };
export const BUMPER_MAX_SPEED = 160;
export const BUMPER_SHARED_IMPACT_THRESHOLD = 8;
const MAX_ANGULAR_SPEED = 2.2;
const RESTITUTION = 0.58;
const LINEAR_DAMPING = 0.72;
const ANGULAR_DAMPING = 1.8;
const WALL_MARGIN = 6;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => clamp(value, 0, 1);
const bodySpeed = (body: BumperBodyState) => Math.hypot(body.vx, body.vy);

function hashUnit(seed: number, value: string) {
  let hash = seed | 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x45d9f3b);
    hash ^= hash >>> 16;
  }
  return (hash >>> 0) / 0x100000000;
}

export function createInitialBumperBodies(): BumperBodyState[] {
  return [
    [78, 70, -0.08], [222, 74, 0.05], [360, 68, -0.03],
    [482, 84, 0.08], [160, 205, 0.04], [398, 202, -0.06],
  ].map(([x, y, angle], id) => ({
    id, x, y, width: 54, height: 34, vx: 0, vy: 0, angle,
    angularVelocity: 0,
  }));
}

function copyBodies(source: readonly BumperBodyState[]): MutableBody[] {
  return source.map(body => ({ ...body }));
}

function constrainToArena(body: MutableBody, arena: BumperArena) {
  const hx = body.width / 2 + WALL_MARGIN;
  const hy = body.height / 2 + WALL_MARGIN;
  let impact = 0;
  if (body.x < hx) { body.x = hx; if (body.vx < 0) { impact = -body.vx; body.vx *= -RESTITUTION; } }
  if (body.x > arena.width - hx) { body.x = arena.width - hx; if (body.vx > 0) { impact = body.vx; body.vx *= -RESTITUTION; } }
  if (body.y < hy) { body.y = hy; if (body.vy < 0) { impact = -body.vy; body.vy *= -RESTITUTION; } }
  if (body.y > arena.height - hy) { body.y = arena.height - hy; if (body.vy > 0) { impact = body.vy; body.vy *= -RESTITUTION; } }
  if (impact > 0) {
    body.angularVelocity += clamp(impact * 0.008, 0, 0.3) * (body.x < arena.width / 2 ? 1 : -1);
    return 1;
  }
  return 0;
}

/** Legacy AABB behavior: correct overlap, then resolve velocity and restrained spin. */
function collide(a: MutableBody, b: MutableBody, time: number, activeContacts: Set<string>,
  contacts: Set<string>, impacts: BumperCollision[], impactSequence: { value: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const ox = (a.width + b.width) / 2 - Math.abs(dx);
  const oy = (a.height + b.height) / 2 - Math.abs(dy);
  if (ox <= 0 || oy <= 0) return 0;
  const contactId = a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
  contacts.add(contactId);
  const horizontal = ox < oy;
  const nx = horizontal ? (dx >= 0 ? 1 : -1) : 0;
  const ny = horizontal ? 0 : (dy >= 0 ? 1 : -1);
  const overlap = (horizontal ? ox : oy) + 0.02;
  a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5;
  b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;
  const incoming = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (incoming < 0) {
    const impulse = -(1 + RESTITUTION) * incoming * 0.5;
    a.vx -= impulse * nx; a.vy -= impulse * ny;
    b.vx += impulse * nx; b.vy += impulse * ny;
    const offset = horizontal ? dy / ((a.height + b.height) / 2) : -dx / ((a.width + b.width) / 2);
    const spin = clamp(impulse * (Math.abs(offset) > 0.1 ? offset : 0.3) * 0.018, -0.65, 0.65);
    a.angularVelocity -= spin;
    b.angularVelocity += spin;
    if (impulse >= BUMPER_SHARED_IMPACT_THRESHOLD && !activeContacts.has(contactId)) {
      impacts.push({
        id: `bumper-impact-${impactSequence.value++}`,
        bodyA: a.id,
        bodyB: b.id,
        point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        normal: { x: nx, y: ny },
        relativeSpeed: -incoming,
        impulse,
        time,
      });
      activeContacts.add(contactId);
    }
  }
  return 1;
}

function limitBody(body: MutableBody) {
  const speed = bodySpeed(body);
  if (speed > BUMPER_MAX_SPEED) {
    body.vx *= BUMPER_MAX_SPEED / speed;
    body.vy *= BUMPER_MAX_SPEED / speed;
  }
  body.angularVelocity = clamp(body.angularVelocity, -MAX_ANGULAR_SPEED, MAX_ANGULAR_SPEED);
}

function applyPercussion(bodies: MutableBody[], event: PercussionEvent, seed: number, reducedMotion: boolean) {
  const bodyIndex = Math.floor(hashUnit(seed, `${event.id}:body`) * bodies.length) % bodies.length;
  const body = bodies[bodyIndex];
  const strength = clamp01(event.strength);
  const scale = reducedMotion ? 0.18 : 1;
  const randomAngle = hashUnit(seed, `${event.id}:angle`) * Math.PI * 2;
  const centerAngle = Math.atan2(140 - body.y, 280 - body.x);
  let angle = randomAngle;
  let magnitude = 0;
  let angularImpulse = 0;
  if (event.type === 'kick') {
    angle = centerAngle + (hashUnit(seed, `${event.id}:jitter`) - 0.5) * 0.7;
    magnitude = 82 + strength * 58;
    angularImpulse = (hashUnit(seed, `${event.id}:spin`) - 0.5) * 0.32;
  } else if (event.type === 'snare') {
    angle = centerAngle + (hashUnit(seed, `${event.id}:side`) < 0.5 ? -1 : 1) * Math.PI / 2;
    magnitude = 50 + strength * 38;
    angularImpulse = (hashUnit(seed, `${event.id}:spin`) < 0.5 ? -1 : 1) * (0.72 + strength * 0.5);
  } else {
    magnitude = 12 + strength * 18;
    angularImpulse = (hashUnit(seed, `${event.id}:spin`) - 0.5) * 0.34;
  }
  body.vx += Math.cos(angle) * magnitude * scale;
  body.vy += Math.sin(angle) * magnitude * scale;
  body.angularVelocity += angularImpulse * (reducedMotion ? 0.12 : 1);
  limitBody(body);
  return bodyIndex;
}

function activity(bodies: readonly BumperBodyState[]) {
  return bodies.reduce((sum, body) => sum + body.vx ** 2 + body.vy ** 2 + body.angularVelocity ** 2 * 180, 0);
}

/** Actor-local event interpretation and multi-body simulation; no PhysicsWorld dependency. */
export function createBumperCarsSimulation(options: BumperCarsOptions = {}) {
  const seed = options.seed ?? 2048;
  const reducedMotion = options.reducedMotion ?? false;
  const arena = options.arena ?? DEFAULT_BUMPER_ARENA;
  const initialBodies = options.initialBodies ?? createInitialBumperBodies();
  let bodies = copyBodies(initialBodies);
  let latestPercussion: PercussionKind | null = null;
  let eventStrength = 0;
  let selectedBody: number | null = null;
  let collisionCount = 0;
  let sharedCollisionCount = 0;
  let latestCollision: BumperCollision | null = null;
  let pendingCollisions: BumperCollision[] = [];
  let activeContacts = new Set<string>();
  let simulationTime = 0;
  const impactSequence = { value: 0 };
  let mode: BumperCarsState['mode'] = 'resting';

  const reset = () => {
    bodies = copyBodies(initialBodies);
    latestPercussion = null; eventStrength = 0; selectedBody = null;
    collisionCount = 0; sharedCollisionCount = 0; latestCollision = null;
    pendingCollisions = []; activeContacts = new Set(); simulationTime = 0;
    impactSequence.value = 0; mode = 'resting';
  };
  const read = (): BumperCarsState => ({
    status: 'milestone-two-a', mode, reducedMotion, seed, arena,
    bodies: bodies.map(body => ({ ...body })), latestPercussion,
    eventStrength, selectedBody, kineticActivity: activity(bodies), collisionCount,
    sharedCollisionCount, latestCollision,
  });

  return {
    read,
    reset,
    drainCollisions() {
      const result = pendingCollisions;
      pendingCollisions = [];
      return result;
    },
    accept(input: BumperCarsInput, dt: number) {
      if (input.events.some(event => event.type === 'seek' && event.to === 0)) reset();
      const percussion = input.percussionAvailable && input.transportPlaying
        ? input.events.filter((event): event is PercussionEvent =>
          event.type === 'kick' || event.type === 'snare' || event.type === 'hat')
        : [];
      for (const event of percussion) {
        latestPercussion = event.type;
        eventStrength = clamp01(event.strength);
        selectedBody = applyPercussion(bodies, event, seed, reducedMotion);
      }
      const boundedDt = Math.min(0.1, Math.max(0, dt));
      const steps = Math.max(1, Math.ceil(boundedDt * 120));
      const h = boundedDt / steps;
      let collisions = 0;
      const contacts = new Set<string>();
      const impacts: BumperCollision[] = [];
      for (let step = 0; step < steps; step += 1) {
        simulationTime += h;
        for (const body of bodies) { body.x += body.vx * h; body.y += body.vy * h; }
        for (let pass = 0; pass < 4; pass += 1) {
          for (let a = 0; a < bodies.length; a += 1) {
            for (let b = a + 1; b < bodies.length; b += 1) {
              collisions += collide(bodies[a], bodies[b], simulationTime, activeContacts, contacts, impacts, impactSequence);
            }
          }
          for (const body of bodies) collisions += constrainToArena(body, arena);
        }
        for (const body of bodies) {
          body.vx *= Math.exp(-LINEAR_DAMPING * h * (reducedMotion ? 2.5 : 1));
          body.vy *= Math.exp(-LINEAR_DAMPING * h * (reducedMotion ? 2.5 : 1));
          body.angularVelocity *= Math.exp(-ANGULAR_DAMPING * h * (reducedMotion ? 3 : 1));
          body.angle += body.angularVelocity * h;
          limitBody(body);
          if (bodySpeed(body) < 0.04) { body.vx = 0; body.vy = 0; }
          if (Math.abs(body.angularVelocity) < 0.002) body.angularVelocity = 0;
        }
      }
      activeContacts = contacts;
      collisionCount += collisions;
      if (impacts.length) {
        pendingCollisions.push(...impacts);
        sharedCollisionCount += impacts.length;
        latestCollision = impacts.at(-1) ?? latestCollision;
      }
      mode = percussion.length ? 'active' : activity(bodies) > 0.5 ? 'settling' : 'resting';
    },
  };
}
