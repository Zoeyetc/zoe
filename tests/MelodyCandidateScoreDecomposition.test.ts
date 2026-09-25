import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeMelody, analyzeMelodyWithEvidence, MELODY_ANALYSIS } from '../src/listening-engine/index.ts';
import { analyzeMelodyWithDpDiagnostics, analyzeMelodyWithNoCliffExperiment } from '../src/listening-engine/diagnostics/index.ts';
import type {
  MelodyCandidateScoreDiagnostic, MelodyDpFrameDiagnostic, MelodyDpStateDiagnostic,
} from '../src/listening-engine/diagnostics/index.ts';
import {
  CALIBRATION_SAMPLE_RATE, characterizeMelodyPath, classifyWrongPath,
  createMelodyCompetitionStimulus, GROUND_TRUTH_BASS, GROUND_TRUTH_MELODY,
  matchesPitchIdentity, TRANSITION_MARGIN_SECONDS,
} from './melodyPathIdentityCalibration.ts';
import { selectMelodyEvidence } from '../src/listening-engine/index.ts';

const CONDITIONS = Object.freeze([0, 0.10, 0.15, 0.20, 0.25] as const);
const COMPONENTS = Object.freeze([
  'periodicityContribution', 'salienceContribution', 'energySupportContribution', 'score',
] as const);
type Component = typeof COMPONENTS[number];

function clamp01(value: number) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

function truthAt(time: number) {
  const melody = GROUND_TRUTH_MELODY.find(segment =>
    time >= segment.startSec + TRANSITION_MARGIN_SECONDS
    && time <= segment.endSec - TRANSITION_MARGIN_SECONDS) ?? null;
  if (!melody) return null;
  const bass = GROUND_TRUTH_BASS.find(segment => time >= segment.startSec && time < segment.endSec) ?? null;
  return { melody, bass };
}

function diagnostic(state: MelodyDpStateDiagnostic) {
  assert.ok(state.candidateScoreDiagnostic);
  return state.candidateScoreDiagnostic;
}

function rawWinner(frame: MelodyDpFrameDiagnostic) {
  assert.ok(frame.states.length > 1);
  return frame.states.slice(1).reduce((best, state) =>
    state.candidateScore! > best.candidateScore! ? state : best);
}

type Pair = Readonly<{
  frame: MelodyDpFrameDiagnostic;
  melody: MelodyDpStateDiagnostic;
  winner: MelodyDpStateDiagnostic;
  melodyHz: number;
  bassHz: number | null;
  winnerIsMelody: boolean;
  classification: ReturnType<typeof classifyWrongPath> | 'MELODY';
  frequencyRatio: number;
  cents: number;
}>;

function condition(amplitude: typeof CONDITIONS[number]) {
  const signal = createMelodyCompetitionStimulus(amplitude, GROUND_TRUTH_BASS);
  const result = analyzeMelodyWithDpDiagnostics({ mono: signal, sampleRate: CALIBRATION_SAMPLE_RATE });
  const pairs: Pair[] = [];
  for (const frame of result.dpDiagnostics.frames) {
    const truth = truthAt(frame.time);
    if (!truth) continue;
    const melody = frame.states.slice(1).find(state =>
      matchesPitchIdentity(state.pitchHz, truth.melody.frequencyHz));
    if (!melody) continue;
    const winner = rawWinner(frame);
    const winnerIsMelody = matchesPitchIdentity(winner.pitchHz, truth.melody.frequencyHz);
    pairs.push(Object.freeze({
      frame,
      melody,
      winner,
      melodyHz: truth.melody.frequencyHz,
      bassHz: truth.bass?.frequencyHz ?? null,
      winnerIsMelody,
      classification: winnerIsMelody ? 'MELODY'
        : classifyWrongPath(winner.pitchHz!, truth.melody.frequencyHz, truth.bass?.frequencyHz ?? null),
      frequencyRatio: winner.pitchHz! / truth.melody.frequencyHz,
      cents: 1200 * Math.log2(winner.pitchHz! / truth.melody.frequencyHz),
    }));
  }
  return { amplitude, signal, result, pairs };
}

let cached: readonly ReturnType<typeof condition>[] | null = null;
function conditions() {
  cached ??= Object.freeze(CONDITIONS.map(condition));
  return cached;
}

function quantile(values: readonly number[], fraction: number) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function distribution(values: readonly number[]) {
  return Object.freeze({
    count: values.length,
    mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    min: quantile(values, 0),
    q1: quantile(values, 0.25),
    median: quantile(values, 0.5),
    q3: quantile(values, 0.75),
    max: quantile(values, 1),
  });
}

function component(state: MelodyDpStateDiagnostic, key: Component) {
  const terms = diagnostic(state);
  return terms[key];
}

function componentSummary(pairs: readonly Pair[]) {
  return Object.fromEntries(COMPONENTS.map(key => [key, {
    melody: distribution(pairs.map(pair => component(pair.melody, key))),
    winner: distribution(pairs.map(pair => component(pair.winner, key))),
    delta: distribution(pairs.map(pair => component(pair.winner, key) - component(pair.melody, key))),
  }])) as Record<Component, {
    melody: ReturnType<typeof distribution>;
    winner: ReturnType<typeof distribution>;
    delta: ReturnType<typeof distribution>;
  }>;
}

function rankDistribution(pairs: readonly Pair[]) {
  const ranks = { rank1: 0, rank2: 0, rank3: 0, rank4: 0, rank5: 0, absent: 0 };
  for (const pair of pairs) {
    const rank = pair.frame.states.slice(1).findIndex(state => state.stateIndex === pair.melody.stateIndex) + 1;
    if (rank >= 1 && rank <= 5) ranks[`rank${rank}` as keyof typeof ranks] += 1;
    else ranks.absent += 1;
  }
  return Object.freeze(ranks);
}

function compact(value: number | null) {
  return value === null ? 'N/A' : value.toFixed(6);
}

function summaryLine(label: string, pairs: readonly Pair[]) {
  const summary = componentSummary(pairs);
  return `${label} n=${pairs.length}` + COMPONENTS.map(key =>
    ` ${key}[mel=${compact(summary[key].melody.mean)}/${compact(summary[key].melody.median)}`
    + ` win=${compact(summary[key].winner.mean)}/${compact(summary[key].winner.median)}`
    + ` delta=${compact(summary[key].delta.mean)}/${compact(summary[key].delta.median)}]`).join('');
}

function dominance(pairs: readonly Pair[]) {
  return Object.fromEntries(COMPONENTS.map(key => [key,
    pairs.filter(pair => component(pair.winner, key) > component(pair.melody, key)).length])) as
    Record<Component, number>;
}

function formatPair(label: string, pair: Pair) {
  const melody = diagnostic(pair.melody);
  const winner = diagnostic(pair.winner);
  const field = (name: keyof MelodyCandidateScoreDiagnostic) =>
    `${String(name).padEnd(33)} ${String(melody[name]).padEnd(20)} ${String(winner[name])}`;
  return [label, `frame ${pair.frame.frameIndex} time ${pair.frame.time.toFixed(6)}`,
    `classification ${pair.classification} ratio ${pair.frequencyRatio.toFixed(6)} cents ${pair.cents.toFixed(3)}`,
    'field                             melody               winner',
    ...([
      'frequencyHz', 'midiFloat', 'yinCumulativeDifference', 'periodicityUnclamped', 'periodicity',
      'periodicityContribution', 'harmonicSupport', 'harmonicWeightSum',
      'salienceNormalizationDenominator', 'salienceUnclamped', 'salience', 'salienceContribution',
      'frameRms', 'energySupportUnclamped', 'energySupport', 'energySupportContribution',
      'weightedSum', 'score',
    ] as const).map(field),
    `scoreDelta ${(winner.score - melody.score).toFixed(12)}`].join('\n');
}

function strongestCompetingPair(pair: Pair): Pair {
  const competitor = pair.frame.states.slice(1).find(state =>
    !matchesPitchIdentity(state.pitchHz, pair.melodyHz));
  assert.ok(competitor, `expected a non-melody competitor at frame ${pair.frame.frameIndex}`);
  return Object.freeze({
    ...pair,
    winner: competitor,
    winnerIsMelody: false,
    classification: classifyWrongPath(competitor.pitchHz!, pair.melodyHz, pair.bassHz),
    frequencyRatio: competitor.pitchHz! / pair.melodyHz,
    cents: 1200 * Math.log2(competitor.pitchHz! / pair.melodyHz),
  });
}

test('candidate score diagnostics reconstruct the actual executed score and preserve ordering', () => {
  for (const entry of conditions()) {
    for (const frame of entry.result.dpDiagnostics.frames) {
      const candidates = frame.states.slice(1);
      candidates.forEach((state, index) => {
        const terms = diagnostic(state);
        assert.equal(terms.frequencyHz, state.pitchHz);
        assert.equal(terms.midiFloat, state.midiFloat);
        assert.ok(Math.abs(terms.periodicityUnclamped - (1 - terms.yinCumulativeDifference)) < 1e-15);
        assert.equal(terms.periodicity, clamp01(terms.periodicityUnclamped));
        assert.equal(terms.periodicityContribution, terms.periodicity * terms.periodicityWeight);
        assert.equal(terms.salienceUnclamped,
          terms.harmonicSupport / terms.salienceNormalizationDenominator);
        assert.equal(terms.salience, clamp01(terms.salienceUnclamped));
        assert.equal(terms.salienceContribution, terms.salience * terms.salienceWeight);
        assert.equal(terms.energySupportUnclamped,
          (terms.frameRms - terms.minimumRms) / terms.energyNormalizationSpan);
        assert.equal(terms.energySupport, clamp01(terms.energySupportUnclamped));
        assert.equal(terms.energySupportContribution,
          terms.energySupport * terms.energySupportWeight);
        const reconstructed = terms.periodicityContribution + terms.salienceContribution
          + terms.energySupportContribution;
        assert.equal(terms.weightedSum, reconstructed);
        assert.equal(terms.score, clamp01(reconstructed));
        assert.equal(terms.score, state.candidateScore);
        if (index > 0) assert.ok(candidates[index - 1].candidateScore! >= state.candidateScore!);
      });
    }
  }
});

test('diagnostic collection preserves candidate frequencies, DP baseline, matrix, and ordinary analysis', () => {
  const expectedPathMatches = [500, 500, 352, 51, 0];
  conditions().forEach((entry, index) => {
    const evidence = analyzeMelodyWithEvidence({ mono: entry.signal, sampleRate: CALIBRATION_SAMPLE_RATE });
    const ordinary = analyzeMelody({ mono: entry.signal, sampleRate: CALIBRATION_SAMPLE_RATE });
    assert.deepEqual(entry.result.analysis, ordinary);
    assert.deepEqual(entry.result.evidence, evidence.evidence);
    entry.result.dpDiagnostics.frames.forEach((frame, frameIndex) => {
      const observation = selectMelodyEvidence(evidence.evidence,
        frame.time + MELODY_ANALYSIS.hopSize / MELODY_ANALYSIS.analysisSampleRate / 4)!;
      const frequencies = frame.states.slice(1).map(state => state.pitchHz!);
      assert.equal(frequencies.length, observation.candidates.length);
      frequencies.forEach((frequency, candidateIndex) =>
        assert.ok(Math.abs(frequency - observation.candidates[candidateIndex].pitchHz) < 1e-3));
    });
    const matrix = characterizeMelodyPath(`SCORE_${entry.amplitude}`, entry.result.evidence, GROUND_TRUTH_BASS);
    assert.equal(matrix.metrics.candidateMatches, 500);
    assert.equal(matrix.metrics.pathMatches, expectedPathMatches[index]);
  });
  const baseline = conditions().find(entry => entry.amplitude === 0.20)!;
  const noCliff = analyzeMelodyWithNoCliffExperiment({
    mono: baseline.signal, sampleRate: CALIBRATION_SAMPLE_RATE,
  });
  assert.deepEqual(noCliff.dpDiagnostics.frames.map(frame => frame.states.slice(1).map(state => ({
    pitchHz: state.pitchHz,
    score: state.candidateScore,
    diagnostic: state.candidateScoreDiagnostic,
  }))), baseline.result.dpDiagnostics.frames.map(frame => frame.states.slice(1).map(state => ({
    pitchHz: state.pitchHz,
    score: state.candidateScore,
    diagnostic: state.candidateScoreDiagnostic,
  }))));
});

test('raw winner lookup, score/component deltas, ranks, and first divergences are deterministic', () => {
  const reports = conditions().map(entry => ({
    amplitude: entry.amplitude,
    pairs: entry.pairs.length,
    correct: entry.pairs.filter(pair => pair.winnerIsMelody).length,
    wrong: entry.pairs.filter(pair => !pair.winnerIsMelody).length,
    ranks: rankDistribution(entry.pairs),
    firstWrongFrame: entry.pairs.find(pair => !pair.winnerIsMelody)?.frame.frameIndex ?? null,
  }));
  assert.deepEqual(reports, [
    { amplitude: 0, pairs: 500, correct: 500, wrong: 0,
      ranks: { rank1: 500, rank2: 0, rank3: 0, rank4: 0, rank5: 0, absent: 0 }, firstWrongFrame: null },
    { amplitude: 0.10, pairs: 500, correct: 500, wrong: 0,
      ranks: { rank1: 500, rank2: 0, rank3: 0, rank4: 0, rank5: 0, absent: 0 }, firstWrongFrame: null },
    { amplitude: 0.15, pairs: 500, correct: 275, wrong: 225,
      ranks: { rank1: 275, rank2: 225, rank3: 0, rank4: 0, rank5: 0, absent: 0 }, firstWrongFrame: 8 },
    { amplitude: 0.20, pairs: 500, correct: 57, wrong: 443,
      ranks: { rank1: 57, rank2: 101, rank3: 342, rank4: 0, rank5: 0, absent: 0 }, firstWrongFrame: 8 },
    { amplitude: 0.25, pairs: 500, correct: 4, wrong: 496,
      ranks: { rank1: 4, rank2: 101, rank3: 246, rank4: 149, rank5: 0, absent: 0 }, firstWrongFrame: 8 },
  ]);
  for (const entry of conditions()) {
    for (const pair of entry.pairs) {
      assert.equal(pair.winner, rawWinner(pair.frame));
      assert.ok(matchesPitchIdentity(pair.melody.pitchHz, pair.melodyHz));
      const scoreDelta = diagnostic(pair.winner).score - diagnostic(pair.melody).score;
      assert.ok(scoreDelta >= -1e-15);
      for (const key of COMPONENTS) {
        assert.equal(component(pair.winner, key) - component(pair.melody, key),
          diagnostic(pair.winner)[key] - diagnostic(pair.melody)[key]);
      }
    }
  }
  const repeated = condition(0.20);
  const original = conditions().find(entry => entry.amplitude === 0.20)!;
  assert.deepEqual(repeated.pairs.map(pair => ({
    frame: pair.frame.frameIndex,
    melody: pair.melody.candidateScoreDiagnostic,
    winner: pair.winner.candidateScoreDiagnostic,
    classification: pair.classification,
  })), original.pairs.map(pair => ({
    frame: pair.frame.frameIndex,
    melody: pair.melody.candidateScoreDiagnostic,
    winner: pair.winner.candidateScoreDiagnostic,
    classification: pair.classification,
  })));
  const divergence020 = original.pairs.find(pair => !pair.winnerIsMelody)!;
  const divergence025 = conditions().find(entry => entry.amplitude === 0.25)!.pairs
    .find(pair => !pair.winnerIsMelody)!;
  assert.equal(diagnostic(divergence020.melody).score.toFixed(12), '0.537147586669');
  assert.equal(diagnostic(divergence020.winner).score.toFixed(12), '0.665955210809');
  assert.equal(diagnostic(divergence025.melody).score.toFixed(12), '0.457122942803');
  assert.equal(diagnostic(divergence025.winner).score.toFixed(12), '0.673028086144');
});

test('score decomposition characterizes matched competition without changing the algorithm', () => {
  const entries = conditions();
  const lines = ['\nMELODY CANDIDATE SCORE DECOMPOSITION',
    'formula: clamp01(0.50*periodicity + 0.40*salience + 0.10*energySupport)',
    'distribution fields are mean/median'];
  for (const entry of entries) {
    const correct = entry.pairs.filter(pair => pair.winnerIsMelody);
    const wrong = entry.pairs.filter(pair => !pair.winnerIsMelody);
    lines.push('', `AMP ${entry.amplitude.toFixed(2)} evaluated=${entry.pairs.length}`
      + ` correctLocal=${correct.length} wrongLocal=${wrong.length}`,
    summaryLine('correct-local', correct), summaryLine('wrong-local', wrong),
    `rank ${JSON.stringify(rankDistribution(entry.pairs))}`,
    `wrong dominance ${JSON.stringify(dominance(wrong))}`,
    `wrong frequency ratio ${JSON.stringify(distribution(wrong.map(pair => pair.frequencyRatio)))}`,
    `wrong cents ${JSON.stringify(distribution(wrong.map(pair => pair.cents)))}`);
    for (const classification of ['MELODY_OCTAVE_DOWN', 'BASS_MATCH', 'OTHER_PITCH'] as const) {
      const classified = wrong.filter(pair => pair.classification === classification);
      lines.push(summaryLine(classification, classified));
    }
  }

  const matchedLines = COMPONENTS.map(key => `${key}: ` + entries.map(entry => {
    const values = entry.pairs.map(pair => component(pair.melody, key));
    const stats = distribution(values);
    return `${entry.amplitude.toFixed(2)}=${compact(stats.mean)}/${compact(stats.median)}`;
  }).join(' | '));
  lines.push('', 'MATCHED GROUND-TRUTH MELODY mean/median', ...matchedLines);

  const healthy = entries.find(entry => entry.amplitude === 0.10)!;
  for (const amplitude of [0.20, 0.25] as const) {
    const failure = entries.find(entry => entry.amplitude === amplitude)!;
    const firstWrong = failure.pairs.find(pair => !pair.winnerIsMelody)!;
    const control = healthy.pairs.find(pair => pair.frame.frameIndex === firstWrong.frame.frameIndex)!;
    lines.push('', formatPair(`AMP ${amplitude.toFixed(2)} FIRST RAW-SCORE DIVERGENCE`, firstWrong),
      formatPair(`AMP 0.10 MATCHED MELODY VS STRONGEST COMPETITOR FOR ${amplitude.toFixed(2)}`,
        strongestCompetingPair(control)));
  }

  const snapshot = () => entries.map(entry => ({
    amplitude: entry.amplitude,
    ranks: rankDistribution(entry.pairs),
    summaries: componentSummary(entry.pairs),
    classes: Object.fromEntries(['MELODY_OCTAVE_DOWN', 'BASS_MATCH', 'OTHER_PITCH'].map(name =>
      [name, entry.pairs.filter(pair => pair.classification === name).length])),
  }));
  assert.deepEqual(snapshot(), snapshot());
  console.log(lines.join('\n'));
});
