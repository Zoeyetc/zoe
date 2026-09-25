import assert from 'node:assert/strict';
import test from 'node:test';
import type { BassEvidence, BassSnapshot } from '@zoeyetc/computational-listening-engine';
import { selectBassPresentation } from '../src/instrument-ui/signal-console/bassPresentation.ts';

const evidence: BassEvidence = {
  version: 1, source: 'melody-candidate-evidence-v1',
  frames: [{ time: 0.5, candidates: [{ pitchHz: 82.41, midiFloat: 40, score: 0.8,
    periodicity: 0.9, salience: 0.7, source: 'melody-range-rejected-low', sourceRank: 1 }],
  selectedCandidateIndex: 0, selectedPitchHz: 82.41, selectedMidiFloat: 40,
  selectedScore: 0.8, reason: 'SELECTED' },
  { time: 1, candidates: [{ pitchHz: 110, midiFloat: 45, score: 0.4,
    periodicity: 0.5, salience: 0.4, source: 'melody-usable', sourceRank: 1 }],
  selectedCandidateIndex: null, selectedPitchHz: null, selectedMidiFloat: null,
  selectedScore: null, reason: 'PATH_ABSTAINED' }],
  path: { version: 1, selectedCandidateIndexes: [0, null], objective: 0.2 },
  limitations: { nominalLowerFrequencyBoundHz: 80, upperCandidateFrequencyHz: 330,
    candidatesPrunedByMelody: true, voiceSeparation: false, calibratedConfidence: false },
};

test('Bass selected path keeps its own pitch, candidates, and uncalibrated score', () => {
  const snapshot: BassSnapshot = { time: 0.5, available: true, pitchHz: 82.41,
    midiFloat: 40, candidateScore: 0.8, reason: 'SELECTED' };
  const display = selectBassPresentation(snapshot, evidence);
  assert.equal(display.noteName, 'E2');
  assert.equal(display.frequencyHz, '82.41');
  assert.equal(display.score, '0.800');
  assert.equal(display.confidence, 'UNCALIBRATED');
  assert.equal(display.frame?.candidates[0]?.source, 'melody-range-rejected-low');
});

test('Bass abstention and missing evidence never become a Melody fallback', () => {
  const abstained: BassSnapshot = { time: 1, available: false, pitchHz: null,
    midiFloat: null, candidateScore: null, reason: 'PATH_ABSTAINED' };
  assert.deepEqual({ note: selectBassPresentation(abstained, evidence).noteName,
    state: selectBassPresentation(abstained, evidence).state },
  { note: '—', state: 'PATH_ABSTAINED' });
  assert.equal(selectBassPresentation(null, null).noteName, '—');
  assert.equal(selectBassPresentation(null, null).state, 'UNAVAILABLE');
});
