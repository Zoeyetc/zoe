import type { PercussionAnalysis, PercussionDescriptors, PercussionHit, PercussionKind } from '../types.ts';

export type PercussionAnalysisFrame = Readonly<{
  time: number;
  rms: number;
  onsetStrength: number;
  sub: number;
  lowMid: number;
  mid: number;
  high: number;
  air: number;
  centroid: number;
  spread: number;
  flatness: number;
}>;

const clamp01 = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const mean = (values: readonly number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const ROLES: readonly PercussionKind[] = ['kick', 'snare', 'closed-hat', 'open-hat', 'tom', 'other-percussion'];
const REFRACTORY: Readonly<Record<PercussionKind, number>> = {
  kick: 0.075, snare: 0.065, 'closed-hat': 0.035, 'open-hat': 0.08, tom: 0.075, 'other-percussion': 0.05,
};
const ONSET_THRESHOLD = 0.2;
const CONFIDENCE_THRESHOLD = 0.34;
const CAPABILITY_THRESHOLD = 0.42;

export type PercussionClassification = Readonly<{
  role: PercussionKind;
  confidence: number;
  topScore: number;
  secondScore: number;
  margin: number;
  scores: Readonly<Record<PercussionKind, number>>;
}>;

/**
 * Transparent deterministic baseline. Scores combine spectral shape with decay;
 * low class margin is represented honestly as Other Percussive.
 */
export function classifyPercussion(descriptor: PercussionDescriptors): PercussionClassification {
  const d = descriptor;
  const short = clamp01(1 - d.duration / 0.16);
  const sustained = clamp01((d.duration - 0.07) / 0.35);
  const high = clamp01(d.highRatio + d.airRatio);
  const low = clamp01(d.subRatio + d.lowMidRatio);
  const broadband = clamp01(1 - Math.max(d.subRatio, d.lowMidRatio, d.midRatio, d.highRatio, d.airRatio));
  const named = {
    kick: clamp01(0.52 * d.subRatio + 0.18 * d.lowPersistence + 0.16 * (1 - d.centroid) + 0.14 * short),
    snare: clamp01(0.22 * d.midRatio + 0.18 * d.highRatio + 0.34 * d.flatness
      + 0.12 * broadband + 0.14 * short + 0.18 * d.centroid
      + (d.flatness > 0.72 && d.midRatio > 0.06 && d.lowMidRatio < 0.1 ? 0.18 : 0)),
    'closed-hat': clamp01((0.45 * high + 0.23 * d.centroid + 0.2 * short
      + 0.12 * (1 - d.highPersistence)) * (1 - 0.2 * d.flatness)),
    'open-hat': clamp01((0.38 * high + 0.2 * d.centroid + 0.25 * sustained
      + 0.17 * d.highPersistence) * (1 - 0.6 * d.flatness)),
    tom: clamp01(0.42 * d.lowMidRatio + 0.2 * d.midRatio + 0.16 * low + 0.14 * (1 - d.flatness) + 0.08 * d.lowPersistence),
  };
  const ranked = Object.entries(named).sort((a, b) => b[1] - a[1]) as [Exclude<PercussionKind, 'other-percussion'>, number][];
  const topScore = ranked[0][1];
  const secondScore = ranked[1][1];
  const margin = clamp01(topScore - secondScore);
  const transientQuality = clamp01(0.5 * d.onsetStrength + 0.3 * d.rms + 0.2 * (1 - Math.min(1, d.duration / 0.8)));
  const consistency = clamp01(topScore * 0.7 + margin * 1.6);
  const confidence = clamp01(0.38 * topScore + 0.28 * margin * 2 + 0.2 * transientQuality + 0.14 * consistency);
  const mixedOther = d.flatness > 0.65 && d.lowMidRatio > 0.12 && high > 0.4;
  const ambiguous = mixedOther || margin < 0.075 || topScore < 0.38;
  const role: PercussionKind = ambiguous ? 'other-percussion' : ranked[0][0];
  const otherScore = ambiguous ? clamp01(0.48 + (0.075 - margin) * 3 + broadband * 0.15) : clamp01(0.15 + broadband * 0.25);
  return { role, confidence: ambiguous ? Math.max(CONFIDENCE_THRESHOLD, confidence * 0.82) : confidence,
    topScore, secondScore, margin, scores: { ...named, 'other-percussion': otherScore } };
}

function descriptorFor(frames: readonly PercussionAnalysisFrame[], index: number, hopSeconds: number): PercussionDescriptors {
  const frame = frames[index];
  const bandTotal = Math.max(1e-9, frame.sub + frame.lowMid + frame.mid + frame.high + frame.air);
  const peakEnergy = Math.max(frame.rms, 1e-9);
  let tail = index + 1;
  while (tail < frames.length && tail - index < 24
    && frames[tail].rms > peakEnergy * 0.22) tail += 1;
  const duration = Math.max(hopSeconds, (tail - index) * hopSeconds);
  const tailFrames = frames.slice(index + 1, Math.min(frames.length, tail + 1));
  const highNow = frame.high + frame.air;
  const lowNow = frame.sub + frame.lowMid;
  const highPersistence = highNow > 1e-9
    ? clamp01(mean(tailFrames.map(item => item.high + item.air)) / highNow) : 0;
  const lowPersistence = lowNow > 1e-9
    ? clamp01(mean(tailFrames.map(item => item.sub + item.lowMid)) / lowNow) : 0;
  const endRms = frames[Math.min(frames.length - 1, tail)]?.rms ?? 0;
  return {
    subRatio: clamp01(frame.sub / bandTotal), lowMidRatio: clamp01(frame.lowMid / bandTotal),
    midRatio: clamp01(frame.mid / bandTotal), highRatio: clamp01(frame.high / bandTotal),
    airRatio: clamp01(frame.air / bandTotal), centroid: clamp01(frame.centroid), spread: clamp01(frame.spread),
    flatness: clamp01(frame.flatness), duration, decay: clamp01(1 - endRms / peakEnergy),
    onsetStrength: clamp01(frame.onsetStrength), highPersistence, lowPersistence, rms: clamp01(frame.rms),
  };
}

function emptyCounts(): Record<PercussionKind, number> {
  return { kick: 0, snare: 0, 'closed-hat': 0, 'open-hat': 0, tom: 0, 'other-percussion': 0 };
}

export function analyzePercussion(frames: readonly PercussionAnalysisFrame[], duration: number,
  sampleRate: number, hopSeconds: number): PercussionAnalysis {
  const localBaseline = (index: number) => mean(frames.slice(Math.max(0, index - 8), index).map(frame => frame.onsetStrength));
  const candidateIndices = frames.flatMap((frame, index) => {
    const previous = frames[index - 1]?.onsetStrength ?? 0;
    const next = frames[index + 1]?.onsetStrength ?? 0;
    const threshold = Math.max(ONSET_THRESHOLD, localBaseline(index) * 1.35 + 0.06);
    return index > 0 && frame.onsetStrength >= threshold && frame.onsetStrength >= previous
      && frame.onsetStrength >= next && frame.rms >= 0.025
      ? [index] : [];
  });
  const events: PercussionHit[] = [];
  const lastByRole = new Map<PercussionKind, number>();
  let lastAcceptedTime = -Infinity;
  for (const index of candidateIndices) {
    if (frames[index].time > duration - 0.3) continue;
    const descriptors = descriptorFor(frames, index, hopSeconds);
    const highDominance = descriptors.highRatio + descriptors.airRatio;
    // A long stable pitched body is a note/chord change, not a percussion event.
    // Long candidates survive only when their sustained high-frequency evidence
    // can represent an open hat or cymbal.
    if ((descriptors.duration > 0.45 && highDominance < 0.38)
      || (descriptors.flatness < 0.01 && descriptors.duration > 0.3)) continue;
    const classification = classifyPercussion(descriptors);
    if (classification.confidence < CONFIDENCE_THRESHOLD || descriptors.onsetStrength < ONSET_THRESHOLD) continue;
    const previous = lastByRole.get(classification.role) ?? -Infinity;
    if (frames[index].time - previous < REFRACTORY[classification.role]
      || frames[index].time - lastAcceptedTime < 0.03) continue;
    const intensity = clamp01(0.5 * descriptors.onsetStrength + 0.3 * descriptors.rms
      + 0.2 * Math.sqrt(descriptors.onsetStrength * descriptors.rms));
    const id = `percussion-${String(index).padStart(6, '0')}-${classification.role}`;
    events.push({ id, time: frames[index].time, type: classification.role, strength: intensity,
      confidence: classification.confidence, topScore: classification.topScore,
      secondScore: classification.secondScore, margin: classification.margin, descriptors });
    lastByRole.set(classification.role, frames[index].time);
    lastAcceptedTime = frames[index].time;
  }
  const classCounts = emptyCounts();
  for (const event of events) classCounts[event.type] += 1;
  const density = duration > 0 ? events.length / duration : 0;
  const confidence = events.length ? mean(events.map(event => event.confidence ?? 0)) : 0;
  const pathological = density > 28;
  const eventSpan = events.length > 1 ? events.at(-1)!.time - events[0].time : 0;
  const available = events.length >= 3 && eventSpan >= 0.5
    && confidence >= CAPABILITY_THRESHOLD && !pathological;
  return {
    version: 1, available, confidence: clamp01(confidence), candidateCount: candidateIndices.length,
    acceptedEventCount: events.length, eventDensity: Number.isFinite(density) ? density : 0,
    classCounts, events,
    metadata: {
      preprocessing: 'positive-spectral-difference-shared-stft', frameSize: 2048, hopSize: 1024,
      bandsHz: { sub: [20, 160], lowMid: [160, 600], mid: [600, 2500],
        high: [2500, Math.min(8000, sampleRate / 2)], air: [Math.min(8000, sampleRate / 2), sampleRate / 2] },
      descriptorNormalization: 'unit-energy-ratios-and-nyquist-normalized-moments',
      classifier: 'deterministic-rule-scores-v1', onsetThreshold: ONSET_THRESHOLD,
      confidenceThreshold: CONFIDENCE_THRESHOLD, capabilityThreshold: CAPABILITY_THRESHOLD,
      refractorySeconds: REFRACTORY,
    },
  };
}

export const PERCUSSION_ROLES = ROLES;
