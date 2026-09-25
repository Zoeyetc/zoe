import assert from 'node:assert/strict';
import test from 'node:test';
import { initialMaterialMotion, stepMaterialMotion } from '../src/instrument-ui/signal-player/materialMotion.ts';
import type { MotionStudySample } from '../src/instrument-ui/signal-player/motionStudyEvidence.ts';

const sample = (level = 0, transient = 0, beat = 0, active = true): MotionStudySample =>
  ({ level, transient, beat, active, structureEnergy: 0, progress: 0 });

test('an isolated weak transient stays below Material expression', () => {
  let state = initialMaterialMotion;
  for (let frame = 0; frame < 12; frame += 1) {
    state = stepMaterialMotion(state, sample(0, .5), 1 / 60);
  }
  assert.equal(state.activity, 0);
});

test('repeated retained beats accumulate more pressure than one beat', () => {
  let state = initialMaterialMotion;
  const peaks: number[] = [];
  for (let beat = 0; beat < 6; beat += 1) {
    for (let frame = 0; frame < 9; frame += 1) {
      state = stepMaterialMotion(state, sample(0, 0, 1 - frame / 9), 1 / 60);
    }
    peaks.push(state.pressure);
    for (let frame = 0; frame < 12; frame += 1) state = stepMaterialMotion(state, sample(), 1 / 60);
  }
  assert.ok(peaks[5] > peaks[0] * 2);
  assert.ok(peaks[5] <= 1);
  assert.ok(state.activity > 0);
});

test('sustained level builds bounded pressure rather than tracking each frame directly', () => {
  let state = initialMaterialMotion;
  for (let frame = 0; frame < 3600; frame += 1) {
    state = stepMaterialMotion(state, sample(.5), 1 / 60);
    assert.ok(state.pressure >= 0 && state.pressure <= 1);
  }
  assert.ok(state.pressure > .5);
  assert.ok(state.activity > .4);
});

test('weaker evidence releases stored pressure smoothly and reaches exact rest', () => {
  let state = initialMaterialMotion;
  for (let frame = 0; frame < 180; frame += 1) state = stepMaterialMotion(state, sample(.5), 1 / 60);
  const charged = state.pressure;
  for (let frame = 0; frame < 30; frame += 1) state = stepMaterialMotion(state, sample(.2), 1 / 60);
  assert.ok(state.pressure < charged && state.pressure > 0);
  const afterWeakening = state.pressure;
  state = stepMaterialMotion(state, sample(0, 0, 0, false), 1 / 60);
  assert.ok(state.pressure < afterWeakening && state.pressure > 0);
  for (let frame = 0; frame < 900; frame += 1) state = stepMaterialMotion(state, sample(0, 0, 0, false), 1 / 60);
  assert.deepEqual(state, initialMaterialMotion);
});
