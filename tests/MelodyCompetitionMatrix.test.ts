import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeMelody, analyzeMelodyWithEvidence } from '../src/listening-engine/index.ts';
import type { MelodyEvidenceTimeline } from '../src/listening-engine/index.ts';
import {
  BASS_AMPLITUDE_MATRIX, CALIBRATION_SAMPLE_RATE, characterizeMelodyPath,
  createMelodyCompetitionStimulus, GROUND_TRUTH_BASS, GROUND_TRUTH_MELODY,
  melodyBassRelationships, NON_OCTAVE_CONTROL_BASS,
} from './melodyPathIdentityCalibration.ts';
import type {
  CalibrationMetrics, GroundTruthBassSegment, MelodyPathCharacterization,
} from './melodyPathIdentityCalibration.ts';

type MatrixEntry = Readonly<{
  amplitude: number;
  bassKind: 'ORIGINAL' | 'NON_OCTAVE';
  signal: Float32Array;
  evidence: MelodyEvidenceTimeline;
  report: MelodyPathCharacterization;
}>;

const analyzeCondition = (amplitude: number, bassKind: MatrixEntry['bassKind'],
  bassTimeline: readonly GroundTruthBassSegment[]): MatrixEntry => {
  const signal = createMelodyCompetitionStimulus(amplitude, bassTimeline);
  const { evidence } = analyzeMelodyWithEvidence({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE });
  return Object.freeze({
    amplitude,
    bassKind,
    signal,
    evidence,
    report: characterizeMelodyPath(`${bassKind}_${amplitude.toFixed(2)}`, evidence, bassTimeline),
  });
};

const percent = (value: number | null) => value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`;
const signedPoints = (value: number | null) => value === null ? 'N/A'
  : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}pp`;

function metricDelta(before: number | null, after: number | null) {
  return before === null || after === null ? null : after - before;
}

function wrongPathSummary(metrics: CalibrationMetrics) {
  const share = (count: number) => percent(metrics.wrongSelectedPaths
    ? count / metrics.wrongSelectedPaths : null);
  return `down ${metrics.wrongPaths.MELODY_OCTAVE_DOWN} ${share(metrics.wrongPaths.MELODY_OCTAVE_DOWN)}`
    + ` | up ${metrics.wrongPaths.MELODY_OCTAVE_UP} ${share(metrics.wrongPaths.MELODY_OCTAVE_UP)}`
    + ` | bass ${metrics.wrongPaths.BASS_MATCH} ${share(metrics.wrongPaths.BASS_MATCH)}`
    + ` | other ${metrics.wrongPaths.OTHER_PITCH} ${share(metrics.wrongPaths.OTHER_PITCH)}`
    + ` | null ${metrics.nullPaths}`;
}

function verifyCounts(metrics: CalibrationMetrics) {
  assert.equal(metrics.pathMatches + metrics.wrongSelectedPaths + metrics.nullPaths, metrics.frames);
  assert.equal(Object.values(metrics.wrongPaths).reduce((sum, count) => sum + count, 0),
    metrics.wrongSelectedPaths);
  assert.equal(metrics.candidateRecall, metrics.candidateMatches / metrics.frames);
  assert.equal(metrics.pathIdentityAccuracy, metrics.pathMatches / metrics.frames);
  assert.equal(metrics.conditionalPathIdentity,
    metrics.candidateMatches ? metrics.pathMatches / metrics.candidateMatches : null);
  assert.equal(metrics.melodyMatchAcceptedRate,
    metrics.pathMatches ? metrics.correctPathAccepted / metrics.pathMatches : null);
}

function compactEntry(entry: MatrixEntry) {
  const metrics = entry.report.metrics;
  return `${entry.amplitude.toFixed(2)} | ${metrics.candidateMatches}/${metrics.frames} ${percent(metrics.candidateRecall)}`
    + ` | ${metrics.pathMatches}/${metrics.frames} ${percent(metrics.pathIdentityAccuracy)}`
    + ` | ${metrics.pathMatches}/${metrics.candidateMatches} ${percent(metrics.conditionalPathIdentity)}`
    + ` | ${metrics.correctPathAccepted}/${metrics.pathMatches} ${percent(metrics.melodyMatchAcceptedRate)}`;
}

test('competition matrix definitions are exact, deterministic, and retain the v0.1 ground truth', () => {
  assert.deepEqual(BASS_AMPLITUDE_MATRIX, [0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.36, 0.42]);
  assert.deepEqual(GROUND_TRUTH_BASS.map(({ frequencyHz, startSec, endSec }) =>
    [frequencyHz, startSec, endSec]), [
    [110, 0, 2.5], [87.31, 2.5, 5], [130.81, 5, 7.5], [98, 7.5, 10],
  ]);
  assert.deepEqual(NON_OCTAVE_CONTROL_BASS.map(({ frequencyHz, startSec, endSec }) =>
    [frequencyHz, startSec, endSec]), [
    [114.54, 0, 2.5], [90.91, 2.5, 5], [136.20, 5, 7.5], [102.04, 7.5, 10],
  ]);
  for (const amplitude of BASS_AMPLITUDE_MATRIX) {
    assert.deepEqual(createMelodyCompetitionStimulus(amplitude, GROUND_TRUTH_BASS),
      createMelodyCompetitionStimulus(amplitude, GROUND_TRUTH_BASS));
  }
  for (const relationship of melodyBassRelationships(NON_OCTAVE_CONTROL_BASS)) {
    const ratio = relationship.ratio;
    assert.ok(Math.abs(ratio - Math.round(ratio)) > 0.05);
    assert.ok(Math.abs(Math.log2(ratio) - Math.round(Math.log2(ratio))) > 0.03);
  }
});

test('bass amplitude matrix and relationship controls preserve raw deterministic characterization', () => {
  const original = BASS_AMPLITUDE_MATRIX.map(amplitude =>
    analyzeCondition(amplitude, 'ORIGINAL', GROUND_TRUTH_BASS));
  const controls = [0.20, 0.36].map(amplitude =>
    analyzeCondition(amplitude, 'NON_OCTAVE', NON_OCTAVE_CONTROL_BASS));

  for (const entry of [...original, ...controls]) {
    verifyCounts(entry.report.metrics);
    assert.deepEqual(characterizeMelodyPath(entry.report.condition, entry.evidence,
      entry.bassKind === 'ORIGINAL' ? GROUND_TRUTH_BASS : NON_OCTAVE_CONTROL_BASS), entry.report);
    assert.equal(entry.report.segments.length, GROUND_TRUTH_MELODY.length);
    assert.equal(entry.report.metrics.frames,
      entry.report.segments.reduce((sum, segment) => sum + segment.metrics.frames, 0));
    for (const segment of entry.report.segments) verifyCounts(segment.metrics);
  }

  const deltas = original.slice(1).map((entry, index) => ({
    from: original[index].amplitude,
    to: entry.amplitude,
    candidateRecall: metricDelta(original[index].report.metrics.candidateRecall,
      entry.report.metrics.candidateRecall),
    pathIdentity: metricDelta(original[index].report.metrics.pathIdentityAccuracy,
      entry.report.metrics.pathIdentityAccuracy),
    conditionalPathIdentity: metricDelta(original[index].report.metrics.conditionalPathIdentity,
      entry.report.metrics.conditionalPathIdentity),
  }));

  const relationshipLines = (bass: readonly GroundTruthBassSegment[]) => melodyBassRelationships(bass)
    .map(row => `${row.startSec.toFixed(1)}-${row.endSec.toFixed(1)} ${row.melodyLabel} ${row.melodyHz.toFixed(2)}`
      + ` / ${row.bassLabel} ${row.bassHz.toFixed(2)} = ${row.ratio.toFixed(4)}`);
  const wrongLines = original.map(entry => {
    return `${entry.amplitude.toFixed(2)} | ${wrongPathSummary(entry.report.metrics)}`;
  });
  const segmentLines = original.flatMap(entry => entry.report.segments.map(segment =>
    `${entry.amplitude.toFixed(2)} ${segment.label} ${segment.startSec.toFixed(0)}-${segment.endSec.toFixed(0)}`
      + ` | cand ${segment.metrics.candidateMatches}/${segment.metrics.frames} ${percent(segment.metrics.candidateRecall)}`
      + ` | path ${segment.metrics.pathMatches}/${segment.metrics.frames} ${percent(segment.metrics.pathIdentityAccuracy)}`
      + ` | path|cand ${segment.metrics.pathMatches}/${segment.metrics.candidateMatches}`
      + ` ${percent(segment.metrics.conditionalPathIdentity)}`));
  const controlLines = [0.20, 0.36].flatMap(amplitude => {
    const baseline = original.find(entry => entry.amplitude === amplitude)!;
    const control = controls.find(entry => entry.amplitude === amplitude)!;
    return [`${amplitude.toFixed(2)} ORIGINAL ${compactEntry(baseline)}`,
      `  wrong | ${wrongPathSummary(baseline.report.metrics)}`,
      `${amplitude.toFixed(2)} NON_OCTAVE ${compactEntry(control)}`,
      `  wrong | ${wrongPathSummary(control.report.metrics)}`];
  });
  const deltaLines = deltas.map(delta => `${delta.from.toFixed(2)} -> ${delta.to.toFixed(2)}`
    + ` | candidate ${signedPoints(delta.candidateRecall)}`
    + ` | path ${signedPoints(delta.pathIdentity)}`
    + ` | path|candidate ${signedPoints(delta.conditionalPathIdentity)}`);

  console.log(['\nMELODY COMPETITION MATRIX',
    'amp | candidate count/rate | path count/rate | path/candidate | accepted/path',
    ...original.map(compactEntry),
    '', 'WRONG PATH DISTRIBUTION (absolute counts)', ...wrongLines,
    '', 'PER SEGMENT', ...segmentLines,
    '', 'ADJACENT CHANGES', ...deltaLines,
    '', 'RELATIONSHIP CONTROL', ...controlLines,
    '', 'ORIGINAL FREQUENCY RATIOS', ...relationshipLines(GROUND_TRUTH_BASS),
    '', 'NON-OCTAVE FREQUENCY RATIOS', ...relationshipLines(NON_OCTAVE_CONTROL_BASS), '\n'].join('\n'));
});

test('non-octave competition evidence collection remains analysis-equivalent', () => {
  const signal = createMelodyCompetitionStimulus(0.36, NON_OCTAVE_CONTROL_BASS);
  const ordinary = analyzeMelody({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE });
  const observed = analyzeMelodyWithEvidence({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE });
  assert.deepEqual(observed.analysis, ordinary);
});
