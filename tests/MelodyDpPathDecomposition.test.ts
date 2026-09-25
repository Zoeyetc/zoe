import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeMelody, analyzeMelodyWithEvidence, MELODY_ANALYSIS } from '../src/listening-engine/index.ts';
import { analyzeMelodyWithDpDiagnostics } from '../src/listening-engine/diagnostics/index.ts';
import type { MelodyDpFrameDiagnostic, MelodyDpStateDiagnostic } from '../src/listening-engine/diagnostics/index.ts';
import { selectMelodyEvidence } from '../src/listening-engine/index.ts';
import {
  CALIBRATION_SAMPLE_RATE, characterizeMelodyPath, classifyWrongPath,
  createMelodyCompetitionStimulus, GROUND_TRUTH_BASS, GROUND_TRUTH_MELODY,
  matchesPitchIdentity, TRANSITION_MARGIN_SECONDS,
} from './melodyPathIdentityCalibration.ts';

type Status = 'CORRECT' | 'WRONG' | 'NULL';
type EvaluatedFrame = Readonly<{
  frame: MelodyDpFrameDiagnostic;
  segmentIndex: number;
  melodyHz: number;
  bassHz: number;
  melodyState: MelodyDpStateDiagnostic;
  selectedState: MelodyDpStateDiagnostic;
  localBestState: MelodyDpStateDiagnostic;
  finalPitchHz: number | null;
  finalVoiced: boolean;
  status: Status;
}>;

const median = (values: readonly number[]) => {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};

const mean = (values: readonly number[]) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

function groundTruthAt(time: number, margin: number) {
  const segmentIndex = GROUND_TRUTH_MELODY.findIndex(segment =>
    time >= segment.startSec + margin && time <= segment.endSec - margin);
  if (segmentIndex < 0) return null;
  const melody = GROUND_TRUTH_MELODY[segmentIndex];
  const bass = GROUND_TRUTH_BASS.find(segment => time >= segment.startSec && time < segment.endSec)!;
  return { segmentIndex, melody, bass };
}

function evaluateFrames(amplitude: number) {
  const signal = createMelodyCompetitionStimulus(amplitude, GROUND_TRUTH_BASS);
  const result = analyzeMelodyWithDpDiagnostics({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE });
  const frames: EvaluatedFrame[] = [];
  for (const frame of result.dpDiagnostics.frames) {
    const truth = groundTruthAt(frame.time, TRANSITION_MARGIN_SECONDS);
    if (!truth) continue;
    const melodyState = frame.states.slice(1).find(state =>
      matchesPitchIdentity(state.pitchHz, truth.melody.frequencyHz));
    if (!melodyState) continue;
    const selectedState = frame.states[frame.selectedPathStateIndex];
    const localBestState = frame.localBestCandidateStateIndex === null
      ? frame.states[0] : frame.states[frame.localBestCandidateStateIndex];
    const observation = selectMelodyEvidence(result.evidence,
      frame.time + MELODY_ANALYSIS.hopSize / MELODY_ANALYSIS.analysisSampleRate / 4)!;
    const status: Status = selectedState.pitchHz === null ? 'NULL'
      : matchesPitchIdentity(selectedState.pitchHz, truth.melody.frequencyHz) ? 'CORRECT' : 'WRONG';
    frames.push(Object.freeze({
      frame,
      segmentIndex: truth.segmentIndex,
      melodyHz: truth.melody.frequencyHz,
      bassHz: truth.bass.frequencyHz,
      melodyState,
      selectedState,
      localBestState,
      finalPitchHz: observation.finalPitchHz,
      finalVoiced: observation.voiced,
      status,
    }));
  }
  return { signal, result, frames };
}

type Run = Readonly<{
  status: Status;
  length: number;
  startFrame: number;
  endFrame: number;
  segmentIndexes: readonly number[];
}>;

function pathRuns(frames: readonly MelodyDpFrameDiagnostic[]) {
  const classified = frames.flatMap(frame => {
    const truth = groundTruthAt(frame.time, 0);
    if (!truth) return [];
    const selected = frame.states[frame.selectedPathStateIndex];
    const status: Status = selected.pitchHz === null ? 'NULL'
      : matchesPitchIdentity(selected.pitchHz, truth.melody.frequencyHz) ? 'CORRECT' : 'WRONG';
    return [{ frameIndex: frame.frameIndex, segmentIndex: truth.segmentIndex, status }];
  });
  const runs: Run[] = [];
  for (const item of classified) {
    const previous = runs.at(-1);
    if (previous && previous.status === item.status && previous.endFrame + 1 === item.frameIndex) {
      const segments = previous.segmentIndexes.includes(item.segmentIndex)
        ? previous.segmentIndexes : [...previous.segmentIndexes, item.segmentIndex];
      runs[runs.length - 1] = Object.freeze({ ...previous, length: previous.length + 1,
        endFrame: item.frameIndex, segmentIndexes: Object.freeze(segments) });
    } else runs.push(Object.freeze({ status: item.status, length: 1, startFrame: item.frameIndex,
      endFrame: item.frameIndex, segmentIndexes: Object.freeze([item.segmentIndex]) }));
  }
  return Object.freeze(runs);
}

function describe(amplitude: number) {
  const evaluated = evaluateFrames(amplitude);
  const frames = evaluated.frames;
  const localMelody = frames.filter(item => matchesPitchIdentity(item.localBestState.pitchHz, item.melodyHz));
  const dpMelody = frames.filter(item => item.status === 'CORRECT');
  const overturn = frames.filter(item => matchesPitchIdentity(item.localBestState.pitchHz, item.melodyHz)
    && item.status === 'WRONG');
  const rescue = frames.filter(item => !matchesPitchIdentity(item.localBestState.pitchHz, item.melodyHz)
    && item.status === 'CORRECT');
  const wrong = frames.filter(item => item.status === 'WRONG');
  const margins = wrong.map(item => item.selectedState.objectiveThroughState
    - item.melodyState.objectiveThroughState);
  const classes = { MELODY_OCTAVE_DOWN: 0, MELODY_OCTAVE_UP: 0, BASS_MATCH: 0, OTHER_PITCH: 0 };
  wrong.forEach(item => {
    classes[classifyWrongPath(item.selectedState.pitchHz!, item.melodyHz, item.bassHz)] += 1;
  });
  const runs = pathRuns(evaluated.result.dpDiagnostics.frames);
  const correctRuns = runs.filter(run => run.status === 'CORRECT');
  const wrongRuns = runs.filter(run => run.status === 'WRONG');
  const firstDivergence = wrong[0] ?? null;
  return {
    ...evaluated,
    localMelody,
    dpMelody,
    overturn,
    rescue,
    wrong,
    margins,
    classes,
    runs,
    runStats: {
      correctCount: correctRuns.length,
      wrongCount: wrongRuns.length,
      longestCorrect: Math.max(0, ...correctRuns.map(run => run.length)),
      longestWrong: Math.max(0, ...wrongRuns.map(run => run.length)),
      medianCorrect: median(correctRuns.map(run => run.length)),
      medianWrong: median(wrongRuns.map(run => run.length)),
      wrongAcrossMelodyBoundary: wrongRuns.filter(run => run.segmentIndexes.length > 1).length,
    },
    firstDivergence,
    preCorrectPostWrong: frames.filter(item => item.status === 'CORRECT'
      && !matchesPitchIdentity(item.finalPitchHz, item.melodyHz)).length,
    preWrongPostCorrect: frames.filter(item => item.status === 'WRONG'
      && matchesPitchIdentity(item.finalPitchHz, item.melodyHz)).length,
  };
}

function comparisonLine(label: string, item: EvaluatedFrame | null) {
  if (!item) return `${label}: NONE`;
  const melody = item.melodyState;
  const winner = item.selectedState;
  const inherited = (state: MelodyDpStateDiagnostic) =>
    (state.predecessorCumulativeObjective ?? 0) + state.transitionContribution;
  return [
    `${label}: frame ${item.frame.frameIndex}, time ${item.frame.time.toFixed(6)}s, ${item.status}`,
    `  melody idx=${melody.candidateIndex} hz=${melody.pitchHz!.toFixed(3)}`
      + ` score=${melody.candidateScore!.toFixed(6)} local=${melody.localContribution.toFixed(6)}`
      + ` predecessor=${melody.predecessorStateIndex} inherited=${inherited(melody).toFixed(6)}`
      + ` transition=${melody.transitionContribution.toFixed(6)}`
      + ` prefix=${melody.cumulativeObjective.toFixed(6)}`
      + ` continuation=${melody.bestContinuationObjective.toFixed(6)}`
      + ` full=${melody.objectiveThroughState.toFixed(6)}`,
    `  winner idx=${winner.candidateIndex} hz=${winner.pitchHz?.toFixed(3) ?? 'NULL'}`
      + ` score=${winner.candidateScore?.toFixed(6) ?? 'NULL'} local=${winner.localContribution.toFixed(6)}`
      + ` predecessor=${winner.predecessorStateIndex} inherited=${inherited(winner).toFixed(6)}`
      + ` transition=${winner.transitionContribution.toFixed(6)}`
      + ` prefix=${winner.cumulativeObjective.toFixed(6)}`
      + ` continuation=${winner.bestContinuationObjective.toFixed(6)}`
      + ` full=${winner.objectiveThroughState.toFixed(6)}`,
    `  winner margin=${(winner.objectiveThroughState - melody.objectiveThroughState).toFixed(6)}`
      + ` pre-octave=${winner.pitchHz?.toFixed(3) ?? 'NULL'}`
      + ` post-octave=${item.finalPitchHz?.toFixed(3) ?? 'NULL'}`,
  ].join('\n');
}

test('DP diagnostics reconstruct the executed maximizing recurrence and backtracked winner exactly', () => {
  const characterization = describe(0.20);
  const diagnostics = characterization.result.dpDiagnostics;
  assert.equal(diagnostics.optimizationDirection, 'MAXIMIZE');
  assert.equal(diagnostics.tieBreak, 'FIRST_STATE_ON_EXACT_EQUALITY');
  assert.ok(Object.isFrozen(diagnostics));
  for (const frame of diagnostics.frames) {
    for (const state of frame.states) {
      if (frame.frameIndex === 0) assert.equal(state.cumulativeObjective, state.localContribution);
      else assert.ok(Math.abs(state.cumulativeObjective - (state.predecessorCumulativeObjective!
        + state.transitionContribution + state.localContribution)) < 1e-10);
    }
    const selected = frame.states[frame.selectedPathStateIndex];
    const bestThrough = Math.max(...frame.states.map(state => state.objectiveThroughState));
    assert.ok(Math.abs(selected.objectiveThroughState - diagnostics.selectedTotalObjective) < 1e-8);
    assert.ok(Math.abs(bestThrough - diagnostics.selectedTotalObjective) < 1e-8);
  }
  const terminal = diagnostics.frames.at(-1)!;
  assert.equal(terminal.selectedPathStateIndex, diagnostics.selectedTerminalStateIndex);
  assert.equal(terminal.states[diagnostics.selectedTerminalStateIndex].cumulativeObjective,
    diagnostics.selectedTotalObjective);
});

test('0.10, 0.20, and 0.25 decomposition is deterministic without becoming a quality gate', () => {
  const reports = [0.10, 0.20, 0.25].map(describe);
  const repeated = [0.10, 0.20, 0.25].map(describe);
  const compact = (report: ReturnType<typeof describe>) => ({
    frames: report.frames.length,
    localMelody: report.localMelody.length,
    dpMelody: report.dpMelody.length,
    overturn: report.overturn.length,
    rescue: report.rescue.length,
    classes: report.classes,
    margins: report.margins,
    runStats: report.runStats,
    firstDivergence: report.firstDivergence?.frame.frameIndex ?? null,
    preCorrectPostWrong: report.preCorrectPostWrong,
    preWrongPostCorrect: report.preWrongPostCorrect,
  });
  assert.deepEqual(reports.map(compact), repeated.map(compact));

  // Current Competition Matrix snapshot: drift detector, not an accuracy requirement.
  assert.deepEqual(reports.map(report => [report.frames.length, report.dpMelody.length]),
    [[500, 500], [500, 51], [500, 0]]);
  reports.forEach(report => {
    assert.equal(report.localMelody.length + report.frames.filter(item =>
      !matchesPitchIdentity(item.localBestState.pitchHz, item.melodyHz)).length, report.frames.length);
    assert.equal(report.dpMelody.length + report.wrong.length, report.frames.length);
    assert.ok(report.margins.every(margin => margin >= -1e-8));
    assert.equal(report.preCorrectPostWrong, 0);
    assert.equal(report.preWrongPostCorrect, 0);
  });

  const healthy = reports[0];
  const partial = reports[1];
  const failed = reports[2];
  const firstCorrect020 = partial.frames.find(item => item.status === 'CORRECT') ?? null;
  const firstWrong020 = partial.frames.find(item => item.status === 'WRONG') ?? null;
  const correctToWrong020 = partial.frames.find((item, index, frames) => index > 0
    && frames[index - 1].frame.frameIndex + 1 === item.frame.frameIndex
    && frames[index - 1].status === 'CORRECT' && item.status === 'WRONG') ?? null;
  const wrongToCorrect020 = partial.frames.find((item, index, frames) => index > 0
    && frames[index - 1].frame.frameIndex + 1 === item.frame.frameIndex
    && frames[index - 1].status === 'WRONG' && item.status === 'CORRECT') ?? null;
  const earlyWrong025 = failed.frames[0] ?? null;
  const laterWrong025 = failed.frames[Math.floor(failed.frames.length * 0.75)] ?? null;

  const percentage = (count: number, denominator: number) => `${(count / denominator * 100).toFixed(1)}%`;
  const reportLines = reports.flatMap((report, index) => {
    const amplitude = [0.10, 0.20, 0.25][index];
    const first = report.firstDivergence;
    const localDelta = first ? first.selectedState.localContribution - first.melodyState.localContribution : null;
    const inherited = (state: MelodyDpStateDiagnostic) =>
      (state.predecessorCumulativeObjective ?? 0) + state.transitionContribution;
    const inheritedDelta = first ? inherited(first.selectedState) - inherited(first.melodyState) : null;
    const continuationDelta = first ? first.selectedState.bestContinuationObjective
      - first.melodyState.bestContinuationObjective : null;
    return [
      `AMP ${amplitude.toFixed(2)}`,
      `frames=${report.frames.length} candidateRecall=100.0% dpMelody=${report.dpMelody.length}`
        + ` (${percentage(report.dpMelody.length, report.frames.length)})`,
      `localBestMelody=${report.localMelody.length} (${percentage(report.localMelody.length, report.frames.length)})`
        + ` overturn=${report.overturn.length} (${percentage(report.overturn.length, report.frames.length)})`
        + ` rescue=${report.rescue.length} (${percentage(report.rescue.length, report.frames.length)})`,
      `wrong down=${report.classes.MELODY_OCTAVE_DOWN} up=${report.classes.MELODY_OCTAVE_UP}`
        + ` bass=${report.classes.BASS_MATCH} other=${report.classes.OTHER_PITCH}`,
      `winnerMargin wrong mean=${mean(report.margins)?.toFixed(6) ?? 'N/A'}`
        + ` median=${median(report.margins)?.toFixed(6) ?? 'N/A'}`,
      `runs correct=${report.runStats.correctCount} longest=${report.runStats.longestCorrect}`
        + ` median=${report.runStats.medianCorrect ?? 'N/A'}; wrong=${report.runStats.wrongCount}`
        + ` longest=${report.runStats.longestWrong} median=${report.runStats.medianWrong ?? 'N/A'}`
        + ` wrongAcrossBoundaries=${report.runStats.wrongAcrossMelodyBoundary}`,
      `firstDivergence=${first ? `frame ${first.frame.frameIndex} time ${first.frame.time.toFixed(6)}` : 'NONE'}`
        + ` localDelta=${localDelta?.toFixed(6) ?? 'N/A'}`
        + ` inheritedDelta=${inheritedDelta?.toFixed(6) ?? 'N/A'}`
        + ` continuationDelta=${continuationDelta?.toFixed(6) ?? 'N/A'}`,
      `preCorrectPostWrong=${report.preCorrectPostWrong} preWrongPostCorrect=${report.preWrongPostCorrect}`,
    ];
  });
  console.log(['\nMELODY DP PATH COST DECOMPOSITION', ...reportLines, '',
    comparisonLine('0.10 first correct', healthy.frames.find(item => item.status === 'CORRECT') ?? null),
    comparisonLine('0.20 first correct', firstCorrect020),
    comparisonLine('0.20 first wrong', firstWrong020),
    comparisonLine('0.20 correct -> wrong', correctToWrong020),
    comparisonLine('0.20 wrong -> correct', wrongToCorrect020),
    comparisonLine('0.25 early wrong', earlyWrong025),
    comparisonLine('0.25 later wrong', laterWrong025), '\n'].join('\n'));
});

test('DP winner classification, first divergence, run accounting, and octave stages remain inspectable', () => {
  for (const amplitude of [0.10, 0.20, 0.25]) {
    const report = describe(amplitude);
    assert.equal(report.runs.reduce((sum, run) => sum + run.length, 0),
      report.result.dpDiagnostics.frames.length);
    if (report.firstDivergence) {
      assert.equal(report.firstDivergence.status, 'WRONG');
      assert.ok(report.frames.slice(0, report.frames.indexOf(report.firstDivergence))
        .every(item => item.status === 'CORRECT'));
      const margin = report.firstDivergence.selectedState.objectiveThroughState
        - report.firstDivergence.melodyState.objectiveThroughState;
      assert.ok(margin >= -1e-8);
    }
    assert.equal(Object.values(report.classes).reduce((sum, count) => sum + count, 0), report.wrong.length);
  }
});

test('diagnostic collection preserves ordinary analysis, evidence analysis, and matrix outputs', () => {
  const signal = createMelodyCompetitionStimulus(0.20, GROUND_TRUTH_BASS);
  const ordinary = analyzeMelody({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE });
  const evidence = analyzeMelodyWithEvidence({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE });
  const diagnostic = analyzeMelodyWithDpDiagnostics({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE });
  assert.deepEqual(evidence.analysis, ordinary);
  assert.deepEqual(diagnostic.analysis, ordinary);
  assert.deepEqual(diagnostic.evidence, evidence.evidence);
  const matrix = characterizeMelodyPath('ORIGINAL_0.20', diagnostic.evidence, GROUND_TRUTH_BASS);
  assert.deepEqual([matrix.metrics.candidateMatches, matrix.metrics.pathMatches,
    matrix.metrics.correctPathAccepted], [500, 51, 51]);
});
