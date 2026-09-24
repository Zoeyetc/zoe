import assert from 'node:assert/strict';
import test from 'node:test';
import { createAnchoredReceiver } from '../apps/zland/src/physics/AnchoredReceiver.ts';
import { createPhysicsWorld } from '../apps/zland/src/physics/PhysicsWorld.ts';
import {
  ROLLER_WAKE_SOURCE_ID,
  ROLLER_WAKE_SPEED_THRESHOLD,
  rollerCoasterRouteForwardToWorld,
  rollerCoasterRoutePointToWorld,
  rollerCoasterToPhysicsWake,
} from '../apps/zland/src/physics/adapters/rollerCoaster.ts';
import type { PhysicsImpact, PhysicsWake } from '../apps/zland/src/physics/types.ts';
import type { RollerCoasterInput } from '../apps/zland/src/rides/roller-coaster/adapter.ts';
import { createRollerCoasterSimulation } from '../apps/zland/src/rides/roller-coaster/simulation.ts';

const input = (overrides: Partial<RollerCoasterInput> = {}): RollerCoasterInput => ({
  structureAvailable: true,
  section: 'phrase-release',
  sectionProgress: 0.5,
  phraseProgress: 0.72,
  energy: 1,
  tension: 0.1,
  transportPlaying: true,
  seek: false,
  restart: false,
  ...overrides,
});

const wake = (overrides: Partial<PhysicsWake> = {}): PhysicsWake => ({
  sourceId: ROLLER_WAKE_SOURCE_ID,
  sourceType: 'wake',
  position: { x: 0.5, y: 0.5 },
  forward: { x: 1, y: 0 },
  speed: 180,
  acceleration: 20,
  strength: 0.7,
  radius: 0.35,
  timestamp: 1,
  active: true,
  ...overrides,
});

const impact: PhysicsImpact = {
  id: 'combined-impact', sourceId: 'bumper-cars', sourceType: 'collision',
  position: { x: 0.42, y: 0.5 }, direction: { x: 1, y: 0 },
  strength: 0.8, radius: 0.4, timestamp: 1,
};

const advance = (simulation: ReturnType<typeof createRollerCoasterSimulation>, seconds: number) => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) simulation.accept(input(), 0.05);
};

test('RollerCoaster registers and updates one continuous PhysicsWorld Force Source', () => {
  const world = createPhysicsWorld();
  const unregister = world.registerSource(ROLLER_WAKE_SOURCE_ID);
  assert.equal(world.read().registeredSources, 1);
  world.updateWake(wake(), 0.05);
  assert.equal(world.read().activeWakeCount, 1);
  assert.equal(world.read().latestWake?.sourceId, ROLLER_WAKE_SOURCE_ID);
  unregister();
  assert.equal(world.read().registeredSources, 0);
  assert.equal(world.read().activeWakeCount, 0);
});

test('source position and direction derive from actual RollerCoaster route pose', () => {
  const simulation = createRollerCoasterSimulation();
  advance(simulation, 4);
  const state = simulation.read();
  const source = rollerCoasterToPhysicsWake(state, 4);
  assert.deepEqual(source.position, rollerCoasterRoutePointToWorld(state.riderPosition));
  assert.deepEqual(source.forward, rollerCoasterRouteForwardToWorld(state.riderForward));
  assert.ok(Math.abs(Math.hypot(source.forward.x, source.forward.y) - 1) < 1e-9);
});

test('custom composition bounds relocate route and wake through the same adapter', () => {
  const bounds = { x: 0.2, y: 0.58, width: 0.36, height: 0.34 };
  const simulation = createRollerCoasterSimulation();
  const state = simulation.read();
  const wake = rollerCoasterToPhysicsWake(state, 1, bounds);
  assert.deepEqual(wake.position, rollerCoasterRoutePointToWorld(state.riderPosition, bounds));
  assert.deepEqual(wake.forward, rollerCoasterRouteForwardToWorld(state.riderForward, bounds));
  assert.ok(wake.position.x >= bounds.x && wake.position.x <= bounds.x + bounds.width);
  assert.ok(wake.position.y >= bounds.y && wake.position.y <= bounds.y + bounds.height);
});

test('wake strength derives from physical speed and not musical energy alone', () => {
  const simulation = createRollerCoasterSimulation();
  const stationary = simulation.read();
  const highEnergyWithoutMotion = { ...stationary, energy: 1, phraseProgress: 0.8 };
  const inactive = rollerCoasterToPhysicsWake(highEnergyWithoutMotion, 0);
  assert.equal(inactive.speed, 0);
  assert.equal(inactive.strength, 0);
  assert.equal(inactive.active, false);

  advance(simulation, 5);
  const moving = rollerCoasterToPhysicsWake(simulation.read(), 5);
  assert.ok(moving.speed > ROLLER_WAKE_SPEED_THRESHOLD);
  assert.ok(moving.strength > 0);
});

test('wake becomes inactive below the physical speed threshold', () => {
  const simulation = createRollerCoasterSimulation();
  const state = simulation.read();
  const below = rollerCoasterToPhysicsWake({ ...state, velocity: ROLLER_WAKE_SPEED_THRESHOLD - 0.01 }, 0);
  assert.equal(below.active, false);
  assert.equal(below.strength, 0);
});

function receiveAt(position: { x: number; y: number }) {
  const world = createPhysicsWorld();
  world.registerSource(ROLLER_WAKE_SOURCE_ID);
  const receiver = createAnchoredReceiver({ position });
  world.registerReceiver(receiver.registration);
  world.updateWake(wake(), 0.08);
  return { world: world.read(), receiver: receiver.read() };
}

test('directional trailing wake distinguishes trailing, front, and side receivers', () => {
  const trailing = receiveAt({ x: 0.35, y: 0.5 });
  const front = receiveAt({ x: 0.65, y: 0.5 });
  const side = receiveAt({ x: 0.5, y: 0.65 });
  assert.ok(Math.hypot(trailing.receiver.latestReceivedForce.x, trailing.receiver.latestReceivedForce.y) > 0);
  assert.equal(Math.hypot(front.receiver.latestReceivedForce.x, front.receiver.latestReceivedForce.y), 0);
  assert.equal(Math.hypot(side.receiver.latestReceivedForce.x, side.receiver.latestReceivedForce.y), 0);
  assert.ok((trailing.world.latestWakeReception?.alignment ?? 0) > (side.world.latestWakeReception?.alignment ?? 0));
});

test('near trailing receiver receives more force and outside-radius receiver receives none', () => {
  const near = receiveAt({ x: 0.42, y: 0.5 }).receiver;
  const far = receiveAt({ x: 0.22, y: 0.5 }).receiver;
  const outside = receiveAt({ x: 0.1, y: 0.5 }).receiver;
  const magnitude = (point: { x: number; y: number }) => Math.hypot(point.x, point.y);
  assert.ok(magnitude(near.latestReceivedForce) > magnitude(far.latestReceivedForce));
  assert.equal(magnitude(outside.latestReceivedForce), 0);
});

test('wake force is bounded and continuous source updates replace stale pose', () => {
  const world = createPhysicsWorld();
  world.registerSource(ROLLER_WAKE_SOURCE_ID);
  const receiver = createAnchoredReceiver({ position: { x: 0.35, y: 0.5 } });
  world.registerReceiver(receiver.registration);
  world.updateWake(wake({ strength: 20 }), 0.1);
  assert.ok(Math.hypot(receiver.read().latestReceivedForce.x, receiver.read().latestReceivedForce.y) <= 1 + 1e-9);
  world.updateWake(wake({ position: { x: 0.7, y: 0.4 }, timestamp: 2 }), 0.1);
  assert.deepEqual(world.read().latestWake?.position, { x: 0.7, y: 0.4 });
  assert.equal(world.read().activeWakeCount, 1);
});

test('restart state deactivates and removes stale wake', () => {
  const world = createPhysicsWorld();
  world.registerSource(ROLLER_WAKE_SOURCE_ID);
  world.updateWake(wake(), 0.05);
  const simulation = createRollerCoasterSimulation();
  advance(simulation, 3);
  simulation.accept(input({ restart: true, seek: true, section: 'station', phraseProgress: 0, energy: 0.08 }), 0);
  world.updateWake(rollerCoasterToPhysicsWake(simulation.read(), 0), 0);
  assert.equal(world.read().activeWakeCount, 0);
  assert.equal(world.read().latestWake?.active, false);
});

test('seek creates no historical receiver force sample', () => {
  const world = createPhysicsWorld();
  world.registerSource(ROLLER_WAKE_SOURCE_ID);
  const receiver = createAnchoredReceiver({ position: { x: 0.35, y: 0.5 } });
  world.registerReceiver(receiver.registration);
  world.updateWake(wake(), 0);
  assert.equal(receiver.read().receivedWakeSamples, 0);
  assert.deepEqual(receiver.read().velocity, { x: 0, y: 0 });
});

test('pause does not disable wake while the coaster retains physical momentum', () => {
  const simulation = createRollerCoasterSimulation();
  advance(simulation, 3);
  simulation.accept(input({ transportPlaying: false }), 0.1);
  assert.ok(simulation.read().velocity > ROLLER_WAKE_SPEED_THRESHOLD);
  assert.equal(rollerCoasterToPhysicsWake(simulation.read(), 3.1).active, true);
});

test('anchored receiver remains bounded, combines impact and wake, then recovers', () => {
  const world = createPhysicsWorld();
  world.registerSource('bumper-cars');
  world.registerSource(ROLLER_WAKE_SOURCE_ID);
  const receiver = createAnchoredReceiver({ position: { x: 0.35, y: 0.5 } });
  world.registerReceiver(receiver.registration);
  world.publishImpact(impact);
  for (let index = 0; index < 20; index += 1) {
    world.updateWake(wake({ timestamp: 1 + index * 0.05 }), 0.05);
    receiver.step(0.05);
    const state = receiver.read();
    assert.ok(Number.isFinite(state.offset.x) && Number.isFinite(state.offset.y));
    assert.ok(state.displacement <= 0.08 + 1e-9);
  }
  assert.equal(receiver.read().receivedImpactCount, 1);
  assert.ok(receiver.read().receivedWakeSamples > 0);
  world.removeWake(ROLLER_WAKE_SOURCE_ID);
  for (let index = 0; index < 200; index += 1) receiver.step(0.05);
  assert.equal(receiver.read().springState, 'settled');
  assert.equal(receiver.read().displacement, 0);
});

test('reduced-motion coaster produces substantially weaker wake from lower physical speed', () => {
  const full = createRollerCoasterSimulation();
  const reduced = createRollerCoasterSimulation({ reducedMotion: true });
  advance(full, 8);
  advance(reduced, 8);
  const fullWake = rollerCoasterToPhysicsWake(full.read(), 8);
  const reducedWake = rollerCoasterToPhysicsWake(reduced.read(), 8);
  assert.ok(reducedWake.speed < fullWake.speed * 0.5);
  assert.ok(reducedWake.strength < fullWake.strength * 0.35);
});
