import assert from 'node:assert/strict';
import test from 'node:test';
import { createCarouselSimulation } from '../src/rides/carousel/simulation.ts';
import type { CarouselInput } from '../src/rides/carousel/adapter.ts';

const melodyNote = (midi = 60, intensity = 0.8) => ({
  id: `note-${midi}`, start: 1, end: 2, midi, intensity,
});
const input = (overrides: Partial<CarouselInput> = {}): CarouselInput => {
  const note = melodyNote();
  return {
    melodyAvailable: true, activeNote: note, noteProgress: 0.5,
    transportPlaying: true, events: [{ type: 'note-on', time: 1, note }], ...overrides,
  };
};

test('whole-carousel rotation is independent from rider pitch expression', () => {
  const low = createCarouselSimulation({ pitchRange: { min: 60, max: 69 } });
  const high = createCarouselSimulation({ pitchRange: { min: 60, max: 69 } });
  low.accept(input({ activeNote: melodyNote(60) }), 0.1);
  high.accept(input({ activeNote: melodyNote(69) }), 0.1);
  assert.equal(low.read().baseAngle, high.read().baseAngle);
  assert.equal(low.read().baseAngularVelocity, high.read().baseAngularVelocity);
  assert.notEqual(low.read().riders[4].target, high.read().riders[5].target);
});

test('note-on activates one rider and pitch targets stay bounded', () => {
  const carousel = createCarouselSimulation({ pitchRange: { min: 60, max: 69 } });
  carousel.accept(input({ activeNote: melodyNote(200, 2) }), 0.1);
  const state = carousel.read();
  assert.equal(state.mode, 'active');
  assert.equal(state.activeMidi, 200);
  assert.equal(state.riders.filter(rider => rider.active).length, 1);
  assert.ok(state.riders.every(rider => rider.target >= 0 && rider.target <= 1));
  assert.ok(state.riders.every(rider => rider.position >= 0 && rider.position <= 1));
});

test('note-off springs rider expression back instead of snapping', () => {
  const carousel = createCarouselSimulation();
  carousel.accept(input(), 0.1);
  carousel.accept(input(), 0.1);
  const lifted = carousel.read().riders[4].position;
  const note = melodyNote();
  carousel.accept(input({ activeNote: null, noteProgress: 0, events: [{ type: 'note-off', time: 2, note }] }), 0.05);
  const settling = carousel.read().riders[4];
  assert.ok(lifted > 0);
  assert.ok(settling.position > 0);
  assert.equal(settling.target, 0);
  assert.equal(carousel.read().mode, 'settling');
});

test('seek reconciles directly without rotating through skipped notes', () => {
  const carousel = createCarouselSimulation();
  carousel.accept(input(), 0.1);
  const angle = carousel.read().baseAngle;
  carousel.accept(input({ activeNote: melodyNote(67), events: [{ type: 'seek', from: 1.5, to: 6.5 }] }), 0.1);
  assert.equal(carousel.read().baseAngle, angle);
  assert.equal(carousel.read().activeMidi, 67);
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
  assert.ok(paused.riders[4].position > 0);
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
  assert.ok(state.riders[4].position > 0 && state.riders[4].position < 0.3);
});

test('unavailable melody rests the actor', () => {
  const carousel = createCarouselSimulation();
  carousel.accept(input({ melodyAvailable: false, activeNote: null }), 0.1);
  assert.equal(carousel.read().mode, 'resting');
  assert.equal(carousel.read().awake, false);
});
