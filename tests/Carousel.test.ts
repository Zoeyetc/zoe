import assert from 'node:assert/strict';
import test from 'node:test';
import { createCarouselSimulation } from '../src/rides/carousel/simulation.ts';
import type { CarouselInput } from '../src/rides/carousel/adapter.ts';
import type { ScaleDegree, ScaleDegreeEvidence } from '../src/audio/types.ts';

const melodyNote = (midi = 60, intensity = 0.8) => ({
  id: `note-${midi}`, start: 1, end: 2, midi, intensity,
});
const degree = (value: ScaleDegree | null, midi = 60, display = value?.toString() ?? null): ScaleDegreeEvidence => ({
  available: value !== null, inScale: value !== null, degree: value, displayDegree: display,
  tonicPitchClass: 0, mode: 'major', absoluteMidi: midi, absoluteNoteName: `m${midi}`,
  relativeSemitones: midi - 60, referenceTonicMidi: 60, octaveRelation: Math.floor((midi - 60) / 12),
  chromaticOffset: null, confidence: 0.9,
});
const input = (overrides: Partial<CarouselInput> = {}): CarouselInput => {
  const note = melodyNote();
  return {
    melodyAvailable: true, activeNote: note, scaleDegree: degree(1), noteProgress: 0.5,
    transportPlaying: true, events: [{ type: 'note-on', time: 1, note }], ...overrides,
  };
};

test('whole-carousel rotation is independent from rider pitch expression', () => {
  const low = createCarouselSimulation({ pitchRange: { min: 60, max: 69 } });
  const high = createCarouselSimulation({ pitchRange: { min: 60, max: 69 } });
  low.accept(input({ activeNote: melodyNote(60), scaleDegree: degree(1, 60) }), 0.1);
  high.accept(input({ activeNote: melodyNote(69), scaleDegree: degree(6, 69) }), 0.1);
  assert.equal(low.read().baseAngle, high.read().baseAngle);
  assert.equal(low.read().baseAngularVelocity, high.read().baseAngularVelocity);
  assert.notEqual(low.read().riders[0].target, high.read().riders[5].target);
});

test('note-on activates one rider and pitch targets stay bounded', () => {
  const carousel = createCarouselSimulation({ pitchRange: { min: 60, max: 69 } });
  carousel.accept(input({ activeNote: melodyNote(72, 2), scaleDegree: degree(8, 72) }), 0.1);
  const state = carousel.read();
  assert.equal(state.mode, 'active');
  assert.equal(state.activeMidi, 72);
  assert.equal(state.activeDegree, 8);
  assert.equal(state.activeRider, 7);
  assert.equal(state.riders.filter(rider => rider.active).length, 1);
  assert.ok(state.riders.every(rider => rider.target >= 0 && rider.target <= 1));
  assert.ok(state.riders.every(rider => rider.position >= 0 && rider.position <= 1));
});

test('note-off springs rider expression back instead of snapping', () => {
  const carousel = createCarouselSimulation();
  carousel.accept(input(), 0.1);
  carousel.accept(input(), 0.1);
  const lifted = carousel.read().riders[0].position;
  const note = melodyNote();
  carousel.accept(input({ activeNote: null, noteProgress: 0, events: [{ type: 'note-off', time: 2, note }] }), 0.05);
  const settling = carousel.read().riders[0];
  assert.ok(lifted > 0);
  assert.ok(settling.position > 0);
  assert.equal(settling.target, 0);
  assert.equal(carousel.read().mode, 'settling');
});

test('seek reconciles directly without rotating through skipped notes', () => {
  const carousel = createCarouselSimulation();
  carousel.accept(input(), 0.1);
  const angle = carousel.read().baseAngle;
  carousel.accept(input({ activeNote: melodyNote(67), scaleDegree: degree(5, 67), events: [{ type: 'seek', from: 1.5, to: 6.5 }] }), 0.1);
  assert.equal(carousel.read().baseAngle, angle);
  assert.equal(carousel.read().activeMidi, 67);
  assert.equal(carousel.read().activeRider, 4);
  assert.equal(carousel.read().riders.filter(rider => rider.position > 0).length, 1);
});

test('pause permits mechanical settling without resetting angle or rider height', () => {
  const carousel = createCarouselSimulation();
  carousel.accept(input(), 0.1);
  carousel.accept(input(), 0.1);
  const before = carousel.read();
  carousel.accept(input({ transportPlaying: false, events: [] }), 0.05);
  const paused = carousel.read();
  assert.ok(paused.baseAngle >= before.baseAngle);
  assert.ok(paused.baseAngularVelocity < before.baseAngularVelocity);
  assert.ok(paused.riders[0].position > 0);
  assert.equal(paused.mode, 'settling');
});

test('restart-style seek returns a valid beginning state without a global reset', () => {
  const carousel = createCarouselSimulation();
  carousel.accept(input(), 0.1);
  const angle = carousel.read().baseAngle;
  carousel.accept(input({ activeNote: null, noteProgress: 0, transportPlaying: false,
    events: [{ type: 'seek', from: 2, to: 0 }] }), 0);
  assert.equal(carousel.read().baseAngle, angle);
  assert.equal(carousel.read().activeMidi, null);
  assert.ok(carousel.read().riders.every(rider => rider.position === 0));
});

test('reduced motion suppresses base rotation but preserves restrained note identity', () => {
  const carousel = createCarouselSimulation({ reducedMotion: true });
  carousel.accept(input(), 0.1);
  const state = carousel.read();
  assert.equal(state.baseAngle, 0);
  assert.equal(state.baseAngularVelocity, 0);
  assert.equal(state.activeMidi, 60);
  assert.ok(state.riders[0].position > 0 && state.riders[0].position < 0.3);
});

test('unavailable melody keeps truth resting while allowing mechanical idle', () => {
  const carousel = createCarouselSimulation();
  carousel.accept(input({ melodyAvailable: false, activeNote: null }), 0.1);
  assert.equal(carousel.read().mode, 'resting');
  assert.equal(carousel.read().mechanicalIdleActive, true);
  assert.equal(carousel.read().movementSource, 'mechanical-idle');
  assert.equal(carousel.read().activeMidi, null);
  assert.equal(carousel.read().activeRider, null);
  assert.ok(carousel.read().baseAngularVelocity > 0);
});

test('presentation envelope attacks quickly and releases more slowly than musical truth', () => {
  const carousel = createCarouselSimulation();
  carousel.accept(input(), 0.1);
  const attacked = carousel.read().presentationEnvelope;
  assert.ok(attacked > 0 && attacked < 1);
  const note = melodyNote();
  carousel.accept(input({ activeNote: null, events: [{ type: 'note-off', time: 2, note }] }), 0.1);
  assert.equal(carousel.read().activeMidi, null);
  assert.ok(carousel.read().presentationEnvelope > 0);
  assert.ok(carousel.read().presentationEnvelope < attacked);
});

test('eight persistent carriers have fixed degree identities', () => {
  const state = createCarouselSimulation().read();
  assert.deepEqual(state.riders.map(rider => rider.degree), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('degree maps directly to carrier without MIDI modulo allocation', () => {
  const carousel = createCarouselSimulation();
  for (const value of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
    carousel.accept(input({ activeNote: melodyNote(60 + value), scaleDegree: degree(value, 60 + value), events: [] }), 0);
    assert.equal(carousel.read().activeRider, value - 1);
  }
  carousel.accept(input({ activeNote: melodyNote(64), scaleDegree: degree(3, 64), events: [] }), 0);
  assert.equal(carousel.read().activeRider, 2);
  carousel.accept(input({ activeNote: melodyNote(76), scaleDegree: degree(3, 76), events: [] }), 0);
  assert.equal(carousel.read().activeRider, 2);
});

test('chromatic or unavailable degree activates no carrier and preserves a fallback marker', () => {
  const carousel = createCarouselSimulation();
  const chromatic = { ...degree(null, 66), absoluteNoteName: 'F#4', chromaticOffset: 1 };
  carousel.accept(input({ activeNote: { ...melodyNote(66), noteName: 'F#4' }, scaleDegree: chromatic }), 0.1);
  const state = carousel.read();
  assert.equal(state.activeRider, null);
  assert.equal(state.riders.some(rider => rider.active), false);
  assert.deepEqual(state.chromaticMarker, { visible: true, noteName: 'F#4', midi: 66, offset: 1 });
  assert.equal(state.mode, 'active');
});

test('tonal reinterpretation remaps a sustained note without requiring note-on', () => {
  const carousel = createCarouselSimulation();
  const sustained = melodyNote(67);
  carousel.accept(input({ activeNote: sustained, scaleDegree: degree(5, 67), events: [] }), 0.1);
  assert.equal(carousel.read().activeRider, 4);
  carousel.accept(input({ activeNote: sustained, scaleDegree: degree(1, 67), events: [] }), 0.1);
  assert.equal(carousel.read().activeRider, 0);
  assert.equal(carousel.read().lastEvent, null);
});
