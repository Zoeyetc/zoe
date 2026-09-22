import assert from 'node:assert/strict';
import test from 'node:test';
import { lookupSnapshot } from '../src/audio/AudioWorld.ts';
import { milestoneSevenAAudioMap } from '../src/audio/AudioMap.ts';
import { toFreeBodiesInput, type FreeBodiesInput } from '../src/free-bodies/adapter.ts';
import { createFreeBodiesSimulation, FREE_BODY_MAX_SPEED } from '../src/free-bodies/simulation.ts';
import { createPhysicsWorld } from '../src/physics/PhysicsWorld.ts';
import type { AudioFrame, AudioEvent } from '../src/audio/types.ts';
import type { PhysicsImpact, PhysicsWake } from '../src/physics/types.ts';

const atmosphere = (overrides: Partial<FreeBodiesInput> = {}): FreeBodiesInput => ({
  spectrumAvailable: true,
  low: 0.3,
  mid: 0.4,
  high: 0.6,
  brightness: 0.7,
  texture: 0.65,
  seek: false,
  restart: false,
  ...overrides,
});

const wake = (overrides: Partial<PhysicsWake> = {}): PhysicsWake => ({
  sourceId: 'roller-coaster', sourceType: 'wake',
  position: { x: 0.5, y: 0.5 }, forward: { x: 1, y: 0 },
  speed: 220, acceleration: 20, strength: 0.8, radius: 0.35,
  timestamp: 1, active: true, ...overrides,
});

const impact: PhysicsImpact = {
  id: 'orb-impact', sourceId: 'bumper-cars', sourceType: 'collision',
  position: { x: 0.5, y: 0.5 }, direction: { x: 1, y: 0 },
  strength: 0.85, radius: 0.3, timestamp: 1,
};

const step = (simulation: ReturnType<typeof createFreeBodiesSimulation>, input = atmosphere(), seconds = 1) => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.025) simulation.accept(input, 0.025);
};

test('Free Bodies consume only authored spectrum atmosphere', () => {
  const snapshot = lookupSnapshot(milestoneSevenAAudioMap, { time: 13, duration: 24, playing: true });
  const base: AudioFrame = { snapshot, events: [] };
  const musicalNoise: readonly AudioEvent[] = [
    { type: 'note-on', time: 13, note: { id: 'ignored', start: 13, end: 14, midi: 72, intensity: 1 } },
    { type: 'chord-change', time: 13, harmony: { id: 'ignored', start: 13, end: 14, chord: 'X', rootPitchClass: 1, pitchClasses: [1], confidence: 1 } },
    { type: 'kick', time: 13, id: 'ignored', strength: 1 },
  ];
  assert.deepEqual(toFreeBodiesInput(base), toFreeBodiesInput({ snapshot, events: musicalNoise }));
  assert.equal(toFreeBodiesInput(base).brightness, snapshot.spectrum.brightness);
  assert.equal(toFreeBodiesInput(base).texture, snapshot.spectrum.texture);
});

test('brightness and texture change forces without assigning position', () => {
  const simulation = createFreeBodiesSimulation({ seed: 4, bodyCount: 1 });
  const initial = simulation.read().bodies[0];
  simulation.accept(atmosphere({ brightness: 1, texture: 1 }), 0);
  assert.deepEqual(simulation.read().bodies[0].position, initial.position);
  simulation.accept(atmosphere({ brightness: 1, texture: 1 }), 0.025);
  assert.ok(Math.hypot(
    simulation.read().bodies[0].atmosphericForce.x,
    simulation.read().bodies[0].atmosphericForce.y,
  ) > 0);
});

test('same seed and input history reproduce continuous turbulence', () => {
  const first = createFreeBodiesSimulation({ seed: 991 });
  const second = createFreeBodiesSimulation({ seed: 991 });
  step(first, atmosphere(), 4);
  step(second, atmosphere(), 4);
  assert.deepEqual(first.read(), second.read());
});

test('body state stays finite, speed bounded, and containment prevents escape', () => {
  const simulation = createFreeBodiesSimulation({
    initialBodies: [{ position: { x: 0.98, y: 0.02 }, velocity: { x: 2, y: -2 }, mass: 0.7 }],
  });
  step(simulation, atmosphere({ brightness: 1, texture: 1 }), 12);
  const body = simulation.read().bodies[0];
  assert.ok(Number.isFinite(body.position.x) && Number.isFinite(body.position.y));
  assert.ok(body.position.x >= body.radius && body.position.x <= 1 - body.radius);
  assert.ok(body.position.y >= body.radius && body.position.y <= 1 - body.radius);
  assert.ok(Math.hypot(body.velocity.x, body.velocity.y) <= FREE_BODY_MAX_SPEED + 1e-9);
});

function worldWithBody(position: { x: number; y: number }) {
  const world = createPhysicsWorld();
  const simulation = createFreeBodiesSimulation({ initialBodies: [{ position, mass: 1 }] });
  for (const registration of simulation.registrations) world.registerReceiver(registration);
  return { world, simulation };
}

test('RollerCoaster wake changes only an in-range trailing body through PhysicsWorld', () => {
  const near = worldWithBody({ x: 0.38, y: 0.5 });
  const outside = worldWithBody({ x: 0.08, y: 0.5 });
  near.world.registerSource('roller-coaster');
  outside.world.registerSource('roller-coaster');
  near.world.updateWake(wake(), 0.05);
  outside.world.updateWake(wake(), 0.05);
  near.simulation.accept(atmosphere({ brightness: 0, texture: 0 }), 0.05);
  outside.simulation.accept(atmosphere({ brightness: 0, texture: 0 }), 0.05);
  assert.ok(Math.abs(near.simulation.read().bodies[0].velocity.x) > 0);
  assert.equal(outside.simulation.read().bodies[0].physicsForce.x, 0);
});

test('real BumperCars impact changes a nearby body while percussion data alone cannot', () => {
  const affected = worldWithBody({ x: 0.44, y: 0.5 });
  affected.world.registerSource('bumper-cars');
  affected.world.publishImpact(impact);
  affected.simulation.accept(atmosphere({ brightness: 0, texture: 0 }), 0.025);
  assert.ok(Math.hypot(
    affected.simulation.read().bodies[0].latestImpactImpulse.x,
    affected.simulation.read().bodies[0].latestImpactImpulse.y,
  ) > 0);

  const unaffected = createFreeBodiesSimulation({ initialBodies: [{ position: { x: 0.44, y: 0.5 } }] });
  unaffected.accept(atmosphere({ brightness: 0, texture: 0 }), 0.025);
  assert.equal(Math.hypot(unaffected.read().bodies[0].latestImpactImpulse.x, unaffected.read().bodies[0].latestImpactImpulse.y), 0);
});

test('atmosphere and PhysicsWorld force compose into one trajectory', () => {
  const { world, simulation } = worldWithBody({ x: 0.38, y: 0.5 });
  world.registerSource('roller-coaster');
  world.updateWake(wake(), 0.05);
  simulation.accept(atmosphere({ brightness: 1, texture: 0.8 }), 0.05);
  const body = simulation.read().bodies[0];
  assert.ok(Math.hypot(body.atmosphericForce.x, body.atmosphericForce.y) > 0);
  assert.ok(Math.hypot(body.physicsForce.x, body.physicsForce.y) > 0);
  assert.ok(Math.hypot(body.combinedForce.x, body.combinedForce.y) > 0);
});

test('pause-style updates retain velocity, seek reconfigures without movement, and restart is deterministic', () => {
  const simulation = createFreeBodiesSimulation({ seed: 71, bodyCount: 2 });
  const initial = simulation.read();
  step(simulation, atmosphere(), 1);
  const beforePause = simulation.read().bodies[0];
  simulation.accept(atmosphere(), 0.05);
  assert.notDeepEqual(simulation.read().bodies[0].position, beforePause.position);
  const beforeSeek = simulation.read().bodies.map(body => body.position);
  simulation.accept(atmosphere({ brightness: 0.1, texture: 0.1, seek: true }), 0);
  assert.deepEqual(simulation.read().bodies.map(body => body.position), beforeSeek);
  simulation.accept(atmosphere({ restart: true, seek: true }), 0);
  assert.deepEqual(simulation.read().bodies.map(body => ({ position: body.position, velocity: body.velocity })),
    initial.bodies.map(body => ({ position: body.position, velocity: body.velocity })));
});

test('reduced motion preserves spectrum identity with substantially less movement', () => {
  const full = createFreeBodiesSimulation({ seed: 8, bodyCount: 3 });
  const reduced = createFreeBodiesSimulation({ seed: 8, bodyCount: 3, reducedMotion: true });
  const fullStart = full.read().bodies.map(body => body.position);
  const reducedStart = reduced.read().bodies.map(body => body.position);
  step(full, atmosphere({ brightness: 1, texture: 1 }), 5);
  step(reduced, atmosphere({ brightness: 1, texture: 1 }), 5);
  const travel = (positions: readonly { x: number; y: number }[], simulation: ReturnType<typeof createFreeBodiesSimulation>) =>
    simulation.read().bodies.reduce((sum, body, index) => sum
      + Math.hypot(body.position.x - positions[index].x, body.position.y - positions[index].y), 0);
  assert.equal(reduced.read().brightness, full.read().brightness);
  assert.equal(reduced.read().texture, full.read().texture);
  assert.ok(travel(reducedStart, reduced) < travel(fullStart, full) * 0.35);
});
