import assert from 'node:assert/strict';
import test from 'node:test';
import type { SignalConsoleObservation } from '../src/instrument-ui/signal-console/types.ts';
import { motionStudyTarget, selectMotionStudySample } from '../src/instrument-ui/signal-player/motionStudyEvidence.ts';

function observation(time: number, playing: boolean, level = .4, transient = .6): SignalConsoleObservation {
  return {
    mapRevision: 1,
    transport: { time, duration: 10, playing },
    audioMap: {
      id: 'study', version: 1, duration: 10,
      capabilities: { melody: false, rhythm: false, percussion: false, harmony: false,
        tonalCenter: false, structure: true, spectrum: false },
      melody: null, percussion: null, rhythm: null, harmony: null, spectrum: null,
      amplitude: [
        { id: 'a0', start: 0, end: 5, rms: [level, level], peak: [level, level],
          onsetStrength: [transient, transient] },
        { id: 'a1', start: 5, end: 10, rms: [.1, .1], peak: [.1, .1], onsetStrength: [0, 0] },
      ],
      structureAnalysis: { frames: [
        { id: 's0', start: 0, end: 5, vector: [], energy: .8, onsetDensity: 0 },
        { id: 's1', start: 5, end: 10, vector: [], energy: .2, onsetDensity: 0 },
      ] } as SignalConsoleObservation['audioMap']['structureAnalysis'],
    },
  };
}

test('motion studies read current retained evidence and authoritative transport position', () => {
  const beat = { type: 'beat' as const, time: 2.9, index: 1, strength: 1 };
  const early = selectMotionStudySample(observation(3, true), [beat]);
  assert.equal(early.level, .4);
  assert.equal(early.transient, .6);
  assert.equal(early.structureEnergy, .8);
  assert.equal(early.progress, .3);
  assert.ok(early.beat > 0);
  const later = selectMotionStudySample(observation(6, true), [beat]);
  assert.equal(later.level, .1);
  assert.equal(later.transient, 0);
  assert.equal(later.structureEnergy, .2);
  assert.equal(later.beat, 0);
});

test('pause, end, and silence settle all study directions without invented activity', () => {
  for (const sample of [
    selectMotionStudySample(observation(3, false), []),
    selectMotionStudySample(observation(10, false), []),
    selectMotionStudySample(observation(3, true, 0, 0), []),
  ]) {
    for (const variant of ['a', 'b', 'c'] as const) {
      assert.equal(motionStudyTarget(variant, sample), 0);
    }
  }
});

test('study variants use separate bounded listening mappings', () => {
  const sample = selectMotionStudySample(observation(3, true), []);
  assert.ok(Math.abs(motionStudyTarget('a', sample) - .43) < 1e-9);
  assert.ok(Math.abs(motionStudyTarget('b', sample) - .42) < 1e-9);
  assert.ok(Math.abs(motionStudyTarget('c', sample) - .64) < 1e-9);
});
