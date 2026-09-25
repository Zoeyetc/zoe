import assert from 'node:assert/strict';
import test from 'node:test';
import { initialObservatoryMotion, stepObservatoryMotion } from '../src/instrument-ui/signal-player/observatoryMotion.ts';
import type { MotionStudySample } from '../src/instrument-ui/signal-player/motionStudyEvidence.ts';

const sample = (level: number, transient: number, structureEnergy: number, beat: number,
  active = true): MotionStudySample => ({ level, transient, structureEnergy, beat, active, progress: 0 });
const agreement = sample(.8, .8, .8, .8);
const conflict = sample(1, 0, 0, 0);
const advance = (state: typeof initialObservatoryMotion, evidence: MotionStudySample, frames: number) => {
  for (let frame = 0; frame < frames; frame += 1) state = stepObservatoryMotion(state, evidence, 1 / 60);
  return state;
};

test('brief consensus is ignored without visible response', () => {
  const state = advance(initialObservatoryMotion, agreement, 60);
  assert.equal(state.confirmed, false);
  assert.equal(state.activity, 0);
});

test('weak partial agreement never qualifies as a confirmation candidate', () => {
  const state = advance(initialObservatoryMotion, sample(.8, .8, 0, 0), 600);
  assert.equal(state.confirmed, false);
  assert.equal(state.activity, 0);
});

test('long consensus is accepted only after the confirmation interval', () => {
  const before = advance(initialObservatoryMotion, agreement, 89);
  assert.equal(before.confirmed, false);
  const accepted = stepObservatoryMotion(before, agreement, 1 / 60);
  assert.equal(accepted.confirmed, true);
  assert.ok(accepted.activity > 0);
});

test('failed confirmation restarts the clock and does not create motion', () => {
  let state = advance(initialObservatoryMotion, agreement, 70);
  state = advance(state, conflict, 5);
  state = advance(state, agreement, 70);
  assert.equal(state.confirmed, false);
  assert.equal(state.activity, 0);
});

test('a confirmed transition moves once, monotonically, then holds exactly', () => {
  let state = advance(initialObservatoryMotion, agreement, 90);
  let previous = state.activity;
  for (let frame = 0; frame < 90; frame += 1) {
    state = stepObservatoryMotion(state, agreement, 1 / 60);
    assert.ok(state.activity >= previous);
    previous = state.activity;
  }
  assert.equal(state.activity, .55);
  assert.deepEqual(advance(state, agreement, 600), state);
});

test('lost agreement is confirmed before a single return to exact rest', () => {
  let state = advance(initialObservatoryMotion, agreement, 180);
  state = advance(state, conflict, 89);
  assert.equal(state.confirmed, true);
  assert.equal(state.activity, .55);
  state = advance(state, conflict, 1);
  assert.equal(state.confirmed, false);
  state = advance(state, conflict, 90);
  assert.equal(state.activity, 0);
  assert.equal(advance(state, conflict, 600).activity, 0);
});
