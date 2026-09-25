import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeMelody, analyzeMelodyWithEvidence, MELODY_ANALYSIS } from '../src/listening-engine/index.ts';
import { selectMelodyEvidence } from '../src/listening-engine/index.ts';
import {
  BASS_AMPLITUDE, CALIBRATION_SAMPLE_RATE, centsDistance, characterizeMelodyPath, classifyWrongPath,
  createMelodyPathCalibrationStimulus, formatMelodyPathCharacterization,
  GROUND_TRUTH_BASS, GROUND_TRUTH_MELODY, IDENTITY_TOLERANCE_CENTS, MELODY_AMPLITUDE,
  TRANSITION_MARGIN_SECONDS,
} from './melodyPathIdentityCalibration.ts';

const analyze = (mono: Float32Array) => analyzeMelodyWithEvidence({
  mono,
  sampleRate: CALIBRATION_SAMPLE_RATE,
});

test('ground-truth calibration stimulus is deterministic and independent of analyzer output', () => {
  const melodyOnlyA = createMelodyPathCalibrationStimulus('MELODY_ONLY');
  const melodyOnlyB = createMelodyPathCalibrationStimulus('MELODY_ONLY');
  const melodyWithBass = createMelodyPathCalibrationStimulus('MELODY_PLUS_BASS');
  assert.deepEqual(melodyOnlyA, melodyOnlyB);
  assert.equal(melodyOnlyA.length, CALIBRATION_SAMPLE_RATE * 10);
  assert.equal(melodyWithBass.length, melodyOnlyA.length);
  assert.notDeepEqual(melodyWithBass, melodyOnlyA);
  assert.equal(MELODY_AMPLITUDE, 0.42);
  assert.equal(BASS_AMPLITUDE, 0.36);
  assert.equal(TRANSITION_MARGIN_SECONDS, 0.20);
  assert.equal(IDENTITY_TOLERANCE_CENTS, 50);
  assert.deepEqual(GROUND_TRUTH_MELODY.map(({ label, startSec, endSec }) =>
    [label, startSec, endSec]), [
    ['A4', 0, 2], ['C5', 2, 4], ['E5', 4, 6], ['D5', 6, 8], ['A4', 8, 10],
  ]);
  assert.deepEqual(GROUND_TRUTH_BASS.map(({ label, startSec, endSec }) =>
    [label, startSec, endSec]), [
    ['A2', 0, 2.5], ['F2', 2.5, 5], ['C3', 5, 7.5], ['G2', 7.5, 10],
  ]);
});

test('cents identity calculation has explicit exact, tolerance, and octave behavior', () => {
  assert.ok(Math.abs(centsDistance(440, 440)) < 1e-12);
  assert.ok(Math.abs(centsDistance(440 * 2 ** (50 / 1200), 440) - 50) < 1e-9);
  assert.ok(Math.abs(centsDistance(220, 440) + 1200) < 1e-9);
  assert.ok(Math.abs(centsDistance(880, 440) - 1200) < 1e-9);
  assert.equal(classifyWrongPath(220, 440, 220), 'MELODY_OCTAVE_DOWN');
  assert.equal(classifyWrongPath(880, 440, 880), 'MELODY_OCTAVE_UP');
  assert.equal(classifyWrongPath(110, 523.25, 110), 'BASS_MATCH');
  assert.equal(classifyWrongPath(300, 440, 110), 'OTHER_PITCH');
});

test('melody-only and melody-plus-bass characterize candidate, path, and decision levels without quality gates', () => {
  const melodyOnlySignal = createMelodyPathCalibrationStimulus('MELODY_ONLY');
  const melodyPlusBassSignal = createMelodyPathCalibrationStimulus('MELODY_PLUS_BASS');
  const melodyOnly = analyze(melodyOnlySignal);
  const melodyPlusBass = analyze(melodyPlusBassSignal);
  const melodyOnlyReport = characterizeMelodyPath('MELODY_ONLY', melodyOnly.evidence);
  const melodyPlusBassReport = characterizeMelodyPath('MELODY_PLUS_BASS', melodyPlusBass.evidence);

  for (const { analysis, evidence } of [melodyOnly, melodyPlusBass]) {
    assert.equal(evidence.frameCount, analysis.contour.length);
    assert.equal(MELODY_ANALYSIS.analysisSampleRate, CALIBRATION_SAMPLE_RATE);
    assert.equal(evidence.track.acceptedNoteCount, analysis.notes.length);
  }
  for (const report of [melodyOnlyReport, melodyPlusBassReport]) {
    assert.ok(report.metrics.frames > 0);
    assert.equal(report.segments.length, GROUND_TRUTH_MELODY.length);
    assert.equal(report.metrics.frames, report.segments.reduce((sum, segment) => sum + segment.metrics.frames, 0));
    assert.equal(report.metrics.pathMatches + report.metrics.wrongSelectedPaths + report.metrics.nullPaths,
      report.metrics.frames);
    assert.equal(Object.values(report.metrics.wrongPaths).reduce((sum, count) => sum + count, 0),
      report.metrics.wrongSelectedPaths);
    assert.ok(report.metrics.wrongPathWithMelodyCandidate <= report.metrics.wrongSelectedPaths);
    assert.ok(report.metrics.pathMatches <= report.metrics.candidateMatches);
    assert.ok(report.metrics.correctPathAccepted <= report.metrics.pathMatches);
    assert.match(formatMelodyPathCharacterization(report), /path \| candidate exists/);
  }

  // The calibration harness consumes the compact public evidence seam: sampled path and
  // decision fields must remain identical to the analyzer's retained contour at each index.
  melodyPlusBass.analysis.contour.forEach((contour, index) => {
    const time = index * MELODY_ANALYSIS.hopSize / MELODY_ANALYSIS.analysisSampleRate
      + MELODY_ANALYSIS.frameSize / 2 / MELODY_ANALYSIS.analysisSampleRate
      + MELODY_ANALYSIS.hopSize / MELODY_ANALYSIS.analysisSampleRate / 4;
    const evidence = selectMelodyEvidence(melodyPlusBass.evidence, time)!;
    assert.equal(evidence.frameIndex, index);
    assert.equal(evidence.voiced, contour.voiced);
    if (contour.voiced) {
      assert.ok(Math.abs(evidence.finalConfidence - contour.confidence) < 1e-5);
      assert.ok(Math.abs(evidence.finalPitchHz! - contour.pitchHz!) < 1e-2);
    } else {
      assert.equal(contour.pitchHz, null);
      assert.notEqual(evidence.reason, 'VOICED');
    }
  });

  // Characterization values are reported, not constrained to a desired algorithm score.
  console.log(`\n${formatMelodyPathCharacterization(melodyOnlyReport)}\n\n${
    formatMelodyPathCharacterization(melodyPlusBassReport)}\n`);
});

test('calibration evidence collection remains analysis-equivalent', () => {
  const signal = createMelodyPathCalibrationStimulus('MELODY_PLUS_BASS');
  const ordinary = analyzeMelody({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE });
  const observed = analyze(signal);
  assert.deepEqual(observed.analysis, ordinary);
});
