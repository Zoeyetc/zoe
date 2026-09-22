import assert from 'node:assert/strict';
import test from 'node:test';
import { milestoneTwoBAudioMap } from '../src/audio/AudioMap.ts';
import { createAudioWorld } from '../src/audio/AudioWorld.ts';
import { createAnchoredReceiver } from '../src/physics/AnchoredReceiver.ts';
import { createPhysicsWorld } from '../src/physics/PhysicsWorld.ts';
import { bumperCollisionToWorldImpact } from '../src/physics/adapters/bumperCars.ts';
import type { PhysicsImpact } from '../src/physics/types.ts';
import type { BumperCarsInput } from '../src/rides/bumper-cars/adapter.ts';
import { toBumperCarsInput } from '../src/rides/bumper-cars/adapter.ts';
import {
  BUMPER_SHARED_IMPACT_THRESHOLD,
  createBumperCarsSimulation,
  type BumperBodyState,
  type BumperCollision,
} from '../src/rides/bumper-cars/simulation.ts';

const body = (overrides: Partial<BumperBodyState> = {}): BumperBodyState => ({
  id: 0, x: 100, y: 100, width: 54, height: 34,
  vx: 0, vy: 0, angle: 0, angularVelocity: 0, ...overrides,
});
const quietInput = (playing = true): BumperCarsInput => ({
  percussionAvailable: true, transportPlaying: playing, events: [],
});
const impact = (overrides: Partial<PhysicsImpact> = {}): PhysicsImpact => ({
  id: 'impact-1', sourceId: 'bumper-cars', sourceType: 'collision',
  position: { x: 0.45, y: 0.5 }, direction: { x: 1, y: 0 },
  strength: 0.8, radius: 0.5, timestamp: 1, ...overrides,
});

function collisionAt(speed: number) {
  const simulation = createBumperCarsSimulation({ initialBodies: [
    body({ id: 0, x: 100, y: 100, vx: speed }),
    body({ id: 1, x: 148, y: 104 }),
  ] });
  simulation.accept(quietInput(), 0.02);
  return { simulation, collisions: simulation.drainCollisions() };
}

test('receiver has only a PhysicsWorld registration and percussion alone does not modify it', () => {
  const receiver = createAnchoredReceiver();
  const before = receiver.read();
  const percussionEvent = { type: 'kick', time: 1, id: 'musical-only', strength: 1 } as const;
  assert.equal(percussionEvent.type, 'kick');
  assert.deepEqual(receiver.read(), before);
  assert.equal(typeof receiver.registration.receive, 'function');
});

test('authored timeline reaches receiver only through actual collision and PhysicsWorld', () => {
  const audioWorld = createAudioWorld(milestoneTwoBAudioMap);
  const bumperCars = createBumperCarsSimulation({ seed: 2048 });
  const physicsWorld = createPhysicsWorld();
  const receiver = createAnchoredReceiver();
  physicsWorld.registerSource('bumper-cars');
  physicsWorld.registerReceiver(receiver.registration);
  audioWorld.read({ time: 0, duration: 20, playing: true });
  for (let index = 1; index <= 120; index += 1) {
    const frame = audioWorld.read({ time: index * 0.05, duration: 20, playing: true });
    bumperCars.accept(toBumperCarsInput(frame), 0.05);
    for (const collision of bumperCars.drainCollisions()) {
      physicsWorld.publishImpact(bumperCollisionToWorldImpact(collision, bumperCars.read().arena));
    }
    receiver.step(0.05);
  }
  assert.ok(physicsWorld.read().impactCount > 0);
  assert.equal(receiver.read().receivedImpactCount, physicsWorld.read().impactCount);
});

test('actual BumperCars collision publishes physical geometry and impulse data', () => {
  const { collisions } = collisionAt(70);
  assert.equal(collisions.length, 1);
  const collision = collisions[0];
  assert.ok(collision.impulse >= BUMPER_SHARED_IMPACT_THRESHOLD);
  assert.ok(collision.relativeSpeed > 0);
  assert.ok(collision.point.x > 100 && collision.point.x < 154);
  assert.equal(Math.hypot(collision.normal.x, collision.normal.y), 1);
});

test('world-space impact position derives from collision geometry', () => {
  const collision: BumperCollision = {
    id: 'geometry', bodyA: 0, bodyB: 1, point: { x: 280, y: 70 },
    normal: { x: 1, y: 0 }, relativeSpeed: 40, impulse: 30, time: 2,
  };
  const converted = bumperCollisionToWorldImpact(collision, { width: 560, height: 280 });
  assert.deepEqual(converted.position, { x: 0.5, y: 0.25 });
  assert.equal(converted.direction, collision.normal);
});

test('world impact strength increases with physical collision impulse', () => {
  const slow = collisionAt(30).collisions[0];
  const fast = collisionAt(90).collisions[0];
  assert.ok(slow && fast);
  const slowImpact = bumperCollisionToWorldImpact(slow, { width: 560, height: 280 });
  const fastImpact = bumperCollisionToWorldImpact(fast, { width: 560, height: 280 });
  assert.ok(fastImpact.strength > slowImpact.strength);
});

test('micro-contact below threshold emits no shared collision', () => {
  assert.equal(collisionAt(5).collisions.length, 0);
});

test('persistent overlap does not spam repeated shared impacts', () => {
  const { simulation, collisions } = collisionAt(70);
  assert.equal(collisions.length, 1);
  simulation.accept(quietInput(), 0.01);
  assert.equal(simulation.drainCollisions().length, 0);
});

test('near receiver responds more strongly than a distant receiver', () => {
  const world = createPhysicsWorld();
  world.registerSource('bumper-cars');
  const near = createAnchoredReceiver({ id: 'near', position: { x: 0.5, y: 0.5 } });
  const far = createAnchoredReceiver({ id: 'far', position: { x: 0.75, y: 0.5 } });
  world.registerReceiver(near.registration);
  world.registerReceiver(far.registration);
  world.publishImpact(impact());
  const nearSpeed = Math.hypot(near.read().velocity.x, near.read().velocity.y);
  const farSpeed = Math.hypot(far.read().velocity.x, far.read().velocity.y);
  assert.ok(nearSpeed > farSpeed);
});

test('receiver outside impact radius does not move', () => {
  const world = createPhysicsWorld();
  world.registerSource('bumper-cars');
  const receiver = createAnchoredReceiver({ position: { x: 0.95, y: 0.95 } });
  world.registerReceiver(receiver.registration);
  world.publishImpact(impact({ radius: 0.1 }));
  receiver.step(0.1);
  assert.deepEqual(receiver.read().offset, { x: 0, y: 0 });
  assert.equal(receiver.read().receivedImpactCount, 0);
});

test('receiver displacement and rotation remain bounded', () => {
  const world = createPhysicsWorld();
  world.registerSource('bumper-cars');
  const receiver = createAnchoredReceiver();
  world.registerReceiver(receiver.registration);
  for (let index = 0; index < 20; index += 1) {
    world.publishImpact(impact({ id: `strong-${index}`, strength: 1, position: { x: 0.49, y: 0.49 } }));
    receiver.step(0.05);
  }
  assert.ok(Math.hypot(receiver.read().offset.x, receiver.read().offset.y) <= 0.08 + 1e-9);
  assert.ok(Math.abs(receiver.read().rotation) <= 0.14 + 1e-9);
});

test('receiver spring and damping return it toward its anchor', () => {
  const world = createPhysicsWorld();
  world.registerSource('bumper-cars');
  const receiver = createAnchoredReceiver();
  world.registerReceiver(receiver.registration);
  world.publishImpact(impact());
  receiver.step(0.1);
  const displaced = Math.hypot(receiver.read().offset.x, receiver.read().offset.y);
  for (let index = 0; index < 160; index += 1) receiver.step(0.05);
  assert.ok(Math.hypot(receiver.read().offset.x, receiver.read().offset.y) < displaced);
  assert.equal(receiver.read().active, false);
});

test('paused musical transport does not disable later physical collision', () => {
  const simulation = createBumperCarsSimulation({ initialBodies: [
    body({ id: 0, x: 100, y: 100, vx: 80 }),
    body({ id: 1, x: 158, y: 100 }),
  ] });
  simulation.accept(quietInput(false), 0.1);
  assert.equal(simulation.drainCollisions().length, 1);
});

test('seek does not synthesize collision history', () => {
  const simulation = createBumperCarsSimulation();
  simulation.accept({ ...quietInput(false), events: [{ type: 'seek', from: 2, to: 10 }] }, 0);
  assert.deepEqual(simulation.drainCollisions(), []);
});

test('restart clear restores world and receiver transient state', () => {
  const world = createPhysicsWorld();
  world.registerSource('bumper-cars');
  const receiver = createAnchoredReceiver();
  world.registerReceiver(receiver.registration);
  world.publishImpact(impact());
  receiver.step(0.05);
  assert.equal(world.read().impactCount, 1);
  world.clear();
  receiver.reset();
  assert.equal(world.read().impactCount, 0);
  assert.equal(world.read().latestImpact, null);
  assert.deepEqual(receiver.read().offset, { x: 0, y: 0 });
});

test('reduced motion limits receiver displacement', () => {
  const full = createAnchoredReceiver();
  const reduced = createAnchoredReceiver({ reducedMotion: true });
  full.registration.receive(impact(), 1, 0);
  reduced.registration.receive(impact(), 1, 0);
  full.step(0.1);
  reduced.step(0.1);
  assert.ok(Math.hypot(reduced.read().offset.x, reduced.read().offset.y)
    < Math.hypot(full.read().offset.x, full.read().offset.y) * 0.2);
});
