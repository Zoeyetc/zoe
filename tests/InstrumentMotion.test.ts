import assert from 'node:assert/strict';
import test from 'node:test';
import { initialInstrumentMotion, stepInstrumentMotion } from '../src/instrument-ui/signal-player/instrumentMotion.ts';

test('Instrument stays at rest across insignificant retained-evidence jitter', () => {
  let state = initialInstrumentMotion;
  for (let frame = 0; frame < 300; frame += 1) {
    state = stepInstrumentMotion(state, frame % 2 ? .008 : .014, 1 / 60);
    assert.equal(state.activity, 0);
  }
});

test('Instrument preserves continuity on a retained-evidence step and comes to rest', () => {
  let state = initialInstrumentMotion;
  const frames: number[] = [];
  for (let frame = 0; frame < 180; frame += 1) {
    state = stepInstrumentMotion(state, frame < 60 ? .7 : 0, 1 / 60);
    frames.push(state.activity);
  }
  assert.ok(frames[0] > 0 && frames[0] < .01);
  assert.ok(Math.max(...frames.slice(0, 60)) < .72);
  assert.ok(Math.max(...frames.slice(1).map((value, index) => Math.abs(value - frames[index]))) < .03);
  assert.equal(state.activity, 0);
  assert.equal(state.velocity, 0);
});

test('Instrument yields similar motion at 60 and 120 frames per second', () => {
  const at = (fps: number) => {
    let state = initialInstrumentMotion;
    for (let frame = 0; frame < fps; frame += 1) state = stepInstrumentMotion(state, .6, 1 / fps);
    return state.activity;
  };
  assert.ok(Math.abs(at(60) - at(120)) < .002);
});
