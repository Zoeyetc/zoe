import assert from 'node:assert/strict';
import test from 'node:test';
import { milestoneOneAudioMap, milestoneSixAAudioMap } from '../src/audio/AudioMap.ts';
import { lookupSnapshot } from '../src/audio/AudioWorld.ts';
import type { AudioFrame } from '../src/audio/types.ts';
import { toRollerCoasterInput, type RollerCoasterInput } from '../src/rides/roller-coaster/adapter.ts';
import { dot, magnitude, sub } from '../src/rides/roller-coaster/geometry.ts';
import { composeRollerCoasterRoute, sampleRoute } from '../src/rides/roller-coaster/route.ts';
import {
  createRollerCoasterSimulation,
  ROLLER_MAX_ACCELERATION,
  ROLLER_MAX_VELOCITY,
  ROLLER_REDUCED_MAX_VELOCITY,
} from '../src/rides/roller-coaster/simulation.ts';

const input = (overrides: Partial<RollerCoasterInput> = {}): RollerCoasterInput => ({
  structureAvailable: true,
  section: 'development',
  sectionProgress: 0.5,
  phraseProgress: 0.25,
  energy: 0.55,
  tension: 0.25,
  transportPlaying: true,
  seek: false,
  restart: false,
  ...overrides,
});

const advance = (
  simulation: ReturnType<typeof createRollerCoasterSimulation>,
  value: RollerCoasterInput,
  seconds: number,
) => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) simulation.accept(value, 0.05);
};

test('RollerCoaster adapter consumes structure phrase semantics and excludes local musical domains', () => {
  const snapshot = lookupSnapshot(milestoneSixAAudioMap, { time: 10, duration: 24, playing: true });
  const frame: AudioFrame = {
    snapshot,
    events: [
      { type: 'kick', time: 10, id: 'ignored', strength: 1 },
      { type: 'note-on', time: 10, note: milestoneSixAAudioMap.melody![0] },
      { type: 'chord-change', time: 10, harmony: milestoneSixAAudioMap.harmony![2] },
    ],
  };
  const adapted = toRollerCoasterInput(frame);
  assert.equal(adapted.section, 'tension-rise');
  assert.ok(adapted.phraseProgress > 0.34);
  assert.equal('activeNote' in adapted, false);
  assert.equal('groove' in adapted, false);
  assert.equal('chord' in adapted, false);
});

test('unavailable structure keeps RollerCoaster at its station', () => {
  const snapshot = lookupSnapshot(milestoneOneAudioMap, { time: 6, duration: 12, playing: true });
  const simulation = createRollerCoasterSimulation();
  simulation.accept(toRollerCoasterInput({ snapshot, events: [] }), 0.1);
  assert.equal(simulation.read().mode, 'station');
  assert.equal(simulation.read().routeDistance, 0);
  assert.equal(simulation.read().velocity, 0);
});

test('energy changes actor drive without assigning velocity directly', () => {
  const low = createRollerCoasterSimulation();
  const high = createRollerCoasterSimulation();
  low.accept(input({ energy: 0.2 }), 0.05);
  high.accept(input({ energy: 0.9 }), 0.05);
  assert.ok(high.read().driveTarget > low.read().driveTarget);
  assert.ok(high.read().velocity < high.read().driveTarget);
  assert.notEqual(high.read().velocity, 0.9 * ROLLER_MAX_VELOCITY);
});

test('phrase progress does not directly assign route distance', () => {
  const early = createRollerCoasterSimulation();
  const late = createRollerCoasterSimulation();
  early.accept(input({ phraseProgress: 0.1, seek: true }), 0);
  late.accept(input({ phraseProgress: 0.9, seek: true }), 0);
  assert.equal(early.read().routeDistance, 0);
  assert.equal(late.read().routeDistance, 0);
});

test('tension restrains lift drive without globally freezing route physics', () => {
  const low = createRollerCoasterSimulation();
  const high = createRollerCoasterSimulation();
  const launch = input({ energy: 0.75, tension: 0 });
  for (let index = 0; index < 500 && low.read().currentSegment !== 'Lift'; index += 1) {
    low.accept(launch, 0.05);
    high.accept(launch, 0.05);
  }
  low.accept(launch, 0.1);
  high.accept({ ...launch, tension: 1, section: 'crest' }, 0.1);
  assert.equal(high.read().currentSegment, 'Lift');
  assert.ok(high.read().driveTarget < low.read().driveTarget);
  const before = high.read().routeDistance;
  high.accept({ ...launch, tension: 1, section: 'crest' }, 0.1);
  assert.ok(high.read().routeDistance > before);
});

test('continuous phrase release opens drive conditions without requiring a drop event', () => {
  const constrained = createRollerCoasterSimulation();
  const released = createRollerCoasterSimulation();
  advance(constrained, input({ energy: 0.65, tension: 0.9, section: 'crest' }), 1);
  advance(released, input({ energy: 0.65, tension: 0.9, section: 'crest' }), 1);
  constrained.accept(input({ energy: 0.9, tension: 0.2, section: 'development' }), 0.05);
  released.accept(input({ energy: 0.9, tension: 0.2, section: 'phrase-release' }), 0.05);
  assert.ok(released.read().driveTarget > constrained.read().driveTarget);
  assert.equal(released.read().releaseActive, true);
});

test('route sampling and piece transitions remain continuous and finite', () => {
  const route = composeRollerCoasterRoute();
  for (const piece of route.pieces) {
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      const frame = sampleRoute(route, piece.start + piece.geometry.length * fraction);
      for (const value of Object.values(frame.position)) assert.ok(Number.isFinite(value));
      assert.ok(Math.abs(magnitude(frame.forward) - 1) < 1e-6);
      assert.ok(Math.abs(dot(frame.forward, frame.up)) < 1e-5);
    }
  }
  for (let index = 0; index < route.pieces.length - 1; index += 1) {
    const current = route.pieces[index];
    const next = route.pieces[index + 1];
    assert.ok(magnitude(sub(current.geometry.samplePosition(current.geometry.length), next.geometry.samplePosition(0))) < 1e-6);
    assert.ok(dot(current.geometry.sampleTangent(current.geometry.length), next.geometry.sampleTangent(0)) > 0.995);
  }
});

test('normal playback keeps distance continuous and velocity and acceleration bounded', () => {
  const simulation = createRollerCoasterSimulation();
  let previous = 0;
  for (let index = 0; index < 600; index += 1) {
    simulation.accept(input({ energy: 0.9, tension: 0.2, section: 'phrase-release' }), 0.05);
    const state = simulation.read();
    assert.ok(state.routeDistance >= previous);
    assert.ok(state.routeDistance - previous <= ROLLER_MAX_VELOCITY * 0.05 + 1e-6);
    assert.ok(state.velocity <= ROLLER_MAX_VELOCITY + 1e-9);
    assert.ok(Math.abs(state.acceleration) <= ROLLER_MAX_ACCELERATION + 1e-9);
    previous = state.routeDistance;
  }
});

test('pause removes musical drive while preserving inertia and gravity descent', () => {
  const driven = createRollerCoasterSimulation();
  advance(driven, input({ energy: 0.7 }), 2);
  const drivenBefore = driven.read().routeDistance;
  driven.accept(input({ energy: 0.7, transportPlaying: false }), 0.1);
  assert.equal(driven.read().driveTarget, 0);
  assert.ok(driven.read().routeDistance > drivenBefore);

  const gravity = createRollerCoasterSimulation();
  for (let index = 0; index < 1200 && gravity.read().currentSegment !== 'Drop'; index += 1) {
    gravity.accept(input({ energy: 1, tension: 0 }), 0.05);
  }
  assert.equal(gravity.read().currentSegment, 'Drop');
  const gravityBefore = gravity.read().routeDistance;
  gravity.accept(input({ energy: 1, tension: 0, transportPlaying: false }), 0.1);
  assert.ok(gravity.read().routeDistance > gravityBefore);
});

test('seek preserves physical route state and does not replay skipped phrase history', () => {
  const simulation = createRollerCoasterSimulation();
  advance(simulation, input({ energy: 0.65 }), 3);
  const distance = simulation.read().routeDistance;
  const velocity = simulation.read().velocity;
  simulation.accept(input({ phraseProgress: 0.8, section: 'phrase-release', seek: true }), 0);
  assert.equal(simulation.read().routeDistance, distance);
  assert.equal(simulation.read().velocity, velocity);
  assert.equal(simulation.read().latestRelease, 'phrase-release');
});

test('restart restores deterministic station state', () => {
  const simulation = createRollerCoasterSimulation();
  advance(simulation, input({ energy: 0.8 }), 4);
  simulation.accept(input({ restart: true, seek: true, section: 'station', phraseProgress: 0, energy: 0.08 }), 0);
  assert.equal(simulation.read().mode, 'station');
  assert.equal(simulation.read().currentSegment, 'Station');
  assert.equal(simulation.read().routeDistance, 0);
  assert.equal(simulation.read().velocity, 0);
});

test('reduced motion substantially limits high-speed traversal', () => {
  const full = createRollerCoasterSimulation();
  const reduced = createRollerCoasterSimulation({ reducedMotion: true });
  const release = input({ energy: 1, tension: 0, section: 'phrase-release' });
  advance(full, release, 8);
  advance(reduced, release, 8);
  assert.ok(reduced.read().velocity <= ROLLER_REDUCED_MAX_VELOCITY + 1e-9);
  assert.ok(reduced.read().routeDistance < full.read().routeDistance * 0.5);
});
