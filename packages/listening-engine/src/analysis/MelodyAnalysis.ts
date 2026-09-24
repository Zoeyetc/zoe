import type { MelodyAnalysis, MelodyNote, MelodyPitchFrame } from '../types.ts';
import { createCompactMelodyEvidenceTimeline, retainMelodyRejectedCandidate } from '../melody-evidence/compactTimeline.ts';
import type {
  MelodyCandidateGenerationEvidence, MelodyEvidenceBuildFrame, MelodyEvidenceTimeline,
  MelodyFrameDecisionReason, MelodyRejectedCandidate, MelodyTrackDecisionReason,
} from '../melody-evidence/types.ts';
import type {
  MelodyCandidateScoreDiagnostic, MelodyDpDiagnostics, MelodyDpFrameDiagnostic, MelodyDpStateDiagnostic,
  MelodySubharmonicAmbiguityStateDiagnostic, MelodySubharmonicRelationDiagnostic, MelodyYinFrameDiagnostic,
} from '../diagnostics/dpDiagnostics.ts';
import { hzToMidi, midiToNoteName } from '../pitch.ts';

export const MELODY_ANALYSIS = {
  version: 1 as const,
  analysisSampleRate: 12_000 as const,
  frameSize: 2048 as const,
  hopSize: 192 as const,
  minimumHz: 80 as const,
  maximumHz: 1400 as const,
  maximumCandidates: 5,
  maximumHarmonics: 4,
  voicingThreshold: 0.56 as const,
  minimumRms: 0.0025,
  minimumNoteDuration: 0.08 as const,
  maximumMergeGap: 0.064 as const,
  availabilityThreshold: 0.58 as const,
  minimumUsableDuration: 0.5,
} as const;

export type MelodyAnalysisInput = Readonly<{
  mono: Float32Array;
  sampleRate: number;
}>;

type Candidate = {
  pitchHz: number;
  midiFloat: number;
  periodicity: number;
  salience: number;
  score: number;
  scoreDiagnostic: MelodyCandidateScoreDiagnostic | null;
};

type AnalyzedFrame = {
  time: number;
  rms: number;
  candidates: Candidate[];
  generation: MelodyCandidateGenerationEvidence;
  outOfRangeCandidateCount: number;
  rejectedCandidates: readonly Omit<MelodyRejectedCandidate, 'rank'>[];
};

type PathState = {
  candidate: Candidate | null;
  score: number;
  previous: number;
};

type TransitionTerms = Readonly<{
  pitchDistance: number | null;
  pitchDistanceContribution: number;
  octaveContribution: number;
  total: number;
}>;

type MutableDpStateDiagnostic = Omit<MelodyDpStateDiagnostic,
  'bestContinuationObjective' | 'objectiveThroughState'> & {
    bestContinuationObjective: number;
    objectiveThroughState: number;
};

export type MelodyLocalObjectiveVariant = 'BASELINE' | 'NO_CLIFF';
export const MELODY_SUBHARMONIC_AMBIGUITY = Object.freeze({
  relationshipToleranceCents: 50 as const,
  multiples: Object.freeze([2, 3, 4] as const),
  penalties: Object.freeze([0, 0.02, 0.04, 0.06, 0.08, 0.10] as const),
  eligibilityRule: 'USABLE_HIGHER_INTEGER_RELATED_CANDIDATE_COEXISTS' as const,
});
export type MelodySubharmonicAmbiguityPenalty = typeof MELODY_SUBHARMONIC_AMBIGUITY.penalties[number];

const clamp01 = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const YIN_WINDOW = Float64Array.from({ length: MELODY_ANALYSIS.frameSize }, (_, index) =>
  0.5 - 0.5 * Math.cos(2 * Math.PI * index / (MELODY_ANALYSIS.frameSize - 1)));
export { midiToNoteName } from '../pitch.ts';

function median(values: readonly number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

function percentile(values: readonly number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction))] ?? 0;
}

function weightedMedian(values: readonly { value: number; weight: number }[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, item) => sum + item.weight, 0);
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.weight;
    if (cumulative >= total / 2) return item.value;
  }
  return sorted.at(-1)?.value ?? 0;
}

/** Local deterministic box resampling; playback channels remain untouched. */
function resampleForAnalysis(input: Float32Array, sourceRate: number) {
  if (sourceRate === MELODY_ANALYSIS.analysisSampleRate) return input;
  const ratio = sourceRate / MELODY_ANALYSIS.analysisSampleRate;
  const output = new Float32Array(Math.max(1, Math.floor(input.length / ratio)));
  for (let index = 0; index < output.length; index += 1) {
    const from = Math.floor(index * ratio);
    const to = Math.max(from + 1, Math.min(input.length, Math.floor((index + 1) * ratio)));
    let sum = 0;
    for (let source = from; source < to; source += 1) sum += input[source] ?? 0;
    output[index] = sum / (to - from);
  }
  return output;
}

function harmonicAmplitude(frame: Float32Array, frequency: number, sampleRate: number) {
  let real = 0;
  let imaginary = 0;
  for (let index = 0; index < frame.length; index += 2) {
    const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * index / (frame.length - 1));
    const angle = 2 * Math.PI * frequency * index / sampleRate;
    const sample = frame[index] * window;
    real += sample * Math.cos(angle);
    imaginary -= sample * Math.sin(angle);
  }
  return 4 * Math.hypot(real, imaginary) / frame.length;
}

type HarmonicSalienceTerms = Readonly<{
  support: number;
  weightSum: number;
  normalizationDenominator: number;
  unclamped: number;
  salience: number;
}>;

function harmonicSalienceTerms(frame: Float32Array, frequency: number, rms: number): HarmonicSalienceTerms {
  if (rms <= 1e-12) return {
    support: 0, weightSum: 0, normalizationDenominator: 1e-9, unclamped: 0, salience: 0,
  };
  let support = 0;
  let weights = 0;
  for (let harmonic = 1; harmonic <= MELODY_ANALYSIS.maximumHarmonics; harmonic += 1) {
    const harmonicFrequency = frequency * harmonic;
    if (harmonicFrequency >= MELODY_ANALYSIS.analysisSampleRate / 2) break;
    const weight = 1 / harmonic;
    support += harmonicAmplitude(frame, harmonicFrequency, MELODY_ANALYSIS.analysisSampleRate) * weight;
    weights += weight;
  }
  const normalizationDenominator = Math.max(1e-9, rms * weights * 1.35);
  const unclamped = support / normalizationDenominator;
  return { support, weightSum: weights, normalizationDenominator, unclamped, salience: clamp01(unclamped) };
}

type YinLagDomain = Readonly<{
  minimumLag: number;
  maximumLag: number;
  difference: Float64Array;
  cumulative: Float64Array;
  localMinima: readonly number[];
  candidateLags: readonly number[];
  searchMode: 'LOCAL_MINIMA' | 'GLOBAL_MINIMUM_FALLBACK';
}>;

function calculateYinLagDomain(frame: Float32Array): YinLagDomain {
  const sampleRate = MELODY_ANALYSIS.analysisSampleRate;
  const minimumLag = Math.max(2, Math.floor(sampleRate / MELODY_ANALYSIS.maximumHz));
  const maximumLag = Math.min(MELODY_ANALYSIS.frameSize - 2,
    Math.ceil(sampleRate / MELODY_ANALYSIS.minimumHz));
  const difference = new Float64Array(maximumLag + 1);
  const cumulative = new Float64Array(maximumLag + 1);
  let running = 0;
  for (let lag = 1; lag <= maximumLag; lag += 1) {
    let sum = 0;
    let weightSum = 0;
    for (let index = 0; index + lag < frame.length; index += 2) {
      const delta = frame[index] - frame[index + lag];
      const weight = YIN_WINDOW[index] * YIN_WINDOW[index + lag];
      sum += delta * delta * weight;
      weightSum += weight;
    }
    difference[lag] = sum / Math.max(1e-9, weightSum);
    running += difference[lag];
    cumulative[lag] = running > 0 ? difference[lag] * lag / running : 1;
  }
  const localMinima: number[] = [];
  for (let lag = minimumLag + 1; lag < maximumLag; lag += 1) {
    if (cumulative[lag] <= cumulative[lag - 1] && cumulative[lag] < cumulative[lag + 1]
      && cumulative[lag] < 0.48) localMinima.push(lag);
  }
  if (localMinima.length) return {
    minimumLag, maximumLag, difference, cumulative,
    localMinima, candidateLags: localMinima, searchMode: 'LOCAL_MINIMA',
  };
  let best = minimumLag;
  for (let lag = minimumLag + 1; lag <= maximumLag; lag += 1) {
    if (cumulative[lag] < cumulative[best]) best = lag;
  }
  return {
    minimumLag, maximumLag, difference, cumulative,
    localMinima, candidateLags: [best], searchMode: 'GLOBAL_MINIMUM_FALLBACK',
  };
}

function analysisFrame(signal: Float32Array, start: number) {
  const frame = new Float32Array(MELODY_ANALYSIS.frameSize);
  frame.set(signal.subarray(start, Math.min(signal.length, start + frame.length)));
  const centerStart = Math.floor((frame.length - 512) / 2);
  let sumSquares = 0;
  for (let index = centerStart; index < centerStart + 512; index += 1) sumSquares += frame[index] * frame[index];
  return { frame, rms: Math.sqrt(sumSquares / 512) };
}

function scoreCandidate(integerLag: number, interpolatedLag: number, domain: YinLagDomain,
  frame: Float32Array, rms: number, collectScoreDiagnostics: boolean): Candidate {
  const pitchHz = MELODY_ANALYSIS.analysisSampleRate / interpolatedLag;
  const cumulativeDifference = domain.cumulative[integerLag];
  const midiFloat = hzToMidi(pitchHz);
  const periodicityUnclamped = 1 - cumulativeDifference;
  const periodicity = clamp01(periodicityUnclamped);
  const salienceTerms = harmonicSalienceTerms(frame, pitchHz, rms);
  const energySupportUnclamped = (rms - MELODY_ANALYSIS.minimumRms) / 0.035;
  const energySupport = clamp01(energySupportUnclamped);
  const periodicityContribution = periodicity * 0.50;
  const salienceContribution = salienceTerms.salience * 0.40;
  const energySupportContribution = energySupport * 0.10;
  const weightedSum = periodicityContribution + salienceContribution + energySupportContribution;
  const score = clamp01(weightedSum);
  const scoreDiagnostic: MelodyCandidateScoreDiagnostic | null = collectScoreDiagnostics ? Object.freeze({
    frequencyHz: pitchHz,
    midiFloat,
    integerLag,
    interpolatedLag,
    rawDifferenceLeft: domain.difference[integerLag - 1] ?? domain.difference[integerLag],
    rawDifference: domain.difference[integerLag],
    rawDifferenceRight: domain.difference[integerLag + 1] ?? domain.difference[integerLag],
    cumulativeDifferenceLeft: domain.cumulative[integerLag - 1] ?? domain.cumulative[integerLag],
    yinCumulativeDifference: cumulativeDifference,
    cumulativeDifferenceRight: domain.cumulative[integerLag + 1] ?? domain.cumulative[integerLag],
    candidateSearchMode: domain.searchMode,
    periodicityUnclamped,
    periodicity,
    periodicityWeight: 0.50,
    periodicityContribution,
    harmonicSupport: salienceTerms.support,
    harmonicWeightSum: salienceTerms.weightSum,
    salienceNormalizationDenominator: salienceTerms.normalizationDenominator,
    salienceUnclamped: salienceTerms.unclamped,
    salience: salienceTerms.salience,
    salienceWeight: 0.40,
    salienceContribution,
    frameRms: rms,
    minimumRms: MELODY_ANALYSIS.minimumRms,
    energyNormalizationSpan: 0.035,
    energySupportUnclamped,
    energySupport,
    energySupportWeight: 0.10,
    energySupportContribution,
    weightedSum,
    score,
  }) : null;
  return { pitchHz, midiFloat, periodicity, salience: salienceTerms.salience, score, scoreDiagnostic };
}

function candidateFrames(signal: Float32Array, collectScoreDiagnostics: boolean): AnalyzedFrame[] {
  const frames: AnalyzedFrame[] = [];
  for (let start = 0; start < signal.length; start += MELODY_ANALYSIS.hopSize) {
    const { frame, rms } = analysisFrame(signal, start);
    // Periodicity needs the long frame, while voicing boundaries use a short
    // center window so rests are not smeared by the 171 ms pitch aperture.
    const candidates: Candidate[] = [];
    let rejectedCandidates: readonly Omit<MelodyRejectedCandidate, 'rank'>[] = [];
    let outOfRangeCandidateCount = 0;
    let localMinimumCount = 0;
    let rawCandidateCount = 0;
    let inRangeCandidateCountBeforeDeduplication = 0;
    let duplicateCandidateRemovalCount = 0;
    let searchMode: MelodyCandidateGenerationEvidence['searchMode'] = 'NOT_RUN';
    if (rms >= MELODY_ANALYSIS.minimumRms) {
      const domain = calculateYinLagDomain(frame);
      localMinimumCount = domain.localMinima.length;
      searchMode = domain.searchMode;
      for (const lag of domain.candidateLags) {
        rawCandidateCount += 1;
        const left = domain.cumulative[lag - 1] ?? domain.cumulative[lag];
        const center = domain.cumulative[lag];
        const right = domain.cumulative[lag + 1] ?? domain.cumulative[lag];
        const denominator = left - 2 * center + right;
        const interpolatedLag = denominator === 0 ? lag : lag + 0.5 * (left - right) / denominator;
        const candidate = scoreCandidate(lag, interpolatedLag, domain, frame, rms, collectScoreDiagnostics);
        const pitchHz = candidate.pitchHz;
        if (!(pitchHz >= MELODY_ANALYSIS.minimumHz && pitchHz <= MELODY_ANALYSIS.maximumHz)) {
          outOfRangeCandidateCount += 1;
          rejectedCandidates = retainMelodyRejectedCandidate(rejectedCandidates, {
            frequencyHz: pitchHz,
            periodicity: candidate.periodicity,
            salience: candidate.salience,
            score: candidate.score,
            reason: pitchHz < MELODY_ANALYSIS.minimumHz ? 'BELOW_PITCH_RANGE' : 'ABOVE_PITCH_RANGE',
          });
          continue;
        }
        candidates.push(candidate);
        inRangeCandidateCountBeforeDeduplication += 1;
      }
      candidates.sort((a, b) => b.score - a.score || a.pitchHz - b.pitchHz);
      // Remove near-duplicates while preserving octave-related alternatives for the path stage.
      for (let index = candidates.length - 1; index >= 0; index -= 1) {
        if (candidates.slice(0, index).some(other => Math.abs(other.midiFloat - candidates[index].midiFloat) < 0.22)) {
          candidates.splice(index, 1);
          duplicateCandidateRemovalCount += 1;
        }
      }
      candidates.splice(MELODY_ANALYSIS.maximumCandidates);
    }
    const generation: MelodyCandidateGenerationEvidence = {
      attempted: rms >= MELODY_ANALYSIS.minimumRms,
      outcome: !(rms >= MELODY_ANALYSIS.minimumRms)
        ? 'NOT_ATTEMPTED_RMS_GATE'
        : rawCandidateCount === 0
          ? 'ATTEMPTED_NO_RAW_CANDIDATE'
          : inRangeCandidateCountBeforeDeduplication === 0
            ? 'RAW_CANDIDATES_ALL_RANGE_REJECTED'
            : 'USABLE_CANDIDATES_SURVIVED',
      searchMode,
      localMinimumCount,
      rawCandidateCount,
      inRangeCandidateCountBeforeDeduplication,
      duplicateCandidateRemovalCount,
    };
    frames.push({
      time: Math.min(signal.length / MELODY_ANALYSIS.analysisSampleRate,
        (start + MELODY_ANALYSIS.frameSize / 2) / MELODY_ANALYSIS.analysisSampleRate),
      rms,
      candidates,
      generation,
      outOfRangeCandidateCount,
      rejectedCandidates,
    });
    if (start + MELODY_ANALYSIS.frameSize >= signal.length && start > 0) break;
  }
  return frames;
}

/** Explicit test/debug seam. Full lag curves are never retained by normal analysis or AudioMap. */
export function inspectMelodyYinFrame(input: MelodyAnalysisInput, frameIndex: number): MelodyYinFrameDiagnostic {
  if (!Number.isInteger(frameIndex) || frameIndex < 0) throw new RangeError('frameIndex must be a non-negative integer');
  const signal = resampleForAnalysis(input.mono, input.sampleRate);
  const start = frameIndex * MELODY_ANALYSIS.hopSize;
  if (start >= signal.length) throw new RangeError('frameIndex is outside the analyzed signal');
  const { frame, rms } = analysisFrame(signal, start);
  const domain = calculateYinLagDomain(frame);
  const selected = new Set(domain.candidateLags);
  const minima = new Set(domain.localMinima);
  return Object.freeze({
    frameIndex,
    time: Math.min(signal.length / MELODY_ANALYSIS.analysisSampleRate,
      (start + MELODY_ANALYSIS.frameSize / 2) / MELODY_ANALYSIS.analysisSampleRate),
    rms,
    minimumLag: domain.minimumLag,
    maximumLag: domain.maximumLag,
    searchMode: domain.searchMode,
    localMinimumCount: domain.localMinima.length,
    selectedCandidateLags: Object.freeze([...domain.candidateLags]),
    lagPoints: Object.freeze(Array.from({ length: domain.maximumLag - domain.minimumLag + 1 }, (_, offset) => {
      const lag = domain.minimumLag + offset;
      const periodicityUnclamped = 1 - domain.cumulative[lag];
      return Object.freeze({
        lag,
        frequencyHz: MELODY_ANALYSIS.analysisSampleRate / lag,
        rawDifference: domain.difference[lag],
        cumulativeDifference: domain.cumulative[lag],
        periodicityUnclamped,
        periodicity: clamp01(periodicityUnclamped),
        isLocalMinimum: minima.has(lag),
        selectedForCandidateGeneration: selected.has(lag),
      });
    })),
  });
}

function transitionTerms(previous: Candidate | null, current: Candidate | null): TransitionTerms {
  if (!previous && !current) return {
    pitchDistance: null, pitchDistanceContribution: 0, octaveContribution: 0, total: 0.05,
  };
  if (!previous || !current) return {
    pitchDistance: null, pitchDistanceContribution: 0, octaveContribution: 0, total: -0.13,
  };
  const distance = Math.abs(previous.midiFloat - current.midiFloat);
  const octavePenalty = Math.abs(distance - 12) < 1.1 ? 0.20 : 0;
  const pitchDistanceContribution = -Math.min(0.42, distance * 0.035);
  const octaveContribution = -octavePenalty;
  return {
    pitchDistance: distance,
    pitchDistanceContribution,
    octaveContribution,
    total: pitchDistanceContribution - octavePenalty,
  };
}

const transitionScore = (previous: Candidate | null, current: Candidate | null) =>
  transitionTerms(previous, current).total;

function subharmonicAmbiguityForCandidates(candidates: readonly Candidate[], penalty: number) {
  return candidates.map((candidate, candidateIndex): MelodySubharmonicAmbiguityStateDiagnostic => {
    const relations: MelodySubharmonicRelationDiagnostic[] = [];
    for (const multiple of MELODY_SUBHARMONIC_AMBIGUITY.multiples) {
      const expectedHigherFrequency = candidate.pitchHz * multiple;
      candidates.forEach((higher, higherCandidateIndex) => {
        if (higherCandidateIndex === candidateIndex || higher.pitchHz <= candidate.pitchHz) return;
        const centsDeviation = 1200 * Math.log2(higher.pitchHz / expectedHigherFrequency);
        if (Math.abs(centsDeviation) > MELODY_SUBHARMONIC_AMBIGUITY.relationshipToleranceCents) return;
        relations.push(Object.freeze({
          multiple,
          centsDeviation,
          higherCandidateIndex,
          higherFrequencyHz: higher.pitchHz,
          higherOriginalScore: higher.score,
          higherPeriodicity: higher.periodicity,
          higherSalience: higher.salience,
        }));
      });
    }
    relations.sort((a, b) => a.multiple - b.multiple
      || Math.abs(a.centsDeviation) - Math.abs(b.centsDeviation)
      || a.higherCandidateIndex - b.higherCandidateIndex);
    const eligible = relations.length > 0;
    return Object.freeze({
      eligible,
      relations: Object.freeze(relations),
      originalCandidateScore: candidate.score,
      experimentalCandidateScore: candidate.score - (eligible ? penalty : 0),
      appliedPenalty: eligible ? penalty : 0,
    });
  });
}

function choosePath(frames: readonly AnalyzedFrame[], collectDiagnostics: boolean,
  localObjectiveVariant: MelodyLocalObjectiveVariant, ambiguityPenalty: number | null) {
  const layers: PathState[][] = [];
  const diagnosticLayers: MutableDpStateDiagnostic[][] | null = collectDiagnostics ? [] : null;
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];
    const states = [null, ...frame.candidates];
    const ambiguity = ambiguityPenalty === null ? null
      : subharmonicAmbiguityForCandidates(frame.candidates, ambiguityPenalty);
    const diagnosticLayer: MutableDpStateDiagnostic[] = [];
    const layer: PathState[] = states.map((candidate, stateIndex) => {
      const candidateScore = candidate ? ambiguity?.[stateIndex - 1]?.experimentalCandidateScore
        ?? candidate.score : null;
      const emission = candidateScore !== null
        ? candidateScore - (localObjectiveVariant === 'BASELINE'
          && candidateScore < MELODY_ANALYSIS.voicingThreshold ? 0.22 : 0)
        : frame.rms < MELODY_ANALYSIS.minimumRms ? 0.58 : 0.18;
      if (frameIndex === 0) {
        diagnosticLayer.push({
          stateIndex,
          candidateIndex: stateIndex === 0 ? null : stateIndex - 1,
          pitchHz: candidate?.pitchHz ?? null,
          midiFloat: candidate?.midiFloat ?? null,
          candidateScore: candidate?.score ?? null,
          candidateScoreDiagnostic: candidate?.scoreDiagnostic ?? null,
          localContribution: emission,
          predecessorStateIndex: null,
          predecessorCandidateIndex: null,
          predecessorCumulativeObjective: null,
          pitchDistance: null,
          pitchDistanceContribution: 0,
          octaveContribution: 0,
          transitionContribution: 0,
          cumulativeObjective: emission,
          predecessorBestTieCount: 0,
          bestContinuationObjective: 0,
          objectiveThroughState: emission,
          ...(candidate && ambiguity ? { subharmonicAmbiguity: ambiguity[stateIndex - 1] } : {}),
        });
        return { candidate, score: emission, previous: -1 };
      }
      let bestScore = -Infinity;
      let previous = 0;
      let bestTransition: TransitionTerms | null = null;
      let predecessorBestTieCount = 0;
      for (let previousIndex = 0; previousIndex < layers[frameIndex - 1].length; previousIndex += 1) {
        const previousState = layers[frameIndex - 1][previousIndex];
        const transition = transitionTerms(previousState.candidate, candidate);
        const score = previousState.score + transition.total + emission;
        if (score > bestScore) {
          bestScore = score;
          previous = previousIndex;
          bestTransition = transition;
          predecessorBestTieCount = 1;
        } else if (score === bestScore) predecessorBestTieCount += 1;
      }
      const predecessor = layers[frameIndex - 1][previous];
      diagnosticLayer.push({
        stateIndex,
        candidateIndex: stateIndex === 0 ? null : stateIndex - 1,
        pitchHz: candidate?.pitchHz ?? null,
        midiFloat: candidate?.midiFloat ?? null,
        candidateScore: candidate?.score ?? null,
        candidateScoreDiagnostic: candidate?.scoreDiagnostic ?? null,
        localContribution: emission,
        predecessorStateIndex: previous,
        predecessorCandidateIndex: previous === 0 ? null : previous - 1,
        predecessorCumulativeObjective: predecessor.score,
        pitchDistance: bestTransition!.pitchDistance,
        pitchDistanceContribution: bestTransition!.pitchDistanceContribution,
        octaveContribution: bestTransition!.octaveContribution,
        transitionContribution: bestTransition!.total,
        cumulativeObjective: bestScore,
        predecessorBestTieCount,
        bestContinuationObjective: 0,
        objectiveThroughState: bestScore,
        ...(candidate && ambiguity ? { subharmonicAmbiguity: ambiguity[stateIndex - 1] } : {}),
      });
      return { candidate, score: bestScore, previous };
    });
    layers.push(layer);
    if (diagnosticLayers) diagnosticLayers.push(diagnosticLayer);
  }
  const path: (Candidate | null)[] = Array(frames.length).fill(null);
  if (!layers.length) return { path, diagnostics: collectDiagnostics ? Object.freeze({
    localObjectiveVariant,
    optimizationDirection: 'MAXIMIZE' as const,
    tieBreak: 'FIRST_STATE_ON_EXACT_EQUALITY' as const,
    frames: Object.freeze([]),
    selectedTerminalStateIndex: 0,
    selectedTotalObjective: 0,
    terminalBestTieCount: 0,
  }) : null };
  let stateIndex = layers.at(-1)!.reduce((best, state, index, layer) => state.score > layer[best].score ? index : best, 0);
  const selectedTerminalStateIndex = stateIndex;
  const selectedTotalObjective = layers.at(-1)![stateIndex].score;
  const terminalBestTieCount = layers.at(-1)!.filter(state => state.score === selectedTotalObjective).length;
  const selectedPathStateIndexes = Array<number>(frames.length).fill(0);
  for (let frameIndex = layers.length - 1; frameIndex >= 0; frameIndex -= 1) {
    const state = layers[frameIndex][stateIndex];
    path[frameIndex] = state.candidate;
    selectedPathStateIndexes[frameIndex] = stateIndex;
    stateIndex = state.previous;
  }
  if (!diagnosticLayers) return { path, diagnostics: null };

  for (let frameIndex = layers.length - 2; frameIndex >= 0; frameIndex -= 1) {
    for (let currentIndex = 0; currentIndex < layers[frameIndex].length; currentIndex += 1) {
      let bestContinuationObjective = -Infinity;
      for (let nextIndex = 0; nextIndex < layers[frameIndex + 1].length; nextIndex += 1) {
        const nextDiagnostic = diagnosticLayers[frameIndex + 1][nextIndex];
        const continuation = transitionScore(layers[frameIndex][currentIndex].candidate,
          layers[frameIndex + 1][nextIndex].candidate)
          + nextDiagnostic.localContribution + nextDiagnostic.bestContinuationObjective;
        if (continuation > bestContinuationObjective) bestContinuationObjective = continuation;
      }
      diagnosticLayers[frameIndex][currentIndex].bestContinuationObjective = bestContinuationObjective;
      diagnosticLayers[frameIndex][currentIndex].objectiveThroughState =
        diagnosticLayers[frameIndex][currentIndex].cumulativeObjective + bestContinuationObjective;
    }
  }
  const diagnosticFrames: readonly MelodyDpFrameDiagnostic[] = Object.freeze(diagnosticLayers.map(
    (states, frameIndex) => {
      const candidateStates = states.slice(1);
      const localBestCandidate = candidateStates.reduce<MutableDpStateDiagnostic | null>(
        (best, state) => !best || state.localContribution > best.localContribution ? state : best, null);
      const prefixBestStateIndex = states.reduce((best, state, index) =>
        state.cumulativeObjective > states[best].cumulativeObjective ? index : best, 0);
      return Object.freeze({
        frameIndex,
        time: frames[frameIndex].time,
        rms: frames[frameIndex].rms,
        states: Object.freeze(states.map(state => Object.freeze({ ...state }))),
        localBestCandidateStateIndex: localBestCandidate?.stateIndex ?? null,
        prefixBestStateIndex,
        selectedPathStateIndex: selectedPathStateIndexes[frameIndex],
      });
    }));
  const diagnostics: MelodyDpDiagnostics = Object.freeze({
    localObjectiveVariant,
    optimizationDirection: 'MAXIMIZE',
    tieBreak: 'FIRST_STATE_ON_EXACT_EQUALITY',
    frames: diagnosticFrames,
    selectedTerminalStateIndex,
    selectedTotalObjective,
    terminalBestTieCount,
    ...(ambiguityPenalty === null ? {} : { subharmonicAmbiguityExperiment: Object.freeze({
      penalty: ambiguityPenalty,
      relationshipToleranceCents: MELODY_SUBHARMONIC_AMBIGUITY.relationshipToleranceCents,
      multiples: MELODY_SUBHARMONIC_AMBIGUITY.multiples,
      eligibilityRule: MELODY_SUBHARMONIC_AMBIGUITY.eligibilityRule,
    }) }),
  });
  return { path, diagnostics };
}

function contourFromPath(frames: readonly AnalyzedFrame[], path: readonly (Candidate | null)[]) {
  let octaveCorrectionCount = 0;
  let rejectedLowConfidenceFrameCount = 0;
  const mutable = path.map(candidate => candidate ? { ...candidate } : null);
  for (let index = 1; index < mutable.length - 1; index += 1) {
    const previous = mutable[index - 1];
    const current = mutable[index];
    const next = mutable[index + 1];
    if (!previous || !current || !next) continue;
    if (Math.abs(previous.midiFloat - next.midiFloat) < 0.45
      && Math.abs(Math.abs(current.midiFloat - previous.midiFloat) - 12) < 0.8) {
      mutable[index] = { ...current, pitchHz: (previous.pitchHz + next.pitchHz) / 2,
        midiFloat: (previous.midiFloat + next.midiFloat) / 2 };
      octaveCorrectionCount += 1;
    } else if (frames[index].candidates[0]
      && Math.abs(Math.abs(frames[index].candidates[0].midiFloat - current.midiFloat) - 12) < 1) {
      octaveCorrectionCount += 1;
    }
  }
  const decisions: Readonly<{
    candidate: Candidate | null;
    confidence: number;
    reason: MelodyFrameDecisionReason;
  }>[] = mutable.map((candidate, index) => {
    const previous = mutable[index - 1];
    const continuity = candidate && previous
      ? clamp01(1 - Math.abs(candidate.midiFloat - previous.midiFloat) / 6)
      : candidate ? 0.7 : 0;
    const confidence = candidate
      ? clamp01(candidate.score * 0.82 + continuity * 0.18)
      : 0;
    const voiced = candidate !== null && confidence >= MELODY_ANALYSIS.voicingThreshold
      && frames[index].rms >= MELODY_ANALYSIS.minimumRms;
    if (candidate && !voiced) rejectedLowConfidenceFrameCount += 1;
    const reason: MelodyFrameDecisionReason = frames[index].rms < MELODY_ANALYSIS.minimumRms
      ? 'LOW_RMS'
      : frames[index].candidates.length === 0
        ? 'NO_USABLE_CANDIDATE'
        : candidate === null
          ? 'PATH_SELECTED_NULL'
          : !voiced ? 'LOW_CONFIDENCE' : 'VOICED';
    return { candidate, confidence, reason };
  });
  const contour: MelodyPitchFrame[] = decisions.map(({ candidate, confidence }, index) => {
    const voiced = candidate !== null && confidence >= MELODY_ANALYSIS.voicingThreshold
      && frames[index].rms >= MELODY_ANALYSIS.minimumRms;
    return {
      time: frames[index].time,
      voiced,
      pitchHz: voiced ? candidate.pitchHz : null,
      midiFloat: voiced ? candidate.midiFloat : null,
      confidence: voiced ? confidence : 0,
      salience: voiced ? candidate.salience : 0,
    };
  });
  return { contour, decisions, octaveCorrectionCount, rejectedLowConfidenceFrameCount };
}

function mergeBriefGaps(contour: MelodyPitchFrame[]) {
  const hopSeconds = MELODY_ANALYSIS.hopSize / MELODY_ANALYSIS.analysisSampleRate;
  const maximumFrames = Math.floor(MELODY_ANALYSIS.maximumMergeGap / hopSeconds);
  for (let start = 0; start < contour.length; start += 1) {
    if (contour[start].voiced) continue;
    let end = start;
    while (end < contour.length && !contour[end].voiced) end += 1;
    const before = contour[start - 1];
    const after = contour[end];
    if (before?.voiced && after?.voiced && end - start <= maximumFrames
      && before.midiFloat !== null && after.midiFloat !== null
      && Math.abs(before.midiFloat - after.midiFloat) < 0.55) {
      for (let index = start; index < end; index += 1) {
        const fraction = (index - start + 1) / (end - start + 1);
        const midiFloat = before.midiFloat + (after.midiFloat - before.midiFloat) * fraction;
        contour[index] = {
          ...contour[index], voiced: true, midiFloat, pitchHz: midiToHz(midiFloat),
          confidence: Math.min(before.confidence, after.confidence) * 0.72,
          salience: Math.min(before.salience, after.salience) * 0.72,
        };
      }
    }
    start = end - 1;
  }
}

function segmentNotes(contour: MelodyPitchFrame[], frames: readonly AnalyzedFrame[], duration: number) {
  mergeBriefGaps(contour);
  const hopSeconds = MELODY_ANALYSIS.hopSize / MELODY_ANALYSIS.analysisSampleRate;
  const stabilityFrames = 3;
  const rmsReference = Math.max(1e-9, percentile(frames.map(frame => frame.rms), 0.95));
  const raw: { start: number; end: number; indices: number[] }[] = [];
  let indices: number[] = [];
  const close = () => {
    if (!indices.length) return;
    const start = Math.max(0, contour[indices[0]].time - hopSeconds / 2);
    const end = Math.min(duration, contour[indices.at(-1)!].time + hopSeconds / 2);
    raw.push({ start, end, indices });
    indices = [];
  };
  for (let index = 0; index < contour.length; index += 1) {
    const frame = contour[index];
    if (!frame.voiced || frame.midiFloat === null) { close(); continue; }
    if (indices.length >= stabilityFrames) {
      const currentMidi = weightedMedian(indices.map(frameIndex => ({
        value: contour[frameIndex].midiFloat!, weight: contour[frameIndex].confidence,
      })));
      const lookahead = contour.slice(index, index + stabilityFrames)
        .filter(next => next.voiced && next.midiFloat !== null);
      if (lookahead.length === stabilityFrames) {
        const pitches = lookahead.map(next => next.midiFloat!);
        const nextMidi = median(pitches);
        const stable = Math.max(...pitches) - Math.min(...pitches) < 0.28;
        if (stable && Math.abs(nextMidi - currentMidi) >= 0.78) close();
      }
    }
    indices.push(index);
  }
  close();

  let rejectedShortNoteCount = 0;
  const notes: MelodyNote[] = [];
  for (const segment of raw) {
    if (segment.end - segment.start < MELODY_ANALYSIS.minimumNoteDuration) {
      rejectedShortNoteCount += 1;
      continue;
    }
    const representative = weightedMedian(segment.indices.map(index => ({
      value: contour[index].midiFloat!, weight: contour[index].confidence,
    })));
    const midi = Math.round(representative);
    const confidence = median(segment.indices.map(index => contour[index].confidence));
    const intensity = clamp01(median(segment.indices.map(index => frames[index]?.rms ?? 0)) / rmsReference);
    notes.push({
      id: `real-note-${notes.length}`,
      start: segment.start,
      end: segment.end,
      midi,
      pitchHz: midiToHz(representative),
      noteName: midiToNoteName(midi),
      intensity,
      confidence,
    });
  }
  return { notes, rejectedShortNoteCount };
}

function metadata(): MelodyAnalysis['metadata'] {
  return {
    analysisSampleRate: 12000, frameSize: 2048, hopSize: 192,
    voicingThreshold: 0.56, minimumNoteDuration: 0.08,
    maximumMergeGap: 0.064, availabilityThreshold: 0.58,
  };
}

/** Deterministic local predominant-melody foundation. No actor or runtime clock state enters analysis. */
export function analyzeMelody(input: MelodyAnalysisInput): MelodyAnalysis {
  return runMelodyAnalysis(input, false, false, 'BASELINE', null).analysis;
}

export type MelodyAnalysisWithEvidence = Readonly<{
  analysis: MelodyAnalysis;
  evidence: MelodyEvidenceTimeline;
}>;

export function analyzeMelodyWithEvidence(input: MelodyAnalysisInput): MelodyAnalysisWithEvidence {
  const result = runMelodyAnalysis(input, true, false, 'BASELINE', null);
  return { analysis: result.analysis, evidence: result.evidence! };
}

export type MelodyAnalysisWithDpDiagnostics = MelodyAnalysisWithEvidence & Readonly<{
  dpDiagnostics: MelodyDpDiagnostics;
}>;

/** Explicit diagnostic path. Normal analysis and retained evidence do not allocate DP decomposition storage. */
export function analyzeMelodyWithDpDiagnostics(input: MelodyAnalysisInput): MelodyAnalysisWithDpDiagnostics {
  const result = runMelodyAnalysis(input, true, true, 'BASELINE', null);
  return { analysis: result.analysis, evidence: result.evidence!, dpDiagnostics: result.dpDiagnostics! };
}

/** Explicit A/B experiment. The production entry points never select this local objective. */
export function analyzeMelodyWithNoCliffExperiment(input: MelodyAnalysisInput): MelodyAnalysisWithDpDiagnostics {
  const result = runMelodyAnalysis(input, true, true, 'NO_CLIFF', null);
  return { analysis: result.analysis, evidence: result.evidence!, dpDiagnostics: result.dpDiagnostics! };
}

/** Isolated A/B entry point. Raw candidates and production entry points remain baseline. */
export function analyzeMelodyWithSubharmonicAmbiguityExperiment(input: MelodyAnalysisInput,
  options: Readonly<{ penalty: MelodySubharmonicAmbiguityPenalty }>): MelodyAnalysisWithDpDiagnostics {
  if (!MELODY_SUBHARMONIC_AMBIGUITY.penalties.includes(options.penalty)) {
    throw new RangeError('penalty must be one of the fixed Subharmonic Ambiguity sweep values');
  }
  const result = runMelodyAnalysis(input, true, true, 'BASELINE', options.penalty);
  return { analysis: result.analysis, evidence: result.evidence!, dpDiagnostics: result.dpDiagnostics! };
}

function runMelodyAnalysis(input: MelodyAnalysisInput, collectEvidence: boolean,
  collectDpDiagnostics: boolean, localObjectiveVariant: MelodyLocalObjectiveVariant,
  ambiguityPenalty: MelodySubharmonicAmbiguityPenalty | null) {
  const signal = resampleForAnalysis(input.mono, input.sampleRate);
  const duration = input.mono.length / input.sampleRate;
  const frames = candidateFrames(signal, collectDpDiagnostics);
  const pathResult = choosePath(frames, collectDpDiagnostics, localObjectiveVariant, ambiguityPenalty);
  const path = pathResult.path;
  const contourResult = contourFromPath(frames, path);
  const contour = [...contourResult.contour];
  const segmented = segmentNotes(contour, frames, duration);
  const voicedFrames = contour.filter(frame => frame.voiced);
  const voicedFrameRatio = contour.length ? voicedFrames.length / contour.length : 0;
  const medianVoicedConfidence = median(voicedFrames.map(frame => frame.confidence));
  const usableDuration = segmented.notes.reduce((sum, note) => sum + (note.end - note.start), 0);
  const medianNoteConfidence = median(segmented.notes.map(note => note.confidence ?? 0));
  const adjacentVoiced = contour.slice(1).flatMap((frame, index) => {
    const previous = contour[index];
    return frame.voiced && previous.voiced && frame.midiFloat !== null && previous.midiFloat !== null
      ? [Math.abs(frame.midiFloat - previous.midiFloat)] : [];
  });
  const continuity = adjacentVoiced.length
    ? adjacentVoiced.filter(jump => jump < 3).length / adjacentVoiced.length
    : 0;
  const confidence = clamp01(
    medianVoicedConfidence * 0.38
    + clamp01(voicedFrameRatio / 0.35) * 0.22
    + clamp01(usableDuration / MELODY_ANALYSIS.minimumUsableDuration) * 0.25
    + continuity * 0.15,
  );
  const available = confidence >= MELODY_ANALYSIS.availabilityThreshold
    && usableDuration >= MELODY_ANALYSIS.minimumUsableDuration
    && voicedFrameRatio >= 0.12
    && segmented.notes.length > 0;
  const reliableMidi = voicedFrames.flatMap(frame => frame.midiFloat === null ? [] : [frame.midiFloat]);
  const analysis: MelodyAnalysis = {
    version: 1,
    available,
    confidence,
    voicedFrameRatio,
    pitchRange: {
      minHz: 80,
      maxHz: 1400,
      minMidi: reliableMidi.length ? Math.floor(Math.min(...reliableMidi)) : null,
      maxMidi: reliableMidi.length ? Math.ceil(Math.max(...reliableMidi)) : null,
    },
    contour,
    notes: available ? segmented.notes : [],
    medianNoteConfidence: available ? medianNoteConfidence : 0,
    octaveCorrectionCount: contourResult.octaveCorrectionCount,
    rejectedLowConfidenceFrameCount: contourResult.rejectedLowConfidenceFrameCount,
    rejectedShortNoteCount: segmented.rejectedShortNoteCount,
    metadata: metadata(),
  };
  if (!collectEvidence) return { analysis, evidence: null, dpDiagnostics: pathResult.diagnostics };

  const evidenceFrames: MelodyEvidenceBuildFrame[] = frames.map((frame, index) => {
    const selected = path[index];
    const selectedCandidateIndex = selected === null ? null : frame.candidates.indexOf(selected);
    const decision = contourResult.decisions[index];
    const finalContour = contour[index];
    const mergedGap = finalContour.voiced && decision.reason !== 'VOICED';
    return {
      time: frame.time,
      rms: frame.rms,
      candidates: frame.candidates,
      generation: frame.generation,
      outOfRangeCandidateCount: frame.outOfRangeCandidateCount,
      rejectedCandidates: frame.rejectedCandidates,
      selectedCandidateIndex: selectedCandidateIndex === -1 ? null : selectedCandidateIndex,
      finalPitchHz: mergedGap ? finalContour.pitchHz : decision.candidate?.pitchHz ?? null,
      finalConfidence: mergedGap ? finalContour.confidence : decision.confidence,
      finalSalience: mergedGap ? finalContour.salience : decision.candidate?.salience ?? 0,
      voiced: finalContour.voiced,
      reason: mergedGap ? 'MERGED_GAP' : decision.reason,
    };
  });
  const trackReasons: MelodyTrackDecisionReason[] = [];
  if (available) trackReasons.push('ACCEPTED');
  else {
    if (confidence < MELODY_ANALYSIS.availabilityThreshold) trackReasons.push('TRACK_LOW_CONFIDENCE');
    if (usableDuration < MELODY_ANALYSIS.minimumUsableDuration) trackReasons.push('TRACK_LOW_USABLE_DURATION');
    if (voicedFrameRatio < 0.12) trackReasons.push('TRACK_LOW_VOICED_RATIO');
    if (segmented.notes.length === 0) trackReasons.push('TRACK_NO_NOTES');
  }
  const evidence = createCompactMelodyEvidenceTimeline(evidenceFrames, {
    minimumRms: MELODY_ANALYSIS.minimumRms,
    minimumHz: MELODY_ANALYSIS.minimumHz,
    maximumHz: MELODY_ANALYSIS.maximumHz,
    voicingConfidence: MELODY_ANALYSIS.voicingThreshold,
    trackConfidence: MELODY_ANALYSIS.availabilityThreshold,
    minimumUsableDuration: MELODY_ANALYSIS.minimumUsableDuration,
    minimumVoicedFrameRatio: 0.12,
    minimumNoteDuration: MELODY_ANALYSIS.minimumNoteDuration,
  }, {
    available,
    confidence,
    voicedFrameRatio,
    usableDuration,
    noteCountBeforeTrackGate: segmented.notes.length,
    acceptedNoteCount: analysis.notes.length,
    rejectedShortNoteCount: segmented.rejectedShortNoteCount,
    noteReasons: segmented.rejectedShortNoteCount > 0 ? ['SHORT_NOTE'] : [],
    reasons: trackReasons,
  });
  return { analysis, evidence, dpDiagnostics: pathResult.diagnostics };
}
