import assert from 'node:assert/strict';
import test from 'node:test';
import { milestoneOneZlandAudioMap, milestoneTwoBZlandAudioMap } from '../apps/zland/src/audio/ZlandAudioMaps.ts';
import { createAudioWorld, lookupSnapshot } from '../apps/zland/src/audio/AudioWorld.ts';
import type { TonalCenterSegment } from '@computational-listening/engine';
import type { AudioFrame } from '../apps/zland/src/audio/types.ts';
import { toFerrisWheelInput, type FerrisWheelInput } from '../apps/zland/src/rides/ferris-wheel/adapter.ts';
import {
  FERRIS_BOARDING_ANGLE,
  FERRIS_FIFTH_STEP,
  FERRIS_FIFTHS_PITCH_CLASSES,
  canonicalTonicTargetAngle,
  fifthsIndexForPitchClass,
  nearestContinuousTonicTarget,
  pitchClassAtFifthsIndex,
} from '../apps/zland/src/rides/ferris-wheel/circleOfFifths.ts';
import {
  createFerrisWheelSimulation,
  FERRIS_INITIAL_ANGLE,
  FERRIS_MAX_CABIN_SWING,
  FERRIS_MAX_WHEEL_ACCELERATION,
  FERRIS_MAX_WHEEL_SPEED,
} from '../apps/zland/src/rides/ferris-wheel/simulation.ts';

const input = (overrides: Partial<FerrisWheelInput> = {}): FerrisWheelInput => ({
  harmonyAvailable: true,
  chord: 'C major',
  rootPitchClass: 0,
  pitchClasses: [0, 4, 7],
  confidence: 0.98,
  tonalCenterAvailable: true,
  tonalCenterLabel: 'C major',
  tonicPitchClass: 0,
  tonalMode: 'major',
  tonalConfidence: 0.9,
  circleOfFifthsIndex: 0,
  transportPlaying: true,
  chordChange: null,
  tonalCenterChange: null,
  seek: false,
  restart: false,
  ...overrides,
});

const advance = (simulation: ReturnType<typeof createFerrisWheelSimulation>, value: FerrisWheelInput, seconds: number) => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) simulation.accept(value, 0.05);
};

const tonalSegment = (rootPitchClass: number, label: string): TonalCenterSegment => ({
  id: `tonal-${rootPitchClass}`, start: 2, end: 8, rootPitchClass, mode: 'major', label,
  confidence: 0.9, circleOfFifthsIndex: fifthsIndexForPitchClass(rootPitchClass), distanceFromPrevious: 1,
});

test('circle-of-fifths display order and forward/inverse mappings are exact', () => {
  assert.deepEqual([...FERRIS_FIFTHS_PITCH_CLASSES], [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]);
  assert.deepEqual(FERRIS_FIFTHS_PITCH_CLASSES.map(fifthsIndexForPitchClass), [...Array(12).keys()]);
  assert.deepEqual([...Array(12).keys()].map(pitchClassAtFifthsIndex), [...FERRIS_FIFTHS_PITCH_CLASSES]);
});

test('tonic target mapping uses the bottom boarding convention', () => {
  assert.equal(canonicalTonicTargetAngle(0), FERRIS_BOARDING_ANGLE);
  assert.equal(canonicalTonicTargetAngle(7), FERRIS_BOARDING_ANGLE - FERRIS_FIFTH_STEP);
  assert.equal(canonicalTonicTargetAngle(5), FERRIS_BOARDING_ANGLE - 11 * FERRIS_FIFTH_STEP);
});

test('nearest continuous targets select adjacent G and wrapped F movements from C', () => {
  assert.ok(Math.abs(nearestContinuousTonicTarget(FERRIS_BOARDING_ANGLE, 7)
    - (FERRIS_BOARDING_ANGLE - FERRIS_FIFTH_STEP)) < 1e-12);
  assert.ok(Math.abs(nearestContinuousTonicTarget(FERRIS_BOARDING_ANGLE, 5)
    - (FERRIS_BOARDING_ANGLE + FERRIS_FIFTH_STEP)) < 1e-12);
  assert.ok(Math.abs(nearestContinuousTonicTarget(FERRIS_BOARDING_ANGLE, 6)
    - (FERRIS_BOARDING_ANGLE + Math.PI)) < 1e-12);
});

test('FerrisWheel adapter consumes harmony and tonal center while excluding other actor domains', () => {
  const base = lookupSnapshot(milestoneTwoBZlandAudioMap, { time: 2, duration: 20, playing: true });
  const segment = tonalSegment(7, 'G major');
  const frame: AudioFrame = {
    snapshot: { ...base, tonalCenter: { available: true, rootPitchClass: 7, mode: 'major', label: 'G major',
      confidence: 0.9, segmentProgress: 0, circleOfFifthsIndex: 1, distanceFromPrevious: 1 } },
    events: [
      { type: 'kick', time: 2, id: 'ignored-kick', strength: 1 },
      { type: 'note-on', time: 2, note: milestoneTwoBZlandAudioMap.melody![0] },
      { type: 'tonal-center-change', time: 2, tonalCenter: segment },
    ],
  };
  const adapted = toFerrisWheelInput(frame);
  assert.equal(adapted.chord, 'C major');
  assert.equal(adapted.tonicPitchClass, 7);
  assert.equal(adapted.tonalCenterChange?.tonalCenter.label, 'G major');
  assert.equal('beatPhase' in adapted, false);
  assert.equal('activeNote' in adapted, false);
});

test('unavailable harmony keeps chord evidence inactive while authored fixture remains compatible', () => {
  const snapshot = lookupSnapshot(milestoneOneZlandAudioMap, { time: 2, duration: 12, playing: true });
  const simulation = createFerrisWheelSimulation();
  simulation.accept(toFerrisWheelInput({ snapshot, events: [] }), 0.1);
  assert.equal(simulation.read().mode, 'resting');
  assert.equal(simulation.read().chord, null);
  assert.deepEqual(simulation.read().activeCabinIds, []);
  assert.equal(simulation.read().targetWheelAngle, FERRIS_INITIAL_ANGLE);
});

test('physical slots use fifths order while canonical pitch-class identities stay stable', () => {
  const simulation = createFerrisWheelSimulation();
  assert.deepEqual(simulation.read().cabins.map(cabin => cabin.id), [...Array(12).keys()]);
  assert.deepEqual(simulation.read().cabins.map(cabin => cabin.pitchClass), [...FERRIS_FIFTHS_PITCH_CLASSES]);
});

test('major and minor chords activate exact pitch-class sets independent of display order', () => {
  const simulation = createFerrisWheelSimulation();
  simulation.accept(input(), 0.05);
  assert.deepEqual(simulation.read().activeCabinIds, [0, 4, 7]);
  simulation.accept(input({ chord: 'A minor', rootPitchClass: 9, pitchClasses: [9, 0, 4] }), 0.05);
  assert.deepEqual(simulation.read().activeCabinIds, [0, 4, 9]);
  simulation.accept(input({ chord: 'G major', rootPitchClass: 7, pitchClasses: [7, 11, 2] }), 0.05);
  assert.deepEqual(simulation.read().activeCabinIds, [2, 7, 11]);
  assert.deepEqual(simulation.read().cabins.filter(cabin => cabin.active).map(cabin => cabin.pitchClass).sort((a, b) => a - b), [2, 7, 11]);
});

test('ordinary chord changes do not move the stable tonal-center target', () => {
  const simulation = createFerrisWheelSimulation();
  simulation.accept(input(), 0);
  const target = simulation.read().targetWheelAngle;
  simulation.accept(input({ chord: 'F major', rootPitchClass: 5, pitchClasses: [5, 9, 0] }), 0);
  assert.equal(simulation.read().targetWheelAngle, target);
  assert.deepEqual(simulation.read().activeCabinIds, [0, 5, 9]);
});

test('major and minor modes with the same tonic share one orientation', () => {
  const simulation = createFerrisWheelSimulation();
  simulation.accept(input({ tonicPitchClass: 7, tonalCenterLabel: 'G major', tonalMode: 'major' }), 0);
  const target = simulation.read().targetWheelAngle;
  simulation.accept(input({ tonicPitchClass: 7, tonalCenterLabel: 'G minor', tonalMode: 'minor' }), 0);
  assert.equal(simulation.read().targetWheelAngle, target);
});

test('tonal-center changes update the target but never teleport the wheel', () => {
  const simulation = createFerrisWheelSimulation();
  simulation.accept(input(), 0);
  const before = simulation.read().wheelAngle;
  simulation.accept(input({ tonicPitchClass: 7, tonalCenterLabel: 'G major', circleOfFifthsIndex: 1,
    tonalCenterChange: { type: 'tonal-center-change', time: 2, tonalCenter: tonalSegment(7, 'G major') } }), 0);
  assert.equal(simulation.read().wheelAngle, before);
  assert.ok(Math.abs(simulation.read().targetWheelAngle - (before - FERRIS_FIFTH_STEP)) < 1e-12);
  assert.equal(simulation.read().latestTonalCenterChange, 'G major');
});

test('low or unavailable tonal evidence retains the last valid target', () => {
  const simulation = createFerrisWheelSimulation();
  simulation.accept(input({ tonicPitchClass: 7, tonalCenterLabel: 'G major' }), 0);
  const target = simulation.read().targetWheelAngle;
  simulation.accept(input({ tonicPitchClass: 2, tonalCenterLabel: 'D major', tonalConfidence: 0.4 }), 0);
  assert.equal(simulation.read().targetWheelAngle, target);
  simulation.accept(input({ tonalCenterAvailable: false, tonicPitchClass: null, tonalCenterLabel: null }), 0);
  assert.equal(simulation.read().targetWheelAngle, target);
});

test('wheel approaches its target through bounded finite dynamics instead of snapping', () => {
  const simulation = createFerrisWheelSimulation();
  simulation.accept(input({ tonicPitchClass: 7, tonalCenterLabel: 'G major' }), 0);
  const initial = simulation.read().wheelAngle;
  const target = simulation.read().targetWheelAngle;
  simulation.accept(input({ tonicPitchClass: 7, tonalCenterLabel: 'G major' }), 0.05);
  assert.notEqual(simulation.read().wheelAngle, initial);
  assert.notEqual(simulation.read().wheelAngle, target);
  const firstError = Math.abs(simulation.read().targetError);
  advance(simulation, input({ tonicPitchClass: 7, tonalCenterLabel: 'G major' }), 8);
  assert.ok(Math.abs(simulation.read().targetError) < firstError);
  assert.ok(Math.abs(simulation.read().wheelAngularVelocity) <= FERRIS_MAX_WHEEL_SPEED + 1e-9);
  assert.ok(Math.abs(simulation.read().wheelAngularAcceleration) <= FERRIS_MAX_WHEEL_ACCELERATION + 1e-9);
});

test('large and invalid dt remain finite through integration protection', () => {
  const simulation = createFerrisWheelSimulation();
  simulation.accept(input({ tonicPitchClass: 6, tonalCenterLabel: 'F sharp major' }), 10_000);
  simulation.accept(input(), Number.NaN);
  const state = simulation.read();
  assert.ok([state.wheelAngle, state.targetWheelAngle, state.wheelAngularVelocity,
    state.wheelAngularAcceleration, ...state.cabins.flatMap(cabin => [cabin.swingAngle, cabin.swingVelocity])]
    .every(Number.isFinite));
});

test('cabin identity and gravity orientation remain stable while acceleration drives bounded swing', () => {
  const simulation = createFerrisWheelSimulation();
  const identities = simulation.read().cabins.map(cabin => `${cabin.id}:${cabin.pitchClass}`);
  advance(simulation, input({ tonicPitchClass: 6, tonalCenterLabel: 'F sharp major' }), 2);
  const state = simulation.read();
  assert.deepEqual(state.cabins.map(cabin => `${cabin.id}:${cabin.pitchClass}`), identities);
  assert.ok(state.cabins.some(cabin => Math.abs(cabin.swingAngle) > 0));
  assert.ok(state.cabins.every(cabin => cabin.worldOrientation === cabin.swingAngle));
  assert.ok(state.cabins.every(cabin => Math.abs(cabin.swingAngle) <= FERRIS_MAX_CABIN_SWING + 1e-9));
});

test('seek resolves snapshot tonic directly without replay or angle teleport', () => {
  const world = createAudioWorld(milestoneTwoBZlandAudioMap);
  const simulation = createFerrisWheelSimulation();
  world.read({ time: 1, duration: 20, playing: true });
  advance(simulation, input({ tonicPitchClass: 7, tonalCenterLabel: 'G major' }), 1);
  const before = simulation.read().wheelAngle;
  const frame = world.synchronize(1, { time: 10, duration: 20, playing: false });
  const adapted = toFerrisWheelInput(frame);
  simulation.accept({ ...adapted, tonalCenterAvailable: true, tonalCenterLabel: 'D major', tonicPitchClass: 2,
    tonalMode: 'major', tonalConfidence: 0.9, circleOfFifthsIndex: 2 }, 0);
  assert.deepEqual(frame.events.map(event => event.type), ['seek']);
  assert.equal(simulation.read().wheelAngle, before);
  assert.equal(simulation.read().tonicCabinId, 2);
  assert.equal(simulation.read().targetFifthsIndex, 2);
});

test('pause retains the target and permits physical settling', () => {
  const simulation = createFerrisWheelSimulation();
  const g = input({ tonicPitchClass: 7, tonalCenterLabel: 'G major' });
  advance(simulation, g, 1);
  const target = simulation.read().targetWheelAngle;
  const before = simulation.read().wheelAngle;
  advance(simulation, { ...g, transportPlaying: false }, 1);
  assert.equal(simulation.read().targetWheelAngle, target);
  assert.notEqual(simulation.read().wheelAngle, before);
  assert.notEqual(simulation.read().mode, 'active');
});

test('restart restores deterministic mechanics and resolves the beginning target', () => {
  const simulation = createFerrisWheelSimulation();
  advance(simulation, input({ tonicPitchClass: 6, tonalCenterLabel: 'F sharp major' }), 2);
  simulation.accept(input({ seek: true, restart: true }), 0);
  const state = simulation.read();
  assert.equal(state.wheelAngle, FERRIS_INITIAL_ANGLE);
  assert.equal(state.targetWheelAngle, FERRIS_INITIAL_ANGLE);
  assert.equal(state.wheelAngularVelocity, 0);
  assert.equal(state.tonicCabinId, 0);
  assert.ok(state.cabins.every(cabin => cabin.swingAngle === 0 && cabin.swingVelocity === 0));
  assert.deepEqual(state.activeCabinIds, [0, 4, 7]);
});

test('reduced motion preserves chord and tonal identities without rotation or swing', () => {
  const simulation = createFerrisWheelSimulation({ reducedMotion: true });
  advance(simulation, input({ tonicPitchClass: 7, tonalCenterLabel: 'G major' }), 5);
  const state = simulation.read();
  assert.equal(state.wheelAngularVelocity, 0);
  assert.equal(state.wheelAngle, FERRIS_INITIAL_ANGLE);
  assert.equal(state.tonicCabinId, 7);
  assert.equal(state.targetFifthsIndex, 1);
  assert.deepEqual(state.activeCabinIds, [0, 4, 7]);
  assert.ok(state.cabins.every(cabin => cabin.swingAngle === 0));
});
