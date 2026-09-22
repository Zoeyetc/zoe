import assert from 'node:assert/strict';
import test from 'node:test';
import { milestoneOneAudioMap, milestoneTwoBAudioMap } from '../src/audio/AudioMap.ts';
import { createAudioWorld, lookupSnapshot } from '../src/audio/AudioWorld.ts';
import type { AudioFrame } from '../src/audio/types.ts';
import { toFerrisWheelInput, type FerrisWheelInput } from '../src/rides/ferris-wheel/adapter.ts';
import {
  createFerrisWheelSimulation,
  FERRIS_INITIAL_ANGLE,
  FERRIS_MAX_CABIN_SWING,
  FERRIS_MAX_WHEEL_SPEED,
} from '../src/rides/ferris-wheel/simulation.ts';

const input = (overrides: Partial<FerrisWheelInput> = {}): FerrisWheelInput => ({
  harmonyAvailable: true,
  chord: 'C major',
  rootPitchClass: 0,
  pitchClasses: [0, 4, 7],
  confidence: 0.98,
  transportPlaying: true,
  chordChange: null,
  seek: false,
  restart: false,
  ...overrides,
});

const advance = (simulation: ReturnType<typeof createFerrisWheelSimulation>, value: FerrisWheelInput, seconds: number) => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) simulation.accept(value, 0.05);
};

test('FerrisWheel adapter consumes harmony and excludes melody, percussion, and groove', () => {
  const snapshot = lookupSnapshot(milestoneTwoBAudioMap, { time: 2, duration: 20, playing: true });
  const frame: AudioFrame = {
    snapshot,
    events: [
      { type: 'kick', time: 2, id: 'ignored-kick', strength: 1 },
      { type: 'note-on', time: 2, note: milestoneTwoBAudioMap.melody![0] },
    ],
  };
  const adapted = toFerrisWheelInput(frame);
  assert.equal(adapted.chord, 'C major');
  assert.equal('beatPhase' in adapted, false);
  assert.equal('activeNote' in adapted, false);
  assert.equal(adapted.chordChange, null);
});

test('unavailable harmony keeps FerrisWheel musically inactive', () => {
  const snapshot = lookupSnapshot(milestoneOneAudioMap, { time: 2, duration: 12, playing: true });
  const simulation = createFerrisWheelSimulation();
  simulation.accept(toFerrisWheelInput({ snapshot, events: [] }), 0.1);
  assert.equal(simulation.read().mode, 'resting');
  assert.equal(simulation.read().chord, null);
  assert.deepEqual(simulation.read().activeCabinIds, []);
});

test('chord change updates simultaneous carrier targets and sustain preserves them', () => {
  const simulation = createFerrisWheelSimulation();
  simulation.accept(input({ chordChange: {
    type: 'chord-change', time: 0, harmony: milestoneTwoBAudioMap.harmony![0],
  } }), 0.05);
  assert.deepEqual(simulation.read().activeCabinIds, [0, 4, 7]);
  const angle = simulation.read().wheelAngle;
  advance(simulation, input(), 1);
  assert.deepEqual(simulation.read().activeCabinIds, [0, 4, 7]);
  assert.equal(simulation.read().latestChordChange, 'C major');
  assert.ok(simulation.read().wheelAngle !== angle);
});

test('wheel speed and independent cabin swing remain bounded', () => {
  const simulation = createFerrisWheelSimulation();
  advance(simulation, input(), 20);
  assert.ok(simulation.read().wheelAngularVelocity <= FERRIS_MAX_WHEEL_SPEED + 1e-9);
  assert.ok(simulation.read().cabins.every(cabin => Math.abs(cabin.swingAngle) <= FERRIS_MAX_CABIN_SWING + 1e-9));
});

test('cabins remain gravity-oriented while the wheel rotates', () => {
  const simulation = createFerrisWheelSimulation();
  advance(simulation, input(), 8);
  const state = simulation.read();
  assert.ok(Math.abs(state.wheelAngle - FERRIS_INITIAL_ANGLE) > 0.2);
  assert.ok(state.cabins.every(cabin => Math.abs(cabin.worldOrientation) <= FERRIS_MAX_CABIN_SWING + 1e-9));
});

test('chord change does not teleport wheel angle', () => {
  const simulation = createFerrisWheelSimulation();
  advance(simulation, input(), 2);
  const before = simulation.read().wheelAngle;
  simulation.accept(input({
    chord: 'A minor', rootPitchClass: 9, pitchClasses: [9, 0, 4],
    chordChange: { type: 'chord-change', time: 4, harmony: milestoneTwoBAudioMap.harmony![1] },
  }), 0);
  assert.equal(simulation.read().wheelAngle, before);
  assert.deepEqual(simulation.read().activeCabinIds, [0, 4, 9]);
});

test('pause preserves inertia and lets wheel and cabins settle', () => {
  const simulation = createFerrisWheelSimulation();
  advance(simulation, input(), 3);
  const speed = simulation.read().wheelAngularVelocity;
  simulation.accept(input({ transportPlaying: false }), 0.05);
  assert.ok(simulation.read().wheelAngularVelocity > 0);
  advance(simulation, input({ transportPlaying: false }), 8);
  assert.ok(simulation.read().wheelAngularVelocity < speed * 0.1);
  assert.notEqual(simulation.read().mode, 'active');
});

test('seek synchronizes active chord without replay or wheel teleport', () => {
  const world = createAudioWorld(milestoneTwoBAudioMap);
  const simulation = createFerrisWheelSimulation();
  world.read({ time: 1, duration: 20, playing: true });
  advance(simulation, input(), 2);
  const before = simulation.read().wheelAngle;
  const frame = world.synchronize(1, { time: 10, duration: 20, playing: false });
  assert.deepEqual(frame.events.map(event => event.type), ['seek']);
  simulation.accept(toFerrisWheelInput(frame), 0);
  assert.equal(simulation.read().chord, 'F major');
  assert.deepEqual(simulation.read().activeCabinIds, [0, 5, 9]);
  assert.equal(simulation.read().wheelAngle, before);
});

test('restart restores deterministic mechanics and beginning harmony assignment', () => {
  const simulation = createFerrisWheelSimulation();
  advance(simulation, input(), 3);
  simulation.accept(input({ seek: true, restart: true }), 0);
  const state = simulation.read();
  assert.equal(state.wheelAngle, FERRIS_INITIAL_ANGLE);
  assert.equal(state.wheelAngularVelocity, 0);
  assert.ok(state.cabins.every(cabin => cabin.swingAngle === 0 && cabin.swingVelocity === 0));
  assert.deepEqual(state.activeCabinIds, [0, 4, 7]);
});

test('reduced motion preserves harmonic identity without sustained rotation or swing', () => {
  const simulation = createFerrisWheelSimulation({ reducedMotion: true });
  advance(simulation, input(), 5);
  const state = simulation.read();
  assert.equal(state.wheelAngularVelocity, 0);
  assert.equal(state.wheelAngle, FERRIS_INITIAL_ANGLE);
  assert.deepEqual(state.activeCabinIds, [0, 4, 7]);
  assert.ok(state.cabins.every(cabin => cabin.swingAngle === 0));
});
