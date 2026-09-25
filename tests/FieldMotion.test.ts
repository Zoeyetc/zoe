import assert from 'node:assert/strict';
import test from 'node:test';
import { fieldAgreement, initialFieldMotion, stepFieldMotion } from '../src/instrument-ui/signal-player/fieldMotion.ts';
import type { MotionStudySample } from '../src/instrument-ui/signal-player/motionStudyEvidence.ts';

const sample = (level: number, transient: number, structureEnergy: number, beat: number,
  active = true): MotionStudySample => ({ level, transient, structureEnergy, beat, active, progress: 0 });

test('high agreement yields high confidence, while partial agreement stays restrained', () => {
  assert.ok(Math.abs(fieldAgreement(sample(.8, .8, .8, .8)) - .8) < 1e-12);
  assert.ok(Math.abs(fieldAgreement(sample(.8, .8, 0, 0)) - .08) < 1e-12);
  assert.ok(fieldAgreement(sample(.5, .5, .5, 1)) < fieldAgreement(sample(.5, .5, .5, .5)));
});

test('isolated level or repeated beats never create strong Field motion', () => {
  let levelState = initialFieldMotion;
  let beatState = initialFieldMotion;
  for (let frame = 0; frame < 600; frame += 1) {
    levelState = stepFieldMotion(levelState, sample(1, 0, 0, 0), 1 / 60);
    beatState = stepFieldMotion(beatState, sample(0, 0, 0, frame % 30 < 8 ? 1 : 0), 1 / 60);
  }
  assert.equal(levelState.confidence, 0);
  assert.equal(beatState.confidence, 0);
});

test('disagreement withdraws confidence without creating extra activity', () => {
  let state = initialFieldMotion;
  for (let frame = 0; frame < 120; frame += 1) state = stepFieldMotion(state, sample(.8, .8, .8, .8), 1 / 60);
  const agreed = state.confidence;
  for (let frame = 0; frame < 60; frame += 1) {
    const next = stepFieldMotion(state, sample(1, 0, 0, 0), 1 / 60);
    assert.ok(next.confidence <= state.confidence);
    state = next;
  }
  assert.ok(state.confidence < agreed / 8);
});

test('renewed agreement recovers confidence and inactive evidence returns to exact rest', () => {
  let state = initialFieldMotion;
  for (let frame = 0; frame < 60; frame += 1) state = stepFieldMotion(state, sample(.7, .7, .7, .7), 1 / 60);
  const first = state.confidence;
  for (let frame = 0; frame < 60; frame += 1) state = stepFieldMotion(state, sample(1, 0, 0, 0), 1 / 60);
  const conflicted = state.confidence;
  for (let frame = 0; frame < 60; frame += 1) state = stepFieldMotion(state, sample(.7, .7, .7, .7), 1 / 60);
  assert.ok(conflicted < first && state.confidence > first * .9);
  for (let frame = 0; frame < 240; frame += 1) state = stepFieldMotion(state, sample(.7, .7, .7, .7, false), 1 / 60);
  assert.deepEqual(state, initialFieldMotion);
});
