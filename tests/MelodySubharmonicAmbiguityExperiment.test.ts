import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeMelody, analyzeMelodyWithEvidence, MELODY_ANALYSIS } from '../src/listening-engine/index.ts';
import { analyzeMelodyWithDpDiagnostics, analyzeMelodyWithSubharmonicAmbiguityExperiment, MELODY_SUBHARMONIC_AMBIGUITY } from '../src/listening-engine/diagnostics/index.ts';
import type { MelodyAnalysisWithDpDiagnostics, MelodySubharmonicAmbiguityPenalty } from '../src/listening-engine/diagnostics/index.ts';
import type { MelodyDpFrameDiagnostic, MelodyDpStateDiagnostic } from '../src/listening-engine/diagnostics/index.ts';
import {
  BASS_AMPLITUDE_MATRIX, CALIBRATION_SAMPLE_RATE, characterizeMelodyPath, classifyWrongPath,
  createMelodyCompetitionStimulus, GROUND_TRUTH_BASS, GROUND_TRUTH_MELODY,
  matchesPitchIdentity, NON_OCTAVE_CONTROL_BASS, TRANSITION_MARGIN_SECONDS,
} from './melodyPathIdentityCalibration.ts';

const PENALTIES = MELODY_SUBHARMONIC_AMBIGUITY.penalties;
type Penalty = MelodySubharmonicAmbiguityPenalty;

function truthAt(time: number, bassTimeline = GROUND_TRUTH_BASS) {
  const segmentIndex = GROUND_TRUTH_MELODY.findIndex(segment =>
    time >= segment.startSec + TRANSITION_MARGIN_SECONDS
    && time <= segment.endSec - TRANSITION_MARGIN_SECONDS);
  if (segmentIndex < 0) return null;
  const melody = GROUND_TRUTH_MELODY[segmentIndex];
  const bass = bassTimeline.find(segment => time >= segment.startSec && time < segment.endSec) ?? null;
  return { segmentIndex, melody, bass };
}

function candidateFingerprint(result: MelodyAnalysisWithDpDiagnostics) {
  return result.dpDiagnostics.frames.map(frame => frame.states.slice(1).map(state => ({
    pitchHz: state.pitchHz,
    midiFloat: state.midiFloat,
    originalScore: state.candidateScore,
    scoreDiagnostic: state.candidateScoreDiagnostic,
  })));
}

function analyze(signal: Float32Array, penalty: Penalty) {
  return analyzeMelodyWithSubharmonicAmbiguityExperiment({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE },
    { penalty });
}

function localBest(frame: MelodyDpFrameDiagnostic) {
  return frame.localBestCandidateStateIndex === null ? null : frame.states[frame.localBestCandidateStateIndex];
}

function selected(frame: MelodyDpFrameDiagnostic) {
  return frame.states[frame.selectedPathStateIndex];
}

function selectedStatus(frame: MelodyDpFrameDiagnostic, melodyHz: number) {
  const state = selected(frame);
  return state.pitchHz === null ? 'NULL' as const
    : matchesPitchIdentity(state.pitchHz, melodyHz) ? 'CORRECT' as const : 'WRONG' as const;
}

function applicationMetrics(result: MelodyAnalysisWithDpDiagnostics, penalty: Penalty,
  bassTimeline = GROUND_TRUTH_BASS) {
  let totalCandidates = 0;
  let ambiguityEligibleCandidates = 0;
  let penalizedCandidates = 0;
  let framesWithPenalizedCandidate = 0;
  let melodyCandidatesPenalized = 0;
  let wrongSelectedPenalized = 0;
  let correctSelectedPenalized = 0;
  let baselineWrongWithMelody = 0;
  let baselineWrongWinnerEligible = 0;
  let melodyCandidateEligible = 0;
  let melodyCandidateFrames = 0;
  for (const frame of result.dpDiagnostics.frames) {
    const truth = truthAt(frame.time, bassTimeline);
    if (!truth) continue;
    const candidates = frame.states.slice(1);
    totalCandidates += candidates.length;
    const eligible = candidates.filter(state => state.subharmonicAmbiguity?.eligible);
    ambiguityEligibleCandidates += eligible.length;
    if (penalty > 0) {
      penalizedCandidates += eligible.length;
      if (eligible.length) framesWithPenalizedCandidate += 1;
    }
    const melody = candidates.find(state => matchesPitchIdentity(state.pitchHz, truth.melody.frequencyHz));
    if (melody) {
      melodyCandidateFrames += 1;
      if (melody.subharmonicAmbiguity?.eligible) {
        melodyCandidateEligible += 1;
        if (penalty > 0) melodyCandidatesPenalized += 1;
      }
    }
    const winner = selected(frame);
    const winnerEligible = Boolean(winner.subharmonicAmbiguity?.eligible);
    if (winner.pitchHz !== null && matchesPitchIdentity(winner.pitchHz, truth.melody.frequencyHz)) {
      if (penalty > 0 && winnerEligible) correctSelectedPenalized += 1;
    } else if (winner.pitchHz !== null) {
      if (penalty > 0 && winnerEligible) wrongSelectedPenalized += 1;
      if (penalty === 0 && melody) {
        baselineWrongWithMelody += 1;
        if (winnerEligible) baselineWrongWinnerEligible += 1;
      }
    }
  }
  return Object.freeze({ totalCandidates, ambiguityEligibleCandidates, penalizedCandidates,
    framesWithPenalizedCandidate, melodyCandidatesPenalized, wrongSelectedPenalized,
    correctSelectedPenalized, baselineWrongWithMelody, baselineWrongWinnerEligible,
    melodyCandidateFrames, melodyCandidateEligible });
}

function runMetrics(result: MelodyAnalysisWithDpDiagnostics, bassTimeline = GROUND_TRUTH_BASS) {
  const classified = result.dpDiagnostics.frames.flatMap(frame => {
    const truth = truthAt(frame.time, bassTimeline);
    return truth ? [{ frame, segmentIndex: truth.segmentIndex,
      status: selectedStatus(frame, truth.melody.frequencyHz) }] : [];
  });
  const runs: { status: 'CORRECT' | 'WRONG' | 'NULL'; length: number; segments: number[] }[] = [];
  let correctToWrong = 0;
  let wrongToCorrect = 0;
  classified.forEach((item, index) => {
    const previous = classified[index - 1];
    if (previous?.frame.frameIndex + 1 === item.frame.frameIndex) {
      if (previous.status === 'CORRECT' && item.status === 'WRONG') correctToWrong += 1;
      if (previous.status === 'WRONG' && item.status === 'CORRECT') wrongToCorrect += 1;
    }
    const run = runs.at(-1);
    if (run?.status === item.status) {
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
    correctToWrong,
    wrongToCorrect,
    wrongAcrossBoundaries: wrong.filter(run => run.segments.length > 1).length,
  });
}

function firstDivergence(result: MelodyAnalysisWithDpDiagnostics, bassTimeline = GROUND_TRUTH_BASS) {
  for (const frame of result.dpDiagnostics.frames) {
    const truth = truthAt(frame.time, bassTimeline);
    if (!truth) continue;
    const melody = frame.states.slice(1).find(state => matchesPitchIdentity(state.pitchHz,
      truth.melody.frequencyHz));
    if (!melody) continue;
    const winner = selected(frame);
    if (matchesPitchIdentity(winner.pitchHz, truth.melody.frequencyHz)) continue;
    return Object.freeze({
      frameIndex: frame.frameIndex,
      time: frame.time,
      melodyHz: truth.melody.frequencyHz,
      selectedHz: winner.pitchHz,
      classification: winner.pitchHz === null ? 'NULL'
        : classifyWrongPath(winner.pitchHz, truth.melody.frequencyHz, truth.bass?.frequencyHz ?? null),
      melodyOriginalScore: melody.candidateScore,
      melodyExperimentalScore: melody.subharmonicAmbiguity?.experimentalCandidateScore ?? null,
      selectedOriginalScore: winner.candidateScore,
      selectedExperimentalScore: winner.subharmonicAmbiguity?.experimentalCandidateScore ?? null,
      winnerEligible: winner.subharmonicAmbiguity?.eligible ?? false,
      appliedPenalty: winner.subharmonicAmbiguity?.appliedPenalty ?? 0,
      dpWinnerMargin: winner.objectiveThroughState - melody.objectiveThroughState,
    });
  }
  return null;
}

function primaryEntry(amplitude: number, penalty: Penalty, bassTimeline = GROUND_TRUTH_BASS,
  label = 'ORIGINAL') {
  const signal = createMelodyCompetitionStimulus(amplitude, bassTimeline);
  const result = analyze(signal, penalty);
  const report = characterizeMelodyPath(`${label}_${amplitude}_${penalty}`, result.evidence, bassTimeline);
  const eligibleFrames = result.dpDiagnostics.frames.flatMap(frame => {
    const truth = truthAt(frame.time, bassTimeline);
    if (!truth) return [];
    const melody = frame.states.slice(1).find(state => matchesPitchIdentity(state.pitchHz,
      truth.melody.frequencyHz));
    if (!melody) return [];
    return [{ frame, truth, melody }];
  });
  const rawOriginalRank1 = eligibleFrames.filter(item => {
    const best = item.frame.states.slice(1).reduce((winner, state) =>
      state.candidateScore! > winner.candidateScore! ? state : winner);
    return matchesPitchIdentity(best.pitchHz, item.truth.melody.frequencyHz);
  }).length;
  const experimentalLocalBest = eligibleFrames.filter(item =>
    matchesPitchIdentity(localBest(item.frame)?.pitchHz ?? null, item.truth.melody.frequencyHz)).length;
  return Object.freeze({ amplitude, penalty, signal, result, report, rawOriginalRank1, experimentalLocalBest,
    application: applicationMetrics(result, penalty, bassTimeline),
    runs: runMetrics(result, bassTimeline), firstDivergence: firstDivergence(result, bassTimeline) });
}

let primaryCache: readonly ReturnType<typeof primaryEntry>[] | null = null;
function primaryMatrix() {
  primaryCache ??= Object.freeze(BASS_AMPLITUDE_MATRIX.flatMap(amplitude =>
    PENALTIES.map(penalty => primaryEntry(amplitude, penalty))));
  return primaryCache;
}

function tone(frequency: number, seconds: number, gain: number) {
  return Float32Array.from({ length: Math.floor(CALIBRATION_SAMPLE_RATE * seconds) }, (_, index) =>
    gain * Math.sin(2 * Math.PI * frequency * index / CALIBRATION_SAMPLE_RATE));
}

function twoTone(lowHz: number, lowGain: number, highHz: number, highGain: number, seconds = 2) {
  return Float32Array.from({ length: Math.floor(CALIBRATION_SAMPLE_RATE * seconds) }, (_, index) =>
    lowGain * Math.sin(2 * Math.PI * lowHz * index / CALIBRATION_SAMPLE_RATE)
    + highGain * Math.sin(2 * Math.PI * highHz * index / CALIBRATION_SAMPLE_RATE));
}

function identityControl(frequency: number, penalty: Penalty, signal = tone(frequency, 2, 0.42)) {
  const result = analyze(signal, penalty);
  const stable = result.dpDiagnostics.frames.filter(frame => frame.time >= 0.2 && frame.time <= 1.8);
  let candidateRecall = 0;
  let rawRank1 = 0;
  let experimentalLocalRank1 = 0;
  let pathIdentity = 0;
  for (const frame of stable) {
    const candidates = frame.states.slice(1);
    const truth = candidates.find(state => matchesPitchIdentity(state.pitchHz, frequency));
    if (truth) candidateRecall += 1;
    if (truth && matchesPitchIdentity(candidates[0]?.pitchHz ?? null, frequency)) rawRank1 += 1;
    if (matchesPitchIdentity(localBest(frame)?.pitchHz ?? null, frequency)) experimentalLocalRank1 += 1;
    if (matchesPitchIdentity(selected(frame).pitchHz, frequency)) pathIdentity += 1;
  }
  return Object.freeze({ frequency, penalty, frames: stable.length, candidateRecall, rawRank1,
    experimentalLocalRank1, pathIdentity,
    voicedFrames: result.analysis.contour.filter(frame => frame.voiced).length,
    acceptedNotes: result.analysis.notes.length,
    available: result.analysis.available,
    trackConfidence: result.analysis.confidence,
  });
}

function seededNoise(seconds: number, gain: number, seed: number) {
  let state = seed >>> 0;
  return Float32Array.from({ length: Math.floor(CALIBRATION_SAMPLE_RATE * seconds) }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return ((state / 0xffffffff) * 2 - 1) * gain;
  });
}

function weakSummary(label: string, signal: Float32Array, penalty: Penalty) {
  const result = analyze(signal, penalty);
  const selectedStates = result.dpDiagnostics.frames.map(selected);
  return Object.freeze({ label, penalty,
    nonNullPathFrames: selectedStates.filter(state => state.pitchHz !== null).length,
    voicedFrames: result.analysis.contour.filter(frame => frame.voiced).length,
    acceptedNotes: result.analysis.notes.length,
    available: result.analysis.available });
}

test('relationship detection uses only fixed integer multiples and ±50 cents', () => {
  assert.deepEqual(MELODY_SUBHARMONIC_AMBIGUITY.multiples, [2, 3, 4]);
  assert.equal(MELODY_SUBHARMONIC_AMBIGUITY.relationshipToleranceCents, 50);
  assert.deepEqual(PENALTIES, [0, 0.02, 0.04, 0.06, 0.08, 0.10]);
  const entry = primaryMatrix().find(item => item.amplitude === 0.20 && item.penalty === 0.04)!;
  for (const frame of entry.result.dpDiagnostics.frames) {
    const candidates = frame.states.slice(1);
    candidates.forEach((state, candidateIndex) => {
      const ambiguity = state.subharmonicAmbiguity!;
      const manual = candidates.flatMap((higher, higherCandidateIndex) =>
        MELODY_SUBHARMONIC_AMBIGUITY.multiples.flatMap(multiple => {
          if (higherCandidateIndex === candidateIndex || higher.pitchHz! <= state.pitchHz!) return [];
          const cents = 1200 * Math.log2(higher.pitchHz! / (state.pitchHz! * multiple));
          return Math.abs(cents) <= 50 ? [{ higherCandidateIndex, multiple, cents }] : [];
        }));
      assert.equal(ambiguity.eligible, manual.length > 0);
      assert.equal(ambiguity.relations.length, manual.length);
      ambiguity.relations.forEach(relation => assert.ok(Math.abs(relation.centsDeviation) <= 50));
      assert.equal(ambiguity.originalCandidateScore, state.candidateScore);
      assert.equal(ambiguity.experimentalCandidateScore,
        ambiguity.originalCandidateScore - (ambiguity.eligible ? 0.04 : 0));
      assert.equal(ambiguity.appliedPenalty, ambiguity.eligible ? 0.04 : 0);
    });
  }
});

test('penalty zero reproduces baseline exactly and every penalty preserves raw candidates', () => {
  const expectedPaths = [500, 500, 500, 352, 51, 0, 0, 0, 0];
  for (const [index, amplitude] of BASS_AMPLITUDE_MATRIX.entries()) {
    const signal = createMelodyCompetitionStimulus(amplitude, GROUND_TRUTH_BASS);
    const baseline = analyzeMelodyWithDpDiagnostics({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE });
    const zero = primaryMatrix().find(item => item.amplitude === amplitude && item.penalty === 0)!;
    assert.deepEqual(zero.result.analysis, baseline.analysis);
    assert.deepEqual(zero.result.evidence, baseline.evidence);
    assert.equal(zero.report.metrics.candidateMatches, index < 6 ? 500
      : [0.30, 0.36, 0.42].includes(amplitude) ? [500, 158, 59][[0.30, 0.36, 0.42].indexOf(amplitude)] : 0);
    assert.equal(zero.report.metrics.pathMatches, expectedPaths[index]);
    const fingerprint = candidateFingerprint(zero.result);
    for (const penalty of PENALTIES) {
      const experiment = primaryMatrix().find(item => item.amplitude === amplitude && item.penalty === penalty)!;
      assert.deepEqual(candidateFingerprint(experiment.result), fingerprint);
    }
  }
});

test('primary matrix reports the fixed penalty sensitivity and application counts', () => {
  const compact = primaryMatrix().map(entry => ({
    amplitude: entry.amplitude,
    penalty: entry.penalty,
    candidateRecall: entry.report.metrics.candidateRecall,
    rawOriginalRank1: entry.rawOriginalRank1,
    experimentalLocalBest: entry.experimentalLocalBest,
    pathIdentity: entry.report.metrics.pathIdentityAccuracy,
    conditionalPathIdentity: entry.report.metrics.conditionalPathIdentity,
    correctPathAcceptedRate: entry.report.metrics.melodyMatchAcceptedRate,
    wrongPaths: entry.report.metrics.wrongPaths,
    nullPaths: entry.report.metrics.nullPaths,
    application: entry.application,
  }));
  console.log(`\nSUBHARMONIC AMBIGUITY MACHINE RESULTS\n${JSON.stringify(compact)}\n`);
  for (const amplitude of BASS_AMPLITUDE_MATRIX) {
    const entries = compact.filter(item => item.amplitude === amplitude);
    assert.ok(entries.every(item => item.candidateRecall === entries[0].candidateRecall));
    assert.ok(entries.every(item => item.rawOriginalRank1 === entries[0].rawOriginalRank1));
  }
});

test('true-fundamental and low-melody/high-competitor controls expose regressions', () => {
  const controls = [110, 220, 440, 660].flatMap(frequency =>
    PENALTIES.map(penalty => identityControl(frequency, penalty)));
  const lowWithHigh = PENALTIES.map(penalty =>
    identityControl(110, penalty, twoTone(110, 0.42, 440, 0.20)));
  console.log(`\nSUBHARMONIC TRUE FUNDAMENTAL CONTROLS\n${JSON.stringify(controls)}\n`
    + `LOW_110_PLUS_HIGH_440\n${JSON.stringify(lowWithHigh)}\n`);
  assert.ok(controls.every(item => item.candidateRecall === 100 && item.rawRank1 === 100
    && item.experimentalLocalRank1 === 100 && item.pathIdentity === 100
    && item.voicedFrames === 116 && item.acceptedNotes === 1 && item.available));
  assert.ok(lowWithHigh.every(item => item.candidateRecall === 100 && item.rawRank1 === 100
    && item.experimentalLocalRank1 === 100 && item.pathIdentity === 100
    && item.voicedFrames === 116 && item.acceptedNotes === 1 && item.available));
  for (const frequency of [110, 220, 440, 660]) {
    const group = controls.filter(item => item.frequency === frequency)
      .map(({ penalty: _penalty, ...rest }) => rest);
    assert.ok(group.every(item => JSON.stringify(item) === JSON.stringify(group[0])));
  }
});

test('non-octave and weak-evidence controls are measured for every penalty', () => {
  const nonOctave = [0.20, 0.36].flatMap(amplitude => PENALTIES.map(penalty =>
    primaryEntry(amplitude, penalty, NON_OCTAVE_CONTROL_BASS, 'NON_OCTAVE')));
  const lowToneGain = MELODY_ANALYSIS.minimumRms * Math.SQRT2 * 1.02;
  let ambiguousState = 1;
  const ambiguous = Float32Array.from({ length: CALIBRATION_SAMPLE_RATE }, (_, index) => {
    ambiguousState = (Math.imul(ambiguousState, 1664525) + 1013904223) >>> 0;
    return 0.01 * Math.sin(2 * Math.PI * 440 * index / CALIBRATION_SAMPLE_RATE)
      + 0.01 * ((ambiguousState / 0xffffffff) * 2 - 1);
  });
  const fixtures = [
    ['SILENCE', new Float32Array(CALIBRATION_SAMPLE_RATE)] as const,
    ['NOISE', seededNoise(1, 0.45, 0x12345678)] as const,
    ['NEAR_GATE_TONE', tone(440, 1, lowToneGain)] as const,
    ['WEAK_AMBIGUOUS', ambiguous] as const,
  ];
  const weak = fixtures.flatMap(([label, signal]) => PENALTIES.map(penalty => weakSummary(label, signal, penalty)));
  console.log(`\nSUBHARMONIC NON_OCTAVE CONTROLS\n${JSON.stringify(nonOctave.map(entry => ({
    amplitude: entry.amplitude, penalty: entry.penalty, candidateRecall: entry.report.metrics.candidateRecall,
    pathIdentity: entry.report.metrics.pathIdentityAccuracy, wrongPaths: entry.report.metrics.wrongPaths,
    nullPaths: entry.report.metrics.nullPaths, application: entry.application,
  })))}\nWEAK CONTROLS\n${JSON.stringify(weak)}\n`);
  assert.equal(nonOctave.length, 12);
  assert.equal(weak.length, 24);
  for (const [label] of fixtures) {
    const group = weak.filter(item => item.label === label).map(({ penalty: _penalty, ...rest }) => rest);
    assert.ok(group.every(item => JSON.stringify(item) === JSON.stringify(group[0])));
  }
});

test('path runs and first divergences remain deterministic at requested reporting penalties', () => {
  const selectedEntries = [0.20, 0.25].flatMap(amplitude => [0, 0.04, 0.08, 0.10].map(penalty =>
    primaryMatrix().find(item => item.amplitude === amplitude && item.penalty === penalty)!));
  const report = selectedEntries.map(entry => ({ amplitude: entry.amplitude, penalty: entry.penalty,
    runs: entry.runs, firstDivergence: entry.firstDivergence }));
  console.log(`\nSUBHARMONIC PATH RUNS AND FIRST DIVERGENCE\n${JSON.stringify(report)}\n`);
  assert.deepEqual(report.map(item => item.runs), [
    { correctRuns: 1, wrongRuns: 2, longestCorrect: 51, longestWrong: 249,
      correctToWrong: 1, wrongToCorrect: 0, wrongAcrossBoundaries: 2 },
    { correctRuns: 1, wrongRuns: 2, longestCorrect: 134, longestWrong: 249,
      correctToWrong: 1, wrongToCorrect: 1, wrongAcrossBoundaries: 2 },
    { correctRuns: 2, wrongRuns: 3, longestCorrect: 134, longestWrong: 129,
      correctToWrong: 1, wrongToCorrect: 2, wrongAcrossBoundaries: 2 },
    { correctRuns: 2, wrongRuns: 3, longestCorrect: 134, longestWrong: 129,
      correctToWrong: 1, wrongToCorrect: 2, wrongAcrossBoundaries: 2 },
    { correctRuns: 0, wrongRuns: 1, longestCorrect: 0, longestWrong: 500,
      correctToWrong: 0, wrongToCorrect: 0, wrongAcrossBoundaries: 1 },
    { correctRuns: 0, wrongRuns: 1, longestCorrect: 0, longestWrong: 500,
      correctToWrong: 0, wrongToCorrect: 0, wrongAcrossBoundaries: 1 },
    { correctRuns: 0, wrongRuns: 1, longestCorrect: 0, longestWrong: 500,
      correctToWrong: 0, wrongToCorrect: 0, wrongAcrossBoundaries: 1 },
    { correctRuns: 1, wrongRuns: 2, longestCorrect: 82, longestWrong: 300,
      correctToWrong: 0, wrongToCorrect: 1, wrongAcrossBoundaries: 2 },
  ]);
  report.forEach(item => {
    assert.equal(item.firstDivergence?.frameIndex, 8);
    assert.equal(item.firstDivergence?.winnerEligible, true);
    assert.equal(item.firstDivergence?.selectedExperimentalScore,
      item.firstDivergence!.selectedOriginalScore! - item.penalty);
  });
});

test('default production analysis equivalence remains exact', () => {
  const signal = createMelodyCompetitionStimulus(0.20, GROUND_TRUTH_BASS);
  const ordinary = analyzeMelody({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE });
  const evidence = analyzeMelodyWithEvidence({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE });
  const diagnostic = analyzeMelodyWithDpDiagnostics({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE });
  assert.deepEqual(evidence.analysis, ordinary);
  assert.deepEqual(diagnostic.analysis, ordinary);
  assert.deepEqual(diagnostic.evidence, evidence.evidence);
  assert.equal(diagnostic.dpDiagnostics.subharmonicAmbiguityExperiment, undefined);
});
