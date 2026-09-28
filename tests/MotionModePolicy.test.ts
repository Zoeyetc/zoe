import assert from 'node:assert/strict';
import test from 'node:test';
import { initialMotionPolicyState, stepMotionPolicies,
  type MotionPolicyState } from '../src/instrument-ui/signal-player/motionResponsePolicy.ts';
import { emptyMotionStudySample, type MotionStudySample } from '../src/instrument-ui/signal-player/motionStudyEvidence.ts';

const sample = (overrides: Partial<MotionStudySample> = {}): MotionStudySample =>
  ({ ...emptyMotionStudySample, active: true, ...overrides });

function advance(state: MotionPolicyState, evidence: MotionStudySample, frames: number) {
  let result = stepMotionPolicies(state, evidence, 1 / 60);
  for (let frame = 1; frame < frames; frame += 1) result = stepMotionPolicies(result.state, evidence, 1 / 60);
  return result;
}

test('the same transient produces present articulation without instant material, field, or observatory commitment', () => {
  const result = advance(initialMotionPolicyState, sample({ transient: 1, percussionPulse: .9 }), 6);
  assert.ok(result.responses.instrument.activity > .1);
  assert.ok(result.responses.instrument.articulation > .8);
  assert.ok(result.responses.material.activity < .01);
  assert.equal(result.responses.field.activity, 0);
  assert.equal(result.responses.observatory.activity, 0);
});

test('stable accepted evidence separates accumulation, relationships, and confirmation', () => {
  const melody = sample({ melodySupport: .8, melodyIdentity: 'M:69', interpretationKey: 'M:69' });
  const early = advance(initialMotionPolicyState, melody, 12);
  const sustained = advance(early.state, melody, 168);
  assert.ok(early.responses.instrument.activity > early.responses.material.activity * 4);
  assert.ok(sustained.responses.material.memory > early.responses.material.memory * 2);
  assert.equal(sustained.responses.field.organization, 0);
  assert.equal(sustained.responses.observatory.commitment, 1);
});

test('Melody and Bass co-occurrence organizes Field while isolated evidence does not', () => {
  const melody = sample({ melodySupport: .8, melodyIdentity: 'M:69', interpretationKey: 'M:69' });
  const dual = sample({ ...melody, bassSupport: .75, bassIdentity: 'B:45', interpretationKey: 'M:69|B:45' });
  const isolated = advance(initialMotionPolicyState, melody, 120);
  const related = advance(initialMotionPolicyState, dual, 120);
  assert.equal(isolated.responses.field.organization, 0);
  assert.ok(related.responses.field.organization > .3);
});

test('repeated percussion deposits material pressure but cannot organize Field by itself', () => {
  let state = initialMotionPolicyState;
  const deposits: number[] = [];
  for (let event = 0; event < 6; event += 1) {
    let result = advance(state, sample({ percussionPulse: 1, beat: 1 }), 8);
    state = result.state;
    deposits.push(result.responses.material.memory);
    result = advance(state, sample(), 12);
    state = result.state;
  }
  assert.ok(deposits.at(-1)! > deposits[0] * 2);
  assert.equal(state.field.confidence, 0);
  assert.equal(state.observatory.confirmed, false);
});

test('competition and abstention expose distinct recovery policies', () => {
  const stable = sample({ melodySupport: .82, melodyIdentity: 'M:69', bassSupport: .76,
    bassIdentity: 'B:45', harmonySupport: .74, harmonyIdentity: 'H:A MINOR',
    tonalSupport: .7, tonalIdentity: 'T:A MINOR', rhythmSupport: .75,
    interpretationKey: 'M:69|B:45|H:A MINOR|T:A MINOR' });
  const charged = advance(initialMotionPolicyState, stable, 180);
  const abstained = sample({ melodyAbstained: true, bassAbstained: true });
  const next = advance(charged.state, abstained, 12);
  assert.ok(next.responses.instrument.activity < charged.responses.instrument.activity);
  assert.ok(next.responses.material.memory > 0);
  assert.ok(next.responses.material.memory < charged.responses.material.memory);
  assert.ok(next.responses.field.organization < charged.responses.field.organization);
  assert.equal(next.responses.observatory.commitment, 1);
  const withheld = advance(next.state, abstained, 30);
  assert.equal(withheld.responses.observatory.commitment, 0);
});

test('all bounded policies advance continuously so mode switching does not reconstruct state', () => {
  const stable = sample({ melodySupport: .8, melodyIdentity: 'M:69', bassSupport: .75,
    bassIdentity: 'B:45', interpretationKey: 'M:69|B:45' });
  const result = advance(initialMotionPolicyState, stable, 180);
  assert.ok(result.responses.instrument.activity > 0);
  assert.ok(result.responses.material.memory > 0);
  assert.ok(result.responses.field.organization > 0);
  assert.equal(result.responses.observatory.commitment, 1);
});
