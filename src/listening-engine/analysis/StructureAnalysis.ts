import type { ArrangementChange, BeatMarker, StructureAnalysis, StructureAnalysisFrame } from '../types.ts';

export const STRUCTURE_ANALYSIS = {
  version: 1 as const,
  minimumDuration: 12,
  minimumFrames: 12,
  fallbackWindowDuration: 1,
  maximumFrameCount: 384,
  targetNoveltySideDurations: [2, 4, 8] as const,
  minimumBoundarySeparation: 4,
  minimumArrangementSpacing: 2,
  minimumSectionDuration: 8,
  strongBoundaryMinimumSectionDuration: 4,
  minimumArrangementScore: 0.32,
  minimumSectionScore: 0.46,
  strongBoundaryScore: 0.8,
  recurrenceThreshold: 0.82,
  exactRecurrenceThreshold: 0.94,
  capabilityThreshold: 0.48,
  beatBlockSizes: [8, 16, 32] as const,
} as const;

export const STRUCTURE_FEATURE_DIMENSIONS = Object.freeze([
  'chroma-c', 'chroma-c-sharp', 'chroma-d', 'chroma-d-sharp', 'chroma-e', 'chroma-f',
  'chroma-f-sharp', 'chroma-g', 'chroma-g-sharp', 'chroma-a', 'chroma-a-sharp', 'chroma-b',
  'spectral-low-ratio', 'spectral-mid-ratio', 'spectral-high-ratio',
  'brightness', 'texture', 'onset-density',
] as const);

const CORE_FEATURE_DIMENSIONS = Object.freeze([
  ...STRUCTURE_FEATURE_DIMENSIONS.slice(0, 14),
]);
const ARRANGEMENT_FEATURE_DIMENSIONS = Object.freeze([
  'brightness', 'texture', 'spectral-high-ratio', 'local-onset-density', 'local-energy',
]);

export type StructureSourceFrame = Readonly<{
  time: number;
  chroma: readonly number[];
  low: number;
  mid: number;
  high: number;
  brightness: number;
  texture: number;
  rms: number;
  onsetStrength: number;
}>;

type Bin = { start: number; end: number; raw: number[]; core: number[]; arrangement: number[];
  energy: number; onsetDensity: number };

const clamp01 = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const mean = (values: readonly number[]) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const median = (values: readonly number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const averageVectors = (vectors: readonly (readonly number[])[], dimensions = vectors[0]?.length ?? 0) => vectors.length
  ? Array.from({ length: dimensions }, (_, dimension) => mean(vectors.map(vector => vector[dimension] ?? 0)))
  : Array(dimensions).fill(0);
const cosine = (left: readonly number[], right: readonly number[]) => {
  let dot = 0; let leftNorm = 0; let rightNorm = 0;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index] ?? 0; const b = right[index] ?? 0;
    dot += a * b; leftNorm += a * a; rightNorm += b * b;
  }
  if (leftNorm <= 1e-12 || rightNorm <= 1e-12) {
    return left.every((value, index) => Math.abs(value - (right[index] ?? 0)) < 1e-9) ? 1 : 0;
  }
  return Math.max(-1, Math.min(1, dot / Math.sqrt(leftNorm * rightNorm)));
};
const similarity01 = (left: readonly number[], right: readonly number[]) => clamp01((cosine(left, right) + 1) / 2);

function makeBin(included: readonly StructureSourceFrame[], start: number, end: number): Bin {
  const chroma = averageVectors(included.map(frame => frame.chroma.slice(0, 12)), 12);
  const bands = [mean(included.map(frame => frame.low)), mean(included.map(frame => frame.mid)), mean(included.map(frame => frame.high))];
  const bandTotal = bands.reduce((sum, value) => sum + value, 0);
  const ratios = bands.map(value => bandTotal > 1e-9 ? value / bandTotal : 0);
  const brightness = mean(included.map(frame => frame.brightness));
  const texture = mean(included.map(frame => frame.texture));
  const onsetDensity = mean(included.map(frame => frame.onsetStrength));
  const energy = clamp01(mean(included.map(frame => frame.rms)) * 0.8 + onsetDensity * 0.2);
  const raw = [...chroma, ...ratios, brightness, texture, onsetDensity];
  // High-band ratio and local density are retained but deliberately downweighted in core identity.
  const coreBandTotal = bands[0] + bands[1];
  const core = [...chroma, coreBandTotal > 1e-9 ? bands[0] / coreBandTotal : 0,
    coreBandTotal > 1e-9 ? bands[1] / coreBandTotal : 0];
  const arrangement = [brightness, texture, ratios[2], onsetDensity, energy];
  return { start, end, raw, core, arrangement, energy, onsetDensity };
}

function aggregateSourceFrames(source: readonly StructureSourceFrame[], duration: number, beats: readonly BeatMarker[] | null) {
  const beatMode = beats !== null && beats.length >= STRUCTURE_ANALYSIS.minimumFrames;
  const edges = beatMode
    ? [...beats.map(beat => beat.time).filter(time => time >= 0 && time < duration), duration]
    : Array.from({ length: Math.ceil(duration / STRUCTURE_ANALYSIS.fallbackWindowDuration) + 1 }, (_, index) =>
      Math.min(duration, index * STRUCTURE_ANALYSIS.fallbackWindowDuration));
  if (edges[0] !== 0) edges.unshift(0);
  const uniqueEdges = edges.filter((time, index) => index === 0 || time > edges[index - 1] + 1e-6);
  const bins: Bin[] = [];
  for (let index = 0; index < uniqueEdges.length - 1; index += 1) {
    const start = uniqueEdges[index]; const end = uniqueEdges[index + 1];
    const included = source.filter(frame => frame.time >= start && (frame.time < end || (end === duration && frame.time <= end)));
    if (included.length && end > start) bins.push(makeBin(included, start, end));
  }
  if (bins.length <= STRUCTURE_ANALYSIS.maximumFrameCount) return { bins, beatMode };
  const groupSize = Math.ceil(bins.length / STRUCTURE_ANALYSIS.maximumFrameCount);
  const reduced: Bin[] = [];
  for (let index = 0; index < bins.length; index += groupSize) {
    const group = bins.slice(index, index + groupSize);
    reduced.push({ start: group[0].start, end: group.at(-1)!.end,
      raw: averageVectors(group.map(bin => bin.raw)), core: averageVectors(group.map(bin => bin.core)),
      arrangement: averageVectors(group.map(bin => bin.arrangement)), energy: mean(group.map(bin => bin.energy)),
      onsetDensity: mean(group.map(bin => bin.onsetDensity)) });
  }
  return { bins: reduced, beatMode };
}

function normalize(vectors: readonly (readonly number[])[]) {
  if (!vectors.length) return [];
  const means = vectors[0].map((_, dimension) => mean(vectors.map(vector => vector[dimension])));
  const deviations = means.map((center, dimension) => Math.sqrt(mean(vectors.map(vector => (vector[dimension] - center) ** 2))));
  return vectors.map(vector => {
    const z = vector.map((value, dimension) => deviations[dimension] > 1e-6
      ? Math.max(-3, Math.min(3, (value - means[dimension]) / deviations[dimension])) : 0);
    const norm = Math.hypot(...z);
    return norm > 1e-9 ? z.map(value => value / norm) : z;
  });
}

function createSelfSimilarity(vectors: readonly (readonly number[])[]) {
  const size = vectors.length;
  const values = new Float32Array(size * size);
  for (let left = 0; left < size; left += 1) {
    for (let right = left; right < size; right += 1) {
      const value = similarity01(vectors[left], vectors[right]);
      values[left * size + right] = value; values[right * size + left] = value;
    }
  }
  return { size, values };
}

function noveltyAt(values: Float32Array, size: number, center: number, radius: number) {
  if (center < radius || center + radius > size) return 0;
  let within = 0; let cross = 0; let count = 0;
  for (let left = center - radius; left < center; left += 1) {
    for (let right = center; right < center + radius; right += 1) {
      within += values[left * size + (center - 1 - (left - (center - radius)))]
        + values[right * size + (center + radius - 1 - (right - center))];
      cross += values[left * size + right] * 2;
      count += 2;
    }
  }
  return count ? Math.max(0, (within - cross) / count) : 0;
}

function normalizedNovelty(matrix: { size: number; values: Float32Array }, radius: number) {
  const raw = Array.from({ length: matrix.size }, (_, index) => noveltyAt(matrix.values, matrix.size, index, radius));
  const highReference = [...raw].sort((a, b) => a - b)[Math.floor(Math.max(0, raw.length - 1) * 0.9)] ?? 0;
  const divisor = Math.max(highReference, Math.max(...raw, 0) * 0.72, 1e-9);
  return raw.map(value => clamp01(value / divisor));
}

function deriveRadii(bins: readonly Bin[]): [number, number, number] {
  const binDuration = median(bins.map(bin => bin.end - bin.start).filter(value => value > 0)) || 1;
  const maximum = Math.max(2, Math.floor((bins.length - 1) / 2));
  const radii = STRUCTURE_ANALYSIS.targetNoveltySideDurations.map(duration =>
    Math.max(1, Math.min(maximum, Math.round(duration / binDuration))));
  radii[1] = Math.max(radii[0] + 1, radii[1]);
  radii[2] = Math.max(radii[1] + 1, radii[2]);
  return [Math.min(maximum, radii[0]), Math.min(maximum, radii[1]), Math.min(maximum, radii[2])];
}

function windowAverage(vectors: readonly (readonly number[])[], start: number, end: number) {
  return averageVectors(vectors.slice(Math.max(0, start), Math.min(vectors.length, end)));
}

function contributionsAt(bins: readonly Bin[], index: number, radius: number) {
  const before = windowAverage(bins.map(bin => bin.arrangement), index - radius, index);
  const after = windowAverage(bins.map(bin => bin.arrangement), index, index + radius);
  const difference = (dimension: number) => clamp01(Math.abs((after[dimension] ?? 0) - (before[dimension] ?? 0)) * 1.5);
  return { brightness: difference(0), texture: difference(1), highBand: difference(2),
    onsetDensity: difference(3), energy: difference(4) };
}

function localPeaks(values: readonly number[], threshold: number) {
  return values.map((value, index) => ({ value, index })).filter(({ value, index }) =>
    index > 0 && index < values.length - 1 && value >= threshold
    && value >= values[index - 1] && value > values[index + 1]);
}

function chooseArrangementChanges(shortNovelty: readonly number[], bins: readonly Bin[], shortRadius: number): ArrangementChange[] {
  const scores = shortNovelty.map((novelty, index) => {
    const contributions = contributionsAt(bins, index, shortRadius);
    const localFeatures = mean(Object.values(contributions));
    return { index, contributions, score: clamp01(novelty * 0.62 + localFeatures * 0.38) };
  });
  const candidates = localPeaks(scores.map(item => item.score), STRUCTURE_ANALYSIS.minimumArrangementScore)
    .sort((a, b) => b.value - a.value || a.index - b.index);
  const accepted: typeof candidates = [];
  for (const candidate of candidates) {
    const time = bins[candidate.index].start;
    if (accepted.every(existing => Math.abs(bins[existing.index].start - time) >= STRUCTURE_ANALYSIS.minimumArrangementSpacing)) {
      accepted.push(candidate);
    }
  }
  return accepted.sort((a, b) => a.index - b.index).map(({ value, index }, changeIndex) => ({
    id: `arrangement-change-${changeIndex + 1}`, time: bins[index].start, frameIndex: index,
    magnitude: value, confidence: clamp01(0.3 + value * 0.7), featureContributions: scores[index].contributions,
  }));
}

function blockAlignmentBonus(index: number, beatMode: boolean) {
  if (!beatMode) return 0;
  let bonus = 0;
  for (const block of STRUCTURE_ANALYSIS.beatBlockSizes) {
    const distance = Math.min(index % block, block - index % block);
    if (distance <= 1) bonus = Math.max(bonus, block === 32 ? 0.1 : block === 16 ? 0.075 : 0.045);
  }
  return bonus;
}

function chooseBoundaries(
  scales: { short: readonly number[]; medium: readonly number[]; long: readonly number[] },
  coreVectors: readonly (readonly number[])[], arrangementShort: readonly number[], bins: readonly Bin[], beatMode: boolean,
) {
  const mediumRadius = Math.max(2, Math.round(scales.medium.length ? deriveRadii(bins)[1] : 2));
  const scores = bins.map((_, index) => {
    const before = windowAverage(coreVectors, index - mediumRadius, index);
    const after = windowAverage(coreVectors, index, index + mediumRadius);
    const persistentContrast = index > 0 && index < bins.length ? clamp01((1 - similarity01(before, after)) * 1.5) : 0;
    const beforeEnergy = mean(bins.slice(Math.max(0, index - mediumRadius), index).map(item => item.energy));
    const afterEnergy = mean(bins.slice(index, Math.min(bins.length, index + mediumRadius)).map(item => item.energy));
    const energyRegime = clamp01(Math.abs(afterEnergy - beforeEnergy) * 1.5);
    const gridAlignmentBonus = blockAlignmentBonus(index, beatMode);
    const localOnlyPenalty = clamp01(Math.max(0, (arrangementShort[index] ?? 0)
      - mean([scales.medium[index] ?? 0, scales.long[index] ?? 0])) * 0.32);
    const sectionScore = clamp01((scales.long[index] ?? 0) * 0.38 + (scales.medium[index] ?? 0) * 0.24
      + persistentContrast * 0.2 + energyRegime * 0.08 + gridAlignmentBonus - localOnlyPenalty);
    return { index, sectionScore, persistentContrast, energyRegime, gridAlignmentBonus };
  });
  const candidates = localPeaks(scores.map(score => score.sectionScore), STRUCTURE_ANALYSIS.minimumSectionScore)
    .sort((a, b) => b.value - a.value || a.index - b.index);
  const accepted: typeof candidates = [];
  for (const candidate of candidates) {
    const time = bins[candidate.index].start;
    const minimumDuration = candidate.value >= STRUCTURE_ANALYSIS.strongBoundaryScore
      ? STRUCTURE_ANALYSIS.strongBoundaryMinimumSectionDuration : STRUCTURE_ANALYSIS.minimumSectionDuration;
    if (time < minimumDuration || bins.at(-1)!.end - time < minimumDuration) continue;
    if (accepted.every(existing => Math.abs(bins[existing.index].start - time)
      >= Math.max(STRUCTURE_ANALYSIS.minimumBoundarySeparation, minimumDuration))) accepted.push(candidate);
  }
  return accepted.sort((a, b) => a.index - b.index).map(({ value, index }, boundaryIndex) => ({
    id: `structure-boundary-${boundaryIndex + 1}`, time: bins[index].start, frameIndex: index,
    novelty: value, confidence: clamp01(0.3 + value * 0.7), sectionScore: value,
    shortNovelty: scales.short[index] ?? 0, mediumNovelty: scales.medium[index] ?? 0,
    longNovelty: scales.long[index] ?? 0, gridAlignmentBonus: scores[index].gridAlignmentBonus,
  }));
}

const letterFor = (index: number) => index < 26 ? String.fromCharCode(65 + index) : `S${index + 1}`;
const primes = (count: number) => count <= 0 ? '' : count <= 3 ? '′'.repeat(count) : `′${count}`;

/** Deterministic two-level analysis: short arrangement changes stay separate from macro sections. */
export function analyzeStructure(source: readonly StructureSourceFrame[], duration: number,
  beats: readonly BeatMarker[] | null): StructureAnalysis {
  const { bins, beatMode } = aggregateSourceFrames(source, duration, beats);
  const radii = deriveRadii(bins);
  const vectors = normalize(bins.map(bin => bin.raw));
  const coreVectors = normalize(bins.map(bin => bin.core));
  const arrangementVectors = normalize(bins.map(bin => bin.arrangement));
  const frames: StructureAnalysisFrame[] = bins.map((bin, index) => ({ id: `structure-frame-${index}`,
    start: bin.start, end: bin.end, vector: vectors[index], energy: bin.energy, onsetDensity: bin.onsetDensity }));
  const selfSimilarity = createSelfSimilarity(vectors);
  const coreSimilarity = createSelfSimilarity(coreVectors);
  const arrangementSimilarity = createSelfSimilarity(arrangementVectors);
  const arrangementNovelty = normalizedNovelty(arrangementSimilarity, radii[0]);
  const noveltyScales = { short: arrangementNovelty, medium: normalizedNovelty(coreSimilarity, radii[1]),
    long: normalizedNovelty(coreSimilarity, radii[2]) };
  const novelty = noveltyScales.long.map((value, index) => clamp01(value * 0.62 + noveltyScales.medium[index] * 0.38));
  const arrangementChanges = chooseArrangementChanges(arrangementNovelty, bins, radii[0]);
  const boundaries = frames.length ? chooseBoundaries(noveltyScales, coreVectors, arrangementNovelty, bins, beatMode) : [];
  const cuts = [0, ...boundaries.map(boundary => boundary.frameIndex), frames.length];
  const summaries = cuts.slice(0, -1).map((startIndex, index) => averageVectors(
    coreVectors.slice(startIndex, cuts[index + 1])));
  const recurrenceSummaries = cuts.slice(0, -1).map((startIndex, index) => averageVectors(
    bins.slice(startIndex, cuts[index + 1]).map(bin => bin.core)));
  const familySummaries: number[][] = []; const familyUses: number[] = [];
  const assignments = recurrenceSummaries.map(summary => {
    let bestFamily = -1; let bestSimilarity = -1;
    familySummaries.forEach((family, index) => {
      const similarity = clamp01(cosine(summary, family));
      if (similarity > bestSimilarity) { bestSimilarity = similarity; bestFamily = index; }
    });
    if (bestSimilarity < STRUCTURE_ANALYSIS.recurrenceThreshold) {
      bestFamily = familySummaries.length; bestSimilarity = 1; familySummaries.push([...summary]); familyUses.push(0);
    }
    const occurrence = familyUses[bestFamily]++;
    return { family: bestFamily, similarity: bestSimilarity, occurrence };
  });
  const groupCounts = assignments.reduce<Map<number, number>>((counts, item) =>
    counts.set(item.family, (counts.get(item.family) ?? 0) + 1), new Map());
  const segments = cuts.slice(0, -1).map((startIndex, index) => {
    const segmentFrames = frames.slice(startIndex, cuts[index + 1]); const assignment = assignments[index];
    const recurrenceGroup = letterFor(assignment.family);
    const variant = assignment.occurrence > 0 && assignment.similarity < STRUCTURE_ANALYSIS.exactRecurrenceThreshold
      ? assignment.occurrence : 0;
    const previousDistance = index > 0 ? 1 - similarity01(summaries[index], summaries[index - 1]) : null;
    const nextDistance = index < summaries.length - 1 ? 1 - similarity01(summaries[index], summaries[index + 1]) : null;
    const contrast = clamp01(mean([previousDistance, nextDistance].filter((value): value is number => value !== null)) * 1.5);
    const energy = clamp01(mean(segmentFrames.map(frame => frame.energy)));
    const durationScore = clamp01((segmentFrames.at(-1)!.end - segmentFrames[0].start) / Math.max(8, duration * 0.35));
    const recurrence = (groupCounts.get(assignment.family) ?? 0) > 1 ? 1 : 0;
    const startBoundaryConfidence = index === 0 ? 1 : boundaries[index - 1].confidence;
    const endBoundaryConfidence = index === boundaries.length ? 1 : boundaries[index].confidence;
    const confidence = clamp01(0.4 * mean([startBoundaryConfidence, endBoundaryConfidence]) + 0.35 * contrast + 0.25 * durationScore);
    return { id: `structure-segment-${index}`, start: segmentFrames[0].start, end: segmentFrames.at(-1)!.end,
      label: `${recurrenceGroup}${primes(variant)}`, recurrenceGroup, confidence, energy, contrast,
      importance: clamp01(0.25 * recurrence + 0.2 * durationScore + 0.3 * contrast + 0.1 * energy
        + 0.15 * mean([startBoundaryConfidence, endBoundaryConfidence])), startBoundaryConfidence };
  });
  const activeEnergy = mean(frames.map(frame => frame.energy));
  const temporalCoherence = frames.length > 1
    ? mean(coreVectors.slice(1).map((frame, index) => similarity01(frame, coreVectors[index]))) : 0;
  const boundaryQuality = boundaries.length ? mean(boundaries.map(boundary => boundary.confidence)) : 0;
  const recurrenceQuality = assignments.some((item, index) => assignments.findIndex(other => other.family === item.family) < index) ? 1 : 0.55;
  const coverage = clamp01(frames.length / Math.max(STRUCTURE_ANALYSIS.minimumFrames, duration));
  const trackConfidence = clamp01(boundaryQuality * 0.5 + recurrenceQuality * 0.15 + coverage * 0.2
    + clamp01(activeEnergy * 2) * 0.15);
  const available = duration >= STRUCTURE_ANALYSIS.minimumDuration && frames.length >= STRUCTURE_ANALYSIS.minimumFrames
    && boundaries.length > 0 && activeEnergy > 0.015 && temporalCoherence >= 0.68
    && trackConfidence >= STRUCTURE_ANALYSIS.capabilityThreshold;
  const metadata = { featureDimensions: STRUCTURE_FEATURE_DIMENSIONS,
    normalization: 'per-dimension-z-score-clamped-3-then-l2' as const, similarity: 'cosine-mapped-0-1' as const,
    noveltyKernelRadii: radii, minimumBoundarySeparation: 4 as const, minimumArrangementSpacing: 2 as const,
    minimumSectionDuration: 8 as const, strongBoundaryMinimumSectionDuration: 4 as const,
    boundarySnapMaximumBins: 1 as const, beatBlockSizes: STRUCTURE_ANALYSIS.beatBlockSizes,
    coreFeatureDimensions: CORE_FEATURE_DIMENSIONS, arrangementFeatureDimensions: ARRANGEMENT_FEATURE_DIMENSIONS,
    tempoAwareScaleTerminology: 'beat-count-blocks-not-meter' as const,
    boundaryScoreFormula: '0.38 long + 0.24 medium + 0.20 persistent-core + 0.08 energy + grid bonus - 0.32 local-only',
    arrangementScoreFormula: '0.62 short-arrangement-novelty + 0.38 local-feature-change',
    fallbackWindowDuration: 1 as const, recurrenceThreshold: 0.82 as const, exactRecurrenceThreshold: 0.94 as const,
    capabilityThreshold: 0.48 as const, maximumFrameCount: 384 as const };
  return { version: 1, available, trackConfidence, aggregationMode: beatMode ? 'beat-synchronous' : 'time-fallback',
    frames, selfSimilarity, novelty, noveltyScales, arrangementChanges, boundaries,
    segments: available ? segments : [], recurrenceGroupCount: available
      ? new Set(segments.map(segment => segment.recurrenceGroup)).size : 0,
    averageSegmentDuration: available && segments.length ? mean(segments.map(segment => segment.end - segment.start)) : 0,
    metadata };
}
