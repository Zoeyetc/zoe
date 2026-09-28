import assert from 'node:assert/strict';
import test from 'node:test';
import { assessObservatoryEvidence, initialObservatoryMotion,
  stepObservatoryMotion } from '../src/instrument-ui/signal-player/observatoryMotion.ts';
import { emptyMotionStudySample, type MotionStudySample } from '../src/instrument-ui/signal-player/motionStudyEvidence.ts';

const sample = (overrides: Partial<MotionStudySample> = {}): MotionStudySample =>
  ({ ...emptyMotionStudySample, active: true, ...overrides });
const supported = sample({ melodySupport: .8, melodyIdentity: 'M:69', bassSupport: .72,
  bassIdentity: 'B:45', harmonySupport: .75, harmonyIdentity: 'H:A MINOR',
  interpretationKey: 'M:69|B:45|H:A MINOR' });
const withheld = sample({ ...supported, melodyAbstained: true, melodyIdentity: null,
  melodySupport: 0, interpretationKey: 'B:45|H:A MINOR' });
const advance = (state: typeof initialObservatoryMotion, evidence: MotionStudySample, frames: number) => {
  for (let frame = 0; frame < frames; frame += 1) state = stepObservatoryMotion(state, evidence, 1 / 60);
  return state;
};

test('brief supported interpretation is observed without visible commitment', () => {
  const state = advance(initialObservatoryMotion, supported, 60);
  assert.equal(state.confirmed, false);
  assert.equal(state.activity, 0);
});

test('weak or competing evidence never qualifies for confirmation', () => {
  assert.equal(assessObservatoryEvidence(sample({ melodySupport: .4, melodyIdentity: 'M:69',
    interpretationKey: 'M:69' })).eligible, false);
  assert.equal(assessObservatoryEvidence({ ...supported, melodyCompetition: .9 }).eligible, false);
});

test('stable support is admitted only after the confirmation interval', () => {
  const before = advance(initialObservatoryMotion, supported, 89);
  assert.equal(before.confirmed, false);
  const accepted = stepObservatoryMotion(before, supported, 1 / 60);
  assert.equal(accepted.confirmed, true);
  assert.ok(accepted.activity > 0);
});

test('abstention resets a pending interpretation and withholds commitment', () => {
  let state = advance(initialObservatoryMotion, supported, 70);
  state = advance(state, withheld, 5);
  state = advance(state, supported, 70);
  assert.equal(state.confirmed, false);
  assert.equal(state.activity, 0);
});

test('a confirmed interpretation moves once, then remains exactly stable', () => {
  let state = advance(initialObservatoryMotion, supported, 90);
  let previous = state.activity;
  for (let frame = 0; frame < 90; frame += 1) {
    state = stepObservatoryMotion(state, supported, 1 / 60);
    assert.ok(state.activity >= previous);
    previous = state.activity;
  }
  assert.ok(state.activity > .5 && state.activity < .7);
  assert.deepEqual(advance(state, supported, 600), state);
});

test('revision earns a new confirmation instead of inheriting the first decision', () => {
  let state = advance(initialObservatoryMotion, supported, 180);
  const revision = { ...supported, melodyIdentity: 'M:71', interpretationKey: 'M:71|B:45|H:A MINOR' };
  state = advance(state, revision, 89);
  assert.equal(state.confirmedKey, supported.interpretationKey);
  state = advance(state, revision, 1);
  assert.equal(state.confirmedKey, revision.interpretationKey);
});

test('sustained abstention withdraws a confirmed response and returns to exact rest', () => {
  let state = advance(initialObservatoryMotion, supported, 180);
  state = advance(state, withheld, 35);
  assert.equal(state.confirmed, true);
  state = advance(state, withheld, 1);
  assert.equal(state.confirmed, false);
  state = advance(state, withheld, 90);
  assert.equal(state.activity, 0);
  assert.equal(advance(state, withheld, 600).activity, 0);
});
