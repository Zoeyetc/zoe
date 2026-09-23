import type { BeatMarker, RhythmAnalysis, TempoCandidate } from '../types';

export const RHYTHM_ANALYSIS = {
  version: 1,
  minimumBpm: 60,
  maximumBpm: 200,
  bpmStep: 0.5,
  minimumDuration: 4,
  minimumOnsetPeaks: 5,
  confidenceThreshold: 0.56,
  onsetPeakThreshold: 0.24,
  scoreWeights: {
    fullBandPeriodicity: 0.25,
    lowBandPeriodicity: 0.25,
    subdivisionSupport: 0.12,
    energyPulseSupport: 0.1,
    gridSupport: 0.24,
    expectedRangePrior: 0.04,
  },
} as const;

export type RhythmEnvelopeFrame = Readonly<{
  time: number;
  onsetStrength: number;
  fullBandOnset?: number;
  lowBandOnset?: number;
  highBandOnset?: number;
  energy?: number;
}>;

type EvidenceChannels = Readonly<{
  full: readonly number[];
  low: readonly number[];
  high: readonly number[];
  energy: readonly number[];
  primary: readonly number[];
}>;

const clamp01 = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const interpolate = (values: readonly number[], position: number) => {
  if (position <= 0) return values[0] ?? 0;
  if (position >= values.length - 1) return values.at(-1) ?? 0;
  const left = Math.floor(position);
  const fraction = position - left;
  return (values[left] ?? 0) + ((values[left + 1] ?? 0) - (values[left] ?? 0)) * fraction;
};
const mean = (values: readonly number[]) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const median = (values: readonly number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

function prepare(values: readonly number[]) {
  const baseline = median(values);
  return values.map(value => clamp01(value - baseline));
}

function peakIndices(values: readonly number[], threshold: number = RHYTHM_ANALYSIS.onsetPeakThreshold) {
  const peaks: number[] = [];
  for (let index = 1; index < values.length - 1; index += 1) {
    const value = values[index];
    if (value >= threshold && value >= values[index - 1] && value > values[index + 1]) peaks.push(index);
  }
  return peaks;
}

function correlationAtLag(values: readonly number[], lag: number) {
  let numerator = 0; let leftEnergy = 0; let rightEnergy = 0; let comparisons = 0;
  for (let index = 0; index + lag < values.length; index += 1) {
    const left = values[index];
    const right = interpolate(values, index + lag);
    numerator += left * right;
    leftEnergy += left * left;
    rightEnergy += right * right;
    comparisons += 1;
  }
  if (leftEnergy <= 1e-12 || rightEnergy <= 1e-12) return 0;
  const coverage = comparisons / Math.max(1, values.length);
  return clamp01(numerator / Math.sqrt(leftEnergy * rightEnergy) * (0.82 + 0.18 * coverage));
}

function bestGridSupport(bpm: number, duration: number, values: readonly number[], peaks: readonly number[], hopSeconds: number) {
  const period = 60 / bpm;
  const offsets = peaks.slice(0, 64).map(index => (index * hopSeconds) % period);
  if (!offsets.length) return { offset: 0, strength: 0, coverage: 0 };
  let best = { offset: offsets[0], strength: 0, coverage: 0 };
  for (const offset of offsets) {
    const grid: number[] = [];
    for (let time = offset; time < duration; time += period) grid.push(interpolate(values, time / hopSeconds));
    const snapWindow = Math.max(hopSeconds * 1.5, period * 0.12);
    const explained = peaks.filter(index => {
      const time = index * hopSeconds;
      const nearest = offset + Math.round((time - offset) / period) * period;
      return Math.abs(time - nearest) <= snapWindow;
    }).length / Math.max(1, peaks.length);
    const candidate = { offset, strength: mean(grid), coverage: explained };
    if (candidate.strength * 0.55 + candidate.coverage * 0.45 > best.strength * 0.55 + best.coverage * 0.45) best = candidate;
  }
  return best;
}

function familyBpmFor(bpm: number) {
  let family = bpm;
  while (family >= 120) family /= 2;
  return Math.round(family * 2) / 2;
}

function rankTempoCandidates(channels: EvidenceChannels, duration: number, hopSeconds: number) {
  const primaryPeaks = peakIndices(channels.primary);
  const all: TempoCandidate[] = [];
  for (let bpm = RHYTHM_ANALYSIS.minimumBpm; bpm <= RHYTHM_ANALYSIS.maximumBpm; bpm += RHYTHM_ANALYSIS.bpmStep) {
    const lag = 60 / bpm / hopSeconds;
    const fullBandPeriodicity = correlationAtLag(channels.full, lag);
    const lowBandPeriodicity = correlationAtLag(channels.low, lag);
    const subdivisionSupport = Math.max(correlationAtLag(channels.high, lag), correlationAtLag(channels.high, lag / 2));
    const energyPulseSupport = correlationAtLag(channels.energy, lag);
    const grid = bestGridSupport(bpm, duration, channels.primary, primaryPeaks, hopSeconds);
    const gridSupport = clamp01(grid.strength * 0.55 + grid.coverage * 0.45);
    const localOnlyHigh = Math.max(0, subdivisionSupport - Math.max(fullBandPeriodicity, lowBandPeriodicity));
    const ambiguityPenalty = clamp01(localOnlyHigh * 0.12);
    const expectedRangePrior = bpm >= 80 && bpm <= 160 ? 1 : 0.35;
    const weights = RHYTHM_ANALYSIS.scoreWeights;
    const score = clamp01(
      fullBandPeriodicity * weights.fullBandPeriodicity
      + lowBandPeriodicity * weights.lowBandPeriodicity
      + subdivisionSupport * weights.subdivisionSupport
      + energyPulseSupport * weights.energyPulseSupport
      + gridSupport * weights.gridSupport
      + expectedRangePrior * weights.expectedRangePrior
      - ambiguityPenalty,
    );
    all.push({ bpm, score, familyBpm: familyBpmFor(bpm), fullBandPeriodicity, lowBandPeriodicity,
      subdivisionSupport, energyPulseSupport, gridSupport, ambiguityPenalty });
  }
  all.sort((a, b) => b.score - a.score || a.bpm - b.bpm);
  return all;
}

function selectTempoFamily(all: readonly TempoCandidate[]) {
  const families = new Map<number, TempoCandidate[]>();
  for (const candidate of all) {
    const family = families.get(candidate.familyBpm) ?? [];
    family.push(candidate); families.set(candidate.familyBpm, family);
  }
  const rankedFamilies = [...families.entries()].map(([familyBpm, members]) => ({ familyBpm, members,
    score: Math.max(...members.map(member => member.score)) }))
    .sort((a, b) => b.score - a.score || a.familyBpm - b.familyBpm);
  const family = rankedFamilies[0];
  if (!family) return null;
  const representative = [...family.members].sort((a, b) => {
    const supportA = a.score + a.gridSupport * 0.35 + a.lowBandPeriodicity * 0.04
      + (a.bpm >= 80 && a.bpm <= 160 ? 0.05 : 0);
    const supportB = b.score + b.gridSupport * 0.35 + b.lowBandPeriodicity * 0.04
      + (b.bpm >= 80 && b.bpm <= 160 ? 0.05 : 0);
    return supportB - supportA || a.bpm - b.bpm;
  })[0];
  const margin = clamp01((family.score - (rankedFamilies[1]?.score ?? 0)) / 0.2);
  return { representative, margin };
}

function visibleCandidates(all: readonly TempoCandidate[], best: TempoCandidate) {
  const selected: TempoCandidate[] = [];
  const related = all.filter(candidate => {
    const ratio = candidate.bpm / best.bpm;
    return Math.abs(ratio - 0.5) <= 0.02 || Math.abs(ratio - 2) <= 0.04 || Math.abs(ratio - 1) <= 0.02;
  });
  for (const candidate of [...related, ...all]) {
    if (selected.every(existing => Math.abs(existing.bpm - candidate.bpm) >= 3)) selected.push(candidate);
    if (selected.length === 8) break;
  }
  return selected.sort((a, b) => b.score - a.score || a.bpm - b.bpm);
}

function trackBeats(best: TempoCandidate, duration: number, channels: EvidenceChannels, hopSeconds: number) {
  const period = 60 / best.bpm;
  const primaryPeaks = peakIndices(channels.primary);
  const highPeaks = peakIndices(channels.high, 0.3);
  const grid = bestGridSupport(best.bpm, duration, channels.primary, primaryPeaks, hopSeconds);
  const primaryTimes = primaryPeaks.map(index => index * hopSeconds);
  const highTimes = highPeaks.map(index => index * hopSeconds);
  const snapWindow = Math.max(hopSeconds * 1.5, period * 0.12);
  const beats: BeatMarker[] = [];
  const corrections: number[] = [];
  let supported = 0;
  for (let predicted = grid.offset, index = 0; predicted < duration; predicted += period, index += 1) {
    let tracked = predicted;
    let strength = interpolate(channels.primary, predicted / hopSeconds);
    for (const peakTime of primaryTimes) {
      if (Math.abs(peakTime - predicted) > snapWindow) continue;
      const candidateStrength = interpolate(channels.primary, peakTime / hopSeconds);
      if (candidateStrength > strength) { tracked = peakTime; strength = candidateStrength; }
    }
    if (strength < RHYTHM_ANALYSIS.onsetPeakThreshold * 0.7) {
      for (const peakTime of highTimes) {
        if (Math.abs(peakTime - predicted) > snapWindow * 0.65) continue;
        const candidateStrength = interpolate(channels.high, peakTime / hopSeconds) * 0.3;
        if (candidateStrength > strength) { tracked = peakTime; strength = candidateStrength; }
      }
    }
    if (beats.length && tracked <= beats.at(-1)!.time) tracked = Math.min(duration, beats.at(-1)!.time + period);
    if (tracked >= duration) break;
    if (strength >= RHYTHM_ANALYSIS.onsetPeakThreshold * 0.7) supported += 1;
    corrections.push(Math.abs(tracked - predicted));
    beats.push({ id: `real-beat-${index}`, index, time: tracked, strength: clamp01(strength) });
  }
  const support = beats.length ? supported / beats.length : 0;
  const pulseConsistency = beats.length > 2
    ? clamp01(1 - median(corrections) / Math.max(period * 0.12, hopSeconds)) : 0;
  const microtiming = corrections.length ? median(corrections) / Math.max(period * 0.12, hopSeconds) : 0;
  return { beats, support, pulseConsistency, microtiming: clamp01(microtiming), gridSupport: best.gridSupport };
}

function estimateSwing(beats: readonly BeatMarker[], highOnsets: readonly number[], hopSeconds: number) {
  const phases: number[] = [];
  for (let index = 0; index < beats.length - 1; index += 1) {
    const start = beats[index].time;
    const interval = beats[index + 1].time - start;
    let bestPhase = 0; let bestStrength = 0;
    for (let frame = Math.ceil((start + interval * 0.3) / hopSeconds);
      frame * hopSeconds < start + interval * 0.78; frame += 1) {
      const phase = (frame * hopSeconds - start) / interval;
      const strength = highOnsets[frame] ?? 0;
      if (strength > bestStrength) { bestStrength = strength; bestPhase = phase; }
    }
    if (bestStrength >= RHYTHM_ANALYSIS.onsetPeakThreshold) phases.push(bestPhase);
  }
  if (phases.length < 4) return { swing: 0, confidence: 0 };
  const center = median(phases);
  const spread = median(phases.map(phase => Math.abs(phase - center)));
  const confidence = clamp01(phases.length / Math.max(4, beats.length - 1)) * clamp01(1 - spread / 0.08);
  const swing = center > 0.54 && center < 0.76 ? clamp01((center - 0.5) / 0.22) : 0;
  return { swing: swing * confidence, confidence };
}

/** Deterministic multi-band rhythm evidence. Search remains 60–200 BPM; faster high-band periodicity is subdivision support. */
export function analyzeRhythm(frames: readonly RhythmEnvelopeFrame[], duration: number, hopSeconds: number): RhythmAnalysis {
  const emptyEvidence = { fullBandPeakCount: 0, lowBandPeakCount: 0, highBandPeakCount: 0,
    lowBandSupport: 0, subdivisionSupport: 0, energyPulseSupport: 0, gridSupport: 0,
    tempoFamilyMargin: 0, pulseConsistency: 0 };
  const unavailable = (tempoCandidates: readonly TempoCandidate[] = [], confidence = 0,
    evidence = emptyEvidence): RhythmAnalysis => ({ version: 1, searchBpm: [60, 200], available: false,
    bpm: null, confidence: clamp01(confidence), beatInterval: null, beats: [], beatsPerBar: null,
    groove: 0, swing: 0, swingConfidence: 0, tempoCandidates, evidence });
  if (duration < RHYTHM_ANALYSIS.minimumDuration || frames.length < 3 || !(hopSeconds > 0)) return unavailable();
  const full = prepare(frames.map(frame => frame.fullBandOnset ?? frame.onsetStrength));
  const hasLow = frames.some(frame => frame.lowBandOnset !== undefined);
  const low = prepare(frames.map(frame => frame.lowBandOnset ?? frame.onsetStrength));
  const hasHigh = frames.some(frame => frame.highBandOnset !== undefined);
  const high = prepare(frames.map(frame => frame.highBandOnset ?? 0));
  const energy = prepare(frames.map(frame => frame.energy ?? 0));
  const primary = full.map((value, index) => clamp01(value * (hasLow ? 0.58 : 1) + (low[index] ?? 0) * (hasLow ? 0.42 : 0)));
  const channels = { full, low, high, energy, primary };
  const fullPeaks = peakIndices(full); const lowPeaks = peakIndices(low); const highPeaks = peakIndices(high);
  if (Math.max(fullPeaks.length, lowPeaks.length) < RHYTHM_ANALYSIS.minimumOnsetPeaks) return unavailable();
  const ranked = rankTempoCandidates(channels, duration, hopSeconds);
  const tempoPeaks = hasLow && lowPeaks.length >= RHYTHM_ANALYSIS.minimumOnsetPeaks ? lowPeaks : fullPeaks;
  const spacings = tempoPeaks.slice(1).map((peak, index) => (peak - tempoPeaks[index]) * hopSeconds)
    .filter(spacing => spacing >= 0.3 && spacing <= 1.05);
  const onsetBpm = spacings.length >= 4 ? 60 / mean(spacings) : null;
  const all = ranked.map(candidate => ({ ...candidate, score: clamp01(candidate.score
    + (onsetBpm !== null ? clamp01(1 - Math.abs(candidate.bpm - onsetBpm) / 4) * 0.32 : 0)) }))
    .sort((a, b) => b.score - a.score || a.bpm - b.bpm);
  const selected = selectTempoFamily(all);
  if (!selected) return unavailable();
  const spacingMean = mean(spacings);
  const spacingSpread = spacingMean > 0 ? Math.sqrt(mean(spacings.map(value => (value - spacingMean) ** 2))) / spacingMean : 1;
  const spacingConsistency = clamp01(1 - spacingSpread / 0.18);
  const directGridCandidate = onsetBpm !== null && spacingConsistency >= 0.3
    ? all.find(candidate => Math.abs(candidate.bpm - onsetBpm) <= RHYTHM_ANALYSIS.bpmStep / 2) : undefined;
  const best = directGridCandidate && directGridCandidate.gridSupport >= 0.3
    ? directGridCandidate : selected.representative;
  const tempoFamilyMargin = Math.max(selected.margin, directGridCandidate ? spacingConsistency * 0.6 : 0);
  const tempoCandidates = visibleCandidates(all, best);
  const tracked = trackBeats(best, duration, channels, hopSeconds);
  const multiBandAgreement = hasLow
    ? clamp01(1 - Math.abs(best.fullBandPeriodicity - best.lowBandPeriodicity))
    : Math.max(best.fullBandPeriodicity, spacingConsistency);
  const confidence = clamp01(best.score * 0.42 + tracked.support * 0.24 + multiBandAgreement * 0.12
    + tempoFamilyMargin * 0.1 + tracked.pulseConsistency * 0.12);
  const evidence = { fullBandPeakCount: fullPeaks.length, lowBandPeakCount: lowPeaks.length,
    highBandPeakCount: highPeaks.length, lowBandSupport: best.lowBandPeriodicity,
    subdivisionSupport: hasHigh ? best.subdivisionSupport : 0, energyPulseSupport: best.energyPulseSupport,
    gridSupport: tracked.gridSupport, tempoFamilyMargin, pulseConsistency: tracked.pulseConsistency };
  if (confidence < RHYTHM_ANALYSIS.confidenceThreshold || tracked.support < 0.45) {
    return unavailable(tempoCandidates, confidence, evidence);
  }
  const swing = estimateSwing(tracked.beats, hasHigh ? high : full, hopSeconds);
  return { version: 1, searchBpm: [60, 200], available: true, bpm: best.bpm, confidence,
    beatInterval: 60 / best.bpm, beats: tracked.beats, beatsPerBar: null,
    groove: clamp01(tracked.microtiming * 0.65 + swing.swing * swing.confidence * 0.35),
    swing: swing.swing, swingConfidence: swing.confidence, tempoCandidates, evidence };
}
