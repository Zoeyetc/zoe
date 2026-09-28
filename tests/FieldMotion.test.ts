import assert from 'node:assert/strict';
import test from 'node:test';
import { fieldRelationships, initialFieldMotion, stepFieldMotion } from '../src/instrument-ui/signal-player/fieldMotion.ts';
import { emptyMotionStudySample, type MotionStudySample } from '../src/instrument-ui/signal-player/motionStudyEvidence.ts';

const sample = (overrides: Partial<MotionStudySample> = {}): MotionStudySample =>
  ({ ...emptyMotionStudySample, active: true, ...overrides });

const organized = sample({
  melodySupport: .8, melodyIdentity: 'M:69', bassSupport: .8, bassIdentity: 'B:45',
  rhythmSupport: .8, harmonySupport: .8, harmonyIdentity: 'H:A MINOR',
  tonalSupport: .8, tonalIdentity: 'T:A MINOR', percussionActivity: .8,
  interpretationKey: 'M:69|B:45|H:A MINOR|T:A MINOR',
});

test('cross-domain support organizes Field more than one isolated relationship', () => {
  const high = fieldRelationships(organized);
  const partial = fieldRelationships(sample({ melodySupport: .8, melodyIdentity: 'M:69',
    bassSupport: .8, bassIdentity: 'B:45', interpretationKey: 'M:69|B:45' }));
  assert.ok(high.organization > partial.organization);
  assert.ok(high.melodyBass > 0 && high.pitchedHarmony > 0 && high.harmonyTonal > 0);
});

test('isolated level, transient, or repeated beat never creates Field organization', () => {
  for (const evidence of [sample({ level: 1 }), sample({ transient: 1 }), sample({ beat: 1 })]) {
    let state = initialFieldMotion;
    for (let frame = 0; frame < 600; frame += 1) state = stepFieldMotion(state, evidence, 1 / 60);
    assert.equal(state.confidence, 0);
  }
});

test('competition restrains relationships without creating extra activity', () => {
  const clear = fieldRelationships(organized);
  const competing = fieldRelationships({ ...organized, melodyCompetition: .95, bassCompetition: .9,
    harmonyCompetition: .9, tonalCompetition: .9 });
  assert.ok(competing.organization < clear.organization * .6);
});

test('Bass abstention removes its relationship while broader organization can persist', () => {
  const full = fieldRelationships(organized);
  const withoutBass = fieldRelationships({ ...organized, bassSupport: 0, bassIdentity: null, bassAbstained: true,
    interpretationKey: 'M:69|H:A MINOR|T:A MINOR' });
  assert.equal(withoutBass.melodyBass, 0);
  assert.ok(withoutBass.organization > 0);
  assert.ok(withoutBass.organization < full.organization);
});

test('lost relationships withdraw confidence and renewed organization recovers', () => {
  let state = initialFieldMotion;
  for (let frame = 0; frame < 120; frame += 1) state = stepFieldMotion(state, organized, 1 / 60);
  const first = state.confidence;
  for (let frame = 0; frame < 120; frame += 1) state = stepFieldMotion(state, sample({ level: 1 }), 1 / 60);
  const withdrawn = state.confidence;
  for (let frame = 0; frame < 120; frame += 1) state = stepFieldMotion(state, organized, 1 / 60);
  assert.ok(withdrawn < first / 4);
  assert.ok(state.confidence > first * .9);
  for (let frame = 0; frame < 300; frame += 1) {
    state = stepFieldMotion(state, emptyMotionStudySample, 1 / 60);
  }
  assert.deepEqual(state, initialFieldMotion);
});
