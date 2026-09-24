import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeMelody, analyzeMelodyWithEvidence, MELODY_ANALYSIS } from '@computational-listening/engine';
import { analyzeMelodyWithDpDiagnostics, analyzeMelodyWithNoCliffExperiment } from '@computational-listening/engine/diagnostics';
import type { MelodyAnalysisWithDpDiagnostics } from '@computational-listening/engine/diagnostics';
import type { MelodyDpFrameDiagnostic, MelodyDpStateDiagnostic } from '@computational-listening/engine/diagnostics';
import { selectMelodyEvidence } from '@computational-listening/engine';
import {
  BASS_AMPLITUDE_MATRIX, CALIBRATION_SAMPLE_RATE, characterizeMelodyPath, classifyWrongPath,
  createMelodyCompetitionStimulus, GROUND_TRUTH_BASS, GROUND_TRUTH_MELODY,
  matchesPitchIdentity, TRANSITION_MARGIN_SECONDS,
} from './melodyPathIdentityCalibration.ts';

type Variant = 'BASELINE' | 'NO_CLIFF';
type Status = 'CORRECT' | 'WRONG' | 'NULL';

const analyzeVariant = (signal: Float32Array, variant: Variant) => variant === 'BASELINE'
  ? analyzeMelodyWithDpDiagnostics({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE })
  : analyzeMelodyWithNoCliffExperiment({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE });

function truthAt(time: number, margin: number) {
  const segmentIndex = GROUND_TRUTH_MELODY.findIndex(segment =>
    time >= segment.startSec + margin && time <= segment.endSec - margin);
  if (segmentIndex < 0) return null;
  const melody = GROUND_TRUTH_MELODY[segmentIndex];
  const bass = GROUND_TRUTH_BASS.find(segment => time >= segment.startSec && time < segment.endSec)!;
  return { segmentIndex, melody, bass };
}

function frameStatus(frame: MelodyDpFrameDiagnostic, margin: number): Status | null {
  const truth = truthAt(frame.time, margin);
  if (!truth) return null;
  const selected = frame.states[frame.selectedPathStateIndex];
  return selected.pitchHz === null ? 'NULL'
    : matchesPitchIdentity(selected.pitchHz, truth.melody.frequencyHz) ? 'CORRECT' : 'WRONG';
}

function runMetrics(frames: readonly MelodyDpFrameDiagnostic[]) {
  const classified = frames.flatMap(frame => {
    const truth = truthAt(frame.time, 0);
    const status = frameStatus(frame, 0);
    return truth && status ? [{ frame, segmentIndex: truth.segmentIndex, status }] : [];
  });
  const runs: { status: Status; length: number; segments: number[] }[] = [];
  let correctToWrong = 0;
  let wrongToCorrect = 0;
  classified.forEach((item, index) => {
    const previousFrame = classified[index - 1];
    if (previousFrame?.frame.frameIndex + 1 === item.frame.frameIndex) {
      if (previousFrame.status === 'CORRECT' && item.status === 'WRONG') correctToWrong += 1;
      if (previousFrame.status === 'WRONG' && item.status === 'CORRECT') wrongToCorrect += 1;
    }
    const run = runs.at(-1);
    if (run && run.status === item.status) {
      run.length += 1;
      if (!run.segments.includes(item.segmentIndex)) run.segments.push(item.segmentIndex);
    } else runs.push({ status: item.status, length: 1, segments: [item.segmentIndex] });
  });
  const correct = runs.filter(run => run.status === 'CORRECT');
  const wrong = runs.filter(run => run.status === 'WRONG');
  return Object.freeze({
    correctRuns: correct.length,
    wrongRuns: wrong.length,
    longestCorrect: Math.max(0, ...correct.map(run => run.length)),
    longestWrong: Math.max(0, ...wrong.map(run => run.length)),
    wrongAcrossBoundaries: wrong.filter(run => run.segments.length > 1).length,
    correctToWrong,
    wrongToCorrect,
  });
}

function candidateEvidence(result: MelodyAnalysisWithDpDiagnostics) {
  return result.dpDiagnostics.frames.map(frame => ({
    time: frame.time,
    rms: frame.rms,
    candidates: frame.states.slice(1).map(state => ({
      index: state.candidateIndex,
      pitchHz: state.pitchHz,
      score: state.candidateScore,
    })),
    publicEvidence: (() => {
      const observation = selectMelodyEvidence(result.evidence,
        frame.time + MELODY_ANALYSIS.hopSize / MELODY_ANALYSIS.analysisSampleRate / 4)!;
      return {
        generation: observation.generation,
        outOfRangeCandidateCount: observation.outOfRangeCandidateCount,
        rejectedCandidates: observation.rejectedCandidates,
      };
    })(),
  }));
}

function evaluate(amplitude: number, variant: Variant) {
  const signal = createMelodyCompetitionStimulus(amplitude, GROUND_TRUTH_BASS);
  const result = analyzeVariant(signal, variant);
  const matrix = characterizeMelodyPath(`${variant}_${amplitude.toFixed(2)}`, result.evidence, GROUND_TRUTH_BASS);
  const eligible = result.dpDiagnostics.frames.flatMap(frame => {
    const truth = truthAt(frame.time, TRANSITION_MARGIN_SECONDS);
    if (!truth) return [];
    const melodyState = frame.states.slice(1).find(state =>
      matchesPitchIdentity(state.pitchHz, truth.melody.frequencyHz));
    if (!melodyState) return [];
    const localBest = frame.localBestCandidateStateIndex === null ? null
      : frame.states[frame.localBestCandidateStateIndex];
    const selected = frame.states[frame.selectedPathStateIndex];
    return [{ frame, truth, melodyState, localBest, selected }];
  });
  const localMelody = eligible.filter(item => matchesPitchIdentity(item.localBest?.pitchHz ?? null,
    item.truth.melody.frequencyHz)).length;
  const firstDivergence = eligible.find(item => !matchesPitchIdentity(item.selected.pitchHz,
    item.truth.melody.frequencyHz)) ?? null;
  return { amplitude, variant, signal, result, matrix, eligible, localMelody,
    runs: runMetrics(result.dpDiagnostics.frames), firstDivergence };
}

type AbPair = Readonly<{
  baseline: ReturnType<typeof evaluate>;
  noCliff: ReturnType<typeof evaluate>;
}>;

let cachedPairs: readonly AbPair[] | null = null;
function matrixPairs() {
  cachedPairs ??= Object.freeze(BASS_AMPLITUDE_MATRIX.map(amplitude => Object.freeze({
    baseline: evaluate(amplitude, 'BASELINE'),
    noCliff: evaluate(amplitude, 'NO_CLIFF'),
  })));
  return cachedPairs;
}

function assertCandidateIsolation(baseline: ReturnType<typeof evaluate>, noCliff: ReturnType<typeof evaluate>) {
  assert.deepEqual(candidateEvidence(noCliff.result), candidateEvidence(baseline.result));
  assert.equal(noCliff.matrix.metrics.candidateMatches, baseline.matrix.metrics.candidateMatches);
  for (let frameIndex = 0; frameIndex < baseline.result.dpDiagnostics.frames.length; frameIndex += 1) {
    const baseStates = baseline.result.dpDiagnostics.frames[frameIndex].states;
    const experimentStates = noCliff.result.dpDiagnostics.frames[frameIndex].states;
    assert.equal(baseStates.length, experimentStates.length);
    for (let stateIndex = 1; stateIndex < baseStates.length; stateIndex += 1) {
      const base = baseStates[stateIndex];
      const experiment = experimentStates[stateIndex];
      assert.equal(experiment.pitchHz, base.pitchHz);
      assert.equal(experiment.candidateScore, base.candidateScore);
      const expectedDelta = base.candidateScore! < MELODY_ANALYSIS.voicingThreshold ? 0.22 : 0;
      assert.ok(Math.abs((experiment.localContribution - base.localContribution) - expectedDelta) < 1e-12);
    }
    assert.equal(experimentStates[0].localContribution, baseStates[0].localContribution);
  }
}

const percent = (numerator: number, denominator: number) => `${(numerator / denominator * 100).toFixed(1)}%`;
const optionalPercent = (value: number | null) => value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`;

function abLine(baseline: ReturnType<typeof evaluate>, noCliff: ReturnType<typeof evaluate>) {
  const base = baseline.matrix.metrics;
  const experiment = noCliff.matrix.metrics;
  return `${baseline.amplitude.toFixed(2)}`
    + ` | cand ${base.candidateMatches}/${base.frames} ${percent(base.candidateMatches, base.frames)}`
    + ` | local ${baseline.localMelody}/${base.frames} ${percent(baseline.localMelody, base.frames)}`
    + ` -> ${noCliff.localMelody}/${experiment.frames} ${percent(noCliff.localMelody, experiment.frames)}`
    + ` | path ${base.pathMatches}/${base.frames} ${percent(base.pathMatches, base.frames)}`
    + ` -> ${experiment.pathMatches}/${experiment.frames} ${percent(experiment.pathMatches, experiment.frames)}`
    + ` | path|cand ${optionalPercent(base.conditionalPathIdentity)}`
    + ` -> ${optionalPercent(experiment.conditionalPathIdentity)}`
    + ` | accepted ${base.correctPathAccepted}/${base.pathMatches} ${optionalPercent(base.melodyMatchAcceptedRate)}`
    + ` -> ${experiment.correctPathAccepted}/${experiment.pathMatches}`
    + ` ${optionalPercent(experiment.melodyMatchAcceptedRate)}`;
}

function wrongLine(label: string, evaluation: ReturnType<typeof evaluate>) {
  const metrics = evaluation.matrix.metrics;
  return `${label}: down=${metrics.wrongPaths.MELODY_OCTAVE_DOWN}`
    + ` up=${metrics.wrongPaths.MELODY_OCTAVE_UP} bass=${metrics.wrongPaths.BASS_MATCH}`
    + ` other=${metrics.wrongPaths.OTHER_PITCH} null=${metrics.nullPaths}`;
}

function divergenceLine(label: string, evaluation: ReturnType<typeof evaluate>) {
  const item = evaluation.firstDivergence;
  if (!item) return `${label}: NONE`;
  const winnerMargin = item.selected.objectiveThroughState - item.melodyState.objectiveThroughState;
  return `${label}: frame=${item.frame.frameIndex} time=${item.frame.time.toFixed(6)}`
    + ` melodyHz=${item.truth.melody.frequencyHz.toFixed(2)}`
    + ` selectedHz=${item.selected.pitchHz?.toFixed(3) ?? 'NULL'}`
    + ` melodyScore=${item.melodyState.candidateScore!.toFixed(6)}`
    + ` winnerScore=${item.selected.candidateScore?.toFixed(6) ?? 'NULL'}`
    + ` melodyLocal=${item.melodyState.localContribution.toFixed(6)}`
    + ` winnerLocal=${item.selected.localContribution.toFixed(6)}`
    + ` winnerMargin=${winnerMargin.toFixed(6)}`;
}

function seededNoise(seconds: number, gain: number, seed: number) {
  let state = seed >>> 0;
  return Float32Array.from({ length: Math.floor(CALIBRATION_SAMPLE_RATE * seconds) }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return ((state / 0xffffffff) * 2 - 1) * gain;
  });
}

function tone(frequency: number, seconds: number, gain: number) {
  return Float32Array.from({ length: Math.floor(CALIBRATION_SAMPLE_RATE * seconds) }, (_, index) =>
    gain * Math.sin(2 * Math.PI * frequency * index / CALIBRATION_SAMPLE_RATE));
}

function controlSummary(label: string, signal: Float32Array) {
  const baseline = analyzeVariant(signal, 'BASELINE');
  const noCliff = analyzeVariant(signal, 'NO_CLIFF');
  assert.deepEqual(candidateEvidence(noCliff), candidateEvidence(baseline));
  const summarize = (result: MelodyAnalysisWithDpDiagnostics) => {
    const selected = result.dpDiagnostics.frames.map(frame => frame.states[frame.selectedPathStateIndex]);
    let switches = 0;
    for (let index = 1; index < selected.length; index += 1) {
      if (selected[index - 1].midiFloat !== null && selected[index].midiFloat !== null
        && Math.abs(selected[index - 1].midiFloat! - selected[index].midiFloat!) > 0.5) switches += 1;
    }
    return {
      voicedFrames: result.analysis.contour.filter(frame => frame.voiced).length,
      acceptedNotes: result.evidence.track.acceptedNoteCount,
      notesBeforeTrackGate: result.evidence.track.noteCountBeforeTrackGate,
      available: result.analysis.available,
      trackConfidence: result.analysis.confidence,
      nonNullPathFrames: selected.filter(state => state.pitchHz !== null).length,
      lowScoreSelectedFrames: selected.filter(state => state.candidateScore !== null
        && state.candidateScore < MELODY_ANALYSIS.voicingThreshold).length,
      pathSwitches: switches,
    };
  };
  return { label, baseline: summarize(baseline), noCliff: summarize(noCliff) };
}

test('NO_CLIFF changes only sub-threshold candidate local contribution and preserves candidate evidence', () => {
  for (const { baseline, noCliff } of matrixPairs()) {
    assert.equal(baseline.result.dpDiagnostics.localObjectiveVariant, 'BASELINE');
    assert.equal(noCliff.result.dpDiagnostics.localObjectiveVariant, 'NO_CLIFF');
    assertCandidateIsolation(baseline, noCliff);
  }
});

test('full amplitude A/B remains deterministic and reports path, decision, run, and divergence effects', () => {
  const pairs = matrixPairs();
  pairs.forEach(({ baseline, noCliff }) => assertCandidateIsolation(baseline, noCliff));

  // Existing baseline snapshot is a behavioral drift detector, not an accuracy target.
  assert.deepEqual(pairs.map(({ baseline }) => baseline.matrix.metrics.pathMatches),
    [500, 500, 500, 352, 51, 0, 0, 0, 0]);
  assert.deepEqual(pairs.map(({ baseline }) => baseline.matrix.metrics.candidateMatches),
    [500, 500, 500, 500, 500, 500, 500, 158, 59]);

  const selectedPairs = pairs.filter(({ baseline }) => baseline.amplitude === 0.20
    || baseline.amplitude === 0.25);
  const deltaLines = pairs.map(({ baseline, noCliff }) => {
    const denominator = baseline.matrix.metrics.frames;
    const localDelta = (noCliff.localMelody - baseline.localMelody) / denominator;
    const pathDelta = (noCliff.matrix.metrics.pathMatches - baseline.matrix.metrics.pathMatches) / denominator;
    const conditionalDelta = noCliff.matrix.metrics.conditionalPathIdentity === null
      || baseline.matrix.metrics.conditionalPathIdentity === null ? null
      : noCliff.matrix.metrics.conditionalPathIdentity - baseline.matrix.metrics.conditionalPathIdentity;
    const signed = (value: number | null) => value === null ? 'N/A'
      : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}pp`;
    return `${baseline.amplitude.toFixed(2)} local=${signed(localDelta)}`
      + ` path=${signed(pathDelta)} conditional=${signed(conditionalDelta)}`;
  });
  const runLines = selectedPairs.flatMap(({ baseline, noCliff }) => [
    `${baseline.amplitude.toFixed(2)} BASELINE ${JSON.stringify(baseline.runs)}`,
    `${baseline.amplitude.toFixed(2)} NO_CLIFF ${JSON.stringify(noCliff.runs)}`,
  ]);
  console.log(['\nMELODY LOCAL OBJECTIVE A/B',
    'amp | candidate | local baseline -> no_cliff | path baseline -> no_cliff | path|candidate | accepted/path',
    ...pairs.map(({ baseline, noCliff }) => abLine(baseline, noCliff)),
    '', 'DELTAS', ...deltaLines,
    '', 'WRONG PATHS', ...pairs.flatMap(({ baseline, noCliff }) => [
      wrongLine(`${baseline.amplitude.toFixed(2)} BASELINE`, baseline),
      wrongLine(`${baseline.amplitude.toFixed(2)} NO_CLIFF`, noCliff),
    ]),
    '', 'RUNS', ...runLines,
    '', 'FIRST DIVERGENCE', ...selectedPairs.flatMap(({ baseline, noCliff }) => [
      divergenceLine(`${baseline.amplitude.toFixed(2)} BASELINE`, baseline),
      divergenceLine(`${baseline.amplitude.toFixed(2)} NO_CLIFF`, noCliff),
    ]), '\n'].join('\n'));
});

test('melody-only and weak-material controls keep downstream decisions separate', () => {
  const lowToneGain = MELODY_ANALYSIS.minimumRms * Math.SQRT2 * 1.02;
  const noise = seededNoise(1, 0.45, 0x12345678);
  let ambiguousState = 1;
  const ambiguous = Float32Array.from({ length: CALIBRATION_SAMPLE_RATE }, (_, index) => {
    ambiguousState = (Math.imul(ambiguousState, 1664525) + 1013904223) >>> 0;
    return 0.01 * Math.sin(2 * Math.PI * 440 * index / CALIBRATION_SAMPLE_RATE)
      + 0.01 * ((ambiguousState / 0xffffffff) * 2 - 1);
  });
  const controls = [
    controlSummary('MELODY_ONLY', createMelodyCompetitionStimulus(0, GROUND_TRUTH_BASS)),
    controlSummary('SILENCE', new Float32Array(CALIBRATION_SAMPLE_RATE)),
    controlSummary(`LOW_TONE gain=${lowToneGain.toFixed(8)}`, tone(440, 1, lowToneGain)),
    controlSummary('DETERMINISTIC_NOISE', noise),
    controlSummary('WEAK_AMBIGUOUS_PERIODIC', ambiguous),
  ];
  console.log(['\nLOCAL OBJECTIVE REGRESSION CONTROLS', ...controls.map(control =>
    `${control.label}\n  BASELINE ${JSON.stringify(control.baseline)}\n  NO_CLIFF ${JSON.stringify(control.noCliff)}`), '\n'].join('\n'));
});

test('production entry points remain baseline and baseline analysis equivalence is exact', () => {
  const signal = createMelodyCompetitionStimulus(0.20, GROUND_TRUTH_BASS);
  const ordinary = analyzeMelody({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE });
  const evidence = analyzeMelodyWithEvidence({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE });
  const diagnostic = analyzeMelodyWithDpDiagnostics({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE });
  assert.equal(diagnostic.dpDiagnostics.localObjectiveVariant, 'BASELINE');
  assert.deepEqual(evidence.analysis, ordinary);
  assert.deepEqual(diagnostic.analysis, ordinary);
  assert.deepEqual(diagnostic.evidence, evidence.evidence);
});
