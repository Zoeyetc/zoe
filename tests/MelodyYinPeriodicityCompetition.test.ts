import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeMelody, analyzeMelodyWithEvidence, MELODY_ANALYSIS } from '../src/listening-engine/index.ts';
import { analyzeMelodyWithDpDiagnostics, inspectMelodyYinFrame } from '../src/listening-engine/diagnostics/index.ts';
import type {
  MelodyCandidateScoreDiagnostic, MelodyDpFrameDiagnostic, MelodyYinFrameDiagnostic,
  MelodyYinLagPointDiagnostic,
} from '../src/listening-engine/diagnostics/index.ts';
import {
  CALIBRATION_SAMPLE_RATE, createBassOnlyCompetitionStimulus, createMelodyCompetitionStimulus,
  GROUND_TRUTH_BASS, GROUND_TRUTH_MELODY, matchesPitchIdentity, NON_OCTAVE_CONTROL_BASS,
} from './melodyPathIdentityCalibration.ts';

const MATCHED_FRAME = 8;
const ORIGINAL_AMPLITUDES = Object.freeze([0, 0.05, 0.10, 0.15, 0.20, 0.25] as const);

function scoreDiagnostic(frame: MelodyDpFrameDiagnostic, integerLag: number) {
  return frame.states.slice(1).map(state => state.candidateScoreDiagnostic)
    .find((item): item is MelodyCandidateScoreDiagnostic => item?.integerLag === integerLag) ?? null;
}

function pointAtLag(yin: MelodyYinFrameDiagnostic, lag: number) {
  const point = yin.lagPoints.find(item => item.lag === lag);
  assert.ok(point);
  return point;
}

function nearestMinimum(yin: MelodyYinFrameDiagnostic, expectedLag: number) {
  return yin.lagPoints.filter(point => point.isLocalMinimum && Math.abs(point.lag - expectedLag) <= 1)
    .reduce<MelodyYinLagPointDiagnostic | null>(
    (best, point) => !best || Math.abs(point.lag - expectedLag) < Math.abs(best.lag - expectedLag) ? point : best,
    null);
}

type Region = Readonly<{
  targetHz: number;
  expectedLag: number;
  sampled: MelodyYinLagPointDiagnostic;
  minimum: MelodyYinLagPointDiagnostic | null;
  minimumLagDistance: number | null;
  emitted: MelodyCandidateScoreDiagnostic | null;
}>;

function inspectRegion(yin: MelodyYinFrameDiagnostic, frame: MelodyDpFrameDiagnostic, targetHz: number): Region {
  const expectedLag = MELODY_ANALYSIS.analysisSampleRate / targetHz;
  const sampledLag = Math.min(yin.maximumLag, Math.max(yin.minimumLag, Math.round(expectedLag)));
  const sampled = pointAtLag(yin, sampledLag);
  const minimum = nearestMinimum(yin, expectedLag);
  return Object.freeze({
    targetHz,
    expectedLag,
    sampled,
    minimum,
    minimumLagDistance: minimum ? Math.abs(minimum.lag - expectedLag) : null,
    emitted: minimum ? scoreDiagnostic(frame, minimum.lag) : null,
  });
}

function originalCondition(amplitude: typeof ORIGINAL_AMPLITUDES[number]) {
  const signal = createMelodyCompetitionStimulus(amplitude, GROUND_TRUTH_BASS);
  const result = analyzeMelodyWithDpDiagnostics({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE });
  const yin = inspectMelodyYinFrame({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE }, MATCHED_FRAME);
  const frame = result.dpDiagnostics.frames[MATCHED_FRAME];
  return { label: amplitude === 0 ? 'MELODY_ONLY' : `BASS_${amplitude.toFixed(2)}`, amplitude, signal,
    result, yin, frame };
}

let originalsCache: readonly ReturnType<typeof originalCondition>[] | null = null;
function originals() {
  originalsCache ??= Object.freeze(ORIGINAL_AMPLITUDES.map(originalCondition));
  return originalsCache;
}

function customCondition(label: string, signal: Float32Array) {
  const result = analyzeMelodyWithDpDiagnostics({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE });
  return { label, signal, result,
    yin: inspectMelodyYinFrame({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE }, MATCHED_FRAME),
    frame: result.dpDiagnostics.frames[MATCHED_FRAME] };
}

function formatRegion(region: Region) {
  const minimum = region.minimum;
  return `${region.targetHz.toFixed(2).padStart(7)} Hz expectedLag=${region.expectedLag.toFixed(3)}`
    + ` sampledLag=${region.sampled.lag} raw=${region.sampled.rawDifference.toFixed(9)}`
    + ` cumulative=${region.sampled.cumulativeDifference.toFixed(9)}`
    + ` periodicity=${region.sampled.periodicity.toFixed(9)}`
    + ` nearestMin=${minimum?.lag ?? 'NONE'} distance=${region.minimumLagDistance?.toFixed(3) ?? 'N/A'}`
    + ` minRaw=${minimum?.rawDifference.toFixed(9) ?? 'N/A'}`
    + ` minCumulative=${minimum?.cumulativeDifference.toFixed(9) ?? 'N/A'}`
    + ` minPeriodicity=${minimum?.periodicity.toFixed(9) ?? 'N/A'}`
    + ` emitted=${region.emitted ? 'YES' : 'NO'}`
    + ` score=${region.emitted?.score.toFixed(9) ?? 'N/A'}`;
}

function candidateLine(label: string, diagnostic: MelodyCandidateScoreDiagnostic) {
  return `${label} hz=${diagnostic.frequencyHz.toFixed(3)}`
    + ` integerLag=${diagnostic.integerLag} interpolatedLag=${diagnostic.interpolatedLag.toFixed(6)}`
    + ` raw=[${diagnostic.rawDifferenceLeft.toFixed(9)},${diagnostic.rawDifference.toFixed(9)},${diagnostic.rawDifferenceRight.toFixed(9)}]`
    + ` cumulative=[${diagnostic.cumulativeDifferenceLeft.toFixed(9)},${diagnostic.yinCumulativeDifference.toFixed(9)},${diagnostic.cumulativeDifferenceRight.toFixed(9)}]`
    + ` periodicity=${diagnostic.periodicity.toFixed(9)} score=${diagnostic.score.toFixed(9)}`
    + ` search=${diagnostic.candidateSearchMode}`;
}

test('lag-domain diagnostics are the exact values used by emitted candidates', () => {
  for (const condition of originals()) {
    assert.equal(condition.yin.frameIndex, MATCHED_FRAME);
    assert.equal(condition.yin.time, condition.frame.time);
    assert.equal(condition.yin.rms, condition.frame.rms);
    for (const state of condition.frame.states.slice(1)) {
      const diagnostic = state.candidateScoreDiagnostic;
      assert.ok(diagnostic);
      const point = pointAtLag(condition.yin, diagnostic.integerLag);
      assert.equal(point.rawDifference, diagnostic.rawDifference);
      assert.equal(point.cumulativeDifference, diagnostic.yinCumulativeDifference);
      assert.equal(point.periodicityUnclamped, diagnostic.periodicityUnclamped);
      assert.equal(point.periodicity, diagnostic.periodicity);
      assert.equal(pointAtLag(condition.yin, diagnostic.integerLag - 1).rawDifference,
        diagnostic.rawDifferenceLeft);
      assert.equal(pointAtLag(condition.yin, diagnostic.integerLag + 1).rawDifference,
        diagnostic.rawDifferenceRight);
      assert.equal(condition.yin.searchMode, diagnostic.candidateSearchMode);
      assert.equal(point.selectedForCandidateGeneration, true);
    }
    assert.deepEqual(inspectMelodyYinFrame({ mono: condition.signal, sampleRate: CALIBRATION_SAMPLE_RATE },
      MATCHED_FRAME), condition.yin);
  }
});

test('matched frame characterizes melody, octave-down, and bass lag regions across amplitudes', () => {
  const trajectory = originals().map(condition => ({
    label: condition.label,
    regions: [440, 220, 110].map(target => inspectRegion(condition.yin, condition.frame, target)),
  }));
  console.log(['\nYIN MATCHED FRAME AMPLITUDE TRAJECTORY', ...trajectory.flatMap(condition => [
    condition.label, ...condition.regions.map(formatRegion),
  ]), '\n'].join('\n'));

  const melodyPeriodicity = trajectory.map(item => item.regions[0].sampled.periodicity);
  const lowPeriodicity = trajectory.map(item => item.regions[2].sampled.periodicity);
  assert.deepEqual(melodyPeriodicity.map(value => value.toFixed(9)), [
    '0.998046433', '0.984318606', '0.943984980', '0.879466892', '0.794407385', '0.693189884',
  ]);
  assert.deepEqual(lowPeriodicity.map(value => value.toFixed(9)), [
    '0.999780866', '0.999783736', '0.999791887', '0.999804105', '0.999818839', '0.999834612',
  ]);
  assert.ok(melodyPeriodicity.every((value, index) => index === 0 || value < melodyPeriodicity[index - 1]));
  assert.ok(lowPeriodicity.every((value, index) => index === 0 || value >= lowPeriodicity[index - 1]));
});

test('single-source, mixed, and non-octave controls expose actual lag-domain evidence', () => {
  const bassOnly = customCondition('BASS_ONLY_0.20',
    createBassOnlyCompetitionStimulus(0.20, GROUND_TRUTH_BASS));
  const nonOctave = customCondition('NON_OCTAVE_0.20',
    createMelodyCompetitionStimulus(0.20, NON_OCTAVE_CONTROL_BASS));
  const selected = [originals()[0], bassOnly, originals()[2], originals()[4], originals()[5]];
  console.log(['\nYIN SOURCE / MIXTURE COMPARISON', ...selected.flatMap(condition => [condition.label,
    ...[440, 220, 110].map(target => formatRegion(inspectRegion(condition.yin, condition.frame, target))),
  ]), '', 'ORIGINAL 0.20 VS NON-OCTAVE 0.20',
  'ORIGINAL_0.20', ...[440, 220, 110].map(target =>
    formatRegion(inspectRegion(originals()[4].yin, originals()[4].frame, target))),
  nonOctave.label, ...[440, 220, 114.54, 110].map(target =>
    formatRegion(inspectRegion(nonOctave.yin, nonOctave.frame, target))), '\n'].join('\n'));

  const melodyOnly = originals()[0];
  for (const target of [220, 110]) {
    const region = inspectRegion(melodyOnly.yin, melodyOnly.frame, target);
    assert.ok(region.minimum);
    assert.ok(region.minimumLagDistance! < 1);
    assert.equal(region.minimum.isLocalMinimum, true);
  }
  assert.ok(inspectRegion(bassOnly.yin, bassOnly.frame, 110).sampled.periodicity > 0.999);
});

test('representative A4, C5, E5, and D5 frames compare melody and raw-score winner lags', () => {
  const condition = originals().find(item => item.amplitude === 0.20)!;
  const labels = ['A4', 'C5', 'E5', 'D5'] as const;
  const lines = ['\nYIN MULTI-SEGMENT REPRESENTATIVES'];
  const summary = labels.map(label => {
    const segment = GROUND_TRUTH_MELODY.find(item => item.label === label)!;
    const targetTime = (segment.startSec + segment.endSec) / 2;
    const frame = condition.result.dpDiagnostics.frames.reduce((best, current) =>
      Math.abs(current.time - targetTime) < Math.abs(best.time - targetTime) ? current : best);
    const melody = frame.states.slice(1).find(state => matchesPitchIdentity(state.pitchHz, segment.frequencyHz));
    assert.ok(melody?.candidateScoreDiagnostic);
    const winner = frame.states.slice(1).reduce((best, state) =>
      state.candidateScore! > best.candidateScore! ? state : best);
    assert.ok(winner.candidateScoreDiagnostic);
    lines.push(`${label} targetTime=${targetTime.toFixed(3)} frame=${frame.frameIndex} time=${frame.time.toFixed(6)}`,
      candidateLine('melody', melody.candidateScoreDiagnostic),
      candidateLine('winner', winner.candidateScoreDiagnostic));
    return {
      label,
      frame: frame.frameIndex,
      melodyLag: melody.candidateScoreDiagnostic.integerLag,
      winnerLag: winner.candidateScoreDiagnostic.integerLag,
      winnerHz: winner.candidateScoreDiagnostic.frequencyHz.toFixed(3),
    };
  });
  assert.deepEqual(summary, [
    { label: 'A4', frame: 57, melodyLag: 27, winnerLag: 109, winnerHz: '110.005' },
    { label: 'C5', frame: 182, melodyLag: 23, winnerLag: 138, winnerHz: '87.210' },
    { label: 'E5', frame: 307, melodyLag: 18, winnerLag: 18, winnerHz: '663.260' },
    { label: 'D5', frame: 432, melodyLag: 20, winnerLag: 82, winnerHz: '146.663' },
  ]);
  console.log(lines.join('\n'));
});

test('YIN diagnostics preserve production analysis and established score decomposition', () => {
  const condition = originals().find(item => item.amplitude === 0.20)!;
  const ordinary = analyzeMelody({ mono: condition.signal, sampleRate: CALIBRATION_SAMPLE_RATE });
  const evidence = analyzeMelodyWithEvidence({ mono: condition.signal, sampleRate: CALIBRATION_SAMPLE_RATE });
  assert.deepEqual(condition.result.analysis, ordinary);
  assert.deepEqual(condition.result.evidence, evidence.evidence);
  const melody = condition.frame.states.slice(1).find(state => matchesPitchIdentity(state.pitchHz, 440))!;
  const winner = condition.frame.states.slice(1).reduce((best, state) =>
    state.candidateScore! > best.candidateScore! ? state : best);
  assert.equal(melody.candidateScore?.toFixed(12), '0.537147586669');
  assert.equal(winner.candidateScore?.toFixed(12), '0.665955210809');
});
