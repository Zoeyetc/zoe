import type {
  ChordSegment,
  HarmonyAnalysis,
  TonalCenterAnalysis,
  TonalCenterCandidate,
  TonalCenterFrame,
  TonalCenterSegment,
  TonalMode,
} from '../types.ts';

export const TONAL_CENTER_ANALYSIS = {
  version: 1 as const,
  windowSize: 8 as const,
  hopSize: 2 as const,
  minimumSegmentDuration: 4 as const,
  minimumUsableDuration: 2 as const,
  availabilityThreshold: 0.56 as const,
  switchPenalty: 0.11 as const,
} as const;

// Krumhansl–Kessler empirical key profiles, C-major and C-minor reference order.
// Rotations evaluate the remaining 22 keys; profiles are L2-normalized before cosine comparison.
export const MAJOR_KEY_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88] as const;
export const MINOR_KEY_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17] as const;

const PITCH_CLASS_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const FIFTHS_INDEX = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5] as const;
const MODES = ['major', 'minor'] as const;
const clamp01 = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const median = (values: readonly number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};
const normalize = (values: readonly number[]) => {
  const norm = Math.hypot(...values);
  return norm > 1e-12 ? values.map(value => value / norm) : values.map(() => 0);
};
const normalizedProfiles = {
  major: normalize(MAJOR_KEY_PROFILE),
  minor: normalize(MINOR_KEY_PROFILE),
} as const;

export const circleOfFifthsIndex = (pitchClass: number) => FIFTHS_INDEX[((pitchClass % 12) + 12) % 12];
export const circleOfFifthsDistance = (fromPitchClass: number, toPitchClass: number) => {
  const difference = Math.abs(circleOfFifthsIndex(fromPitchClass) - circleOfFifthsIndex(toPitchClass));
  return Math.min(difference, 12 - difference);
};

type WindowScore = Readonly<{
  time: number;
  candidates: readonly TonalCenterCandidate[];
  confidence: number;
  usableCoverage: number;
}>;

const diatonicPitchClasses = (root: number, mode: TonalMode) => {
  const intervals = mode === 'major' ? [0, 2, 4, 5, 7, 9, 11] : [0, 2, 3, 5, 7, 8, 10];
  return new Set(intervals.map(interval => (root + interval) % 12));
};

function supportFromChords(
  segments: readonly ChordSegment[],
  start: number,
  end: number,
  root: number,
  mode: TonalMode,
) {
  const scale = diatonicPitchClasses(root, mode);
  let total = 0;
  let compatible = 0;
  let tonicRoot = 0;
  for (const segment of segments) {
    const overlap = Math.max(0, Math.min(end, segment.end) - Math.max(start, segment.start));
    if (overlap <= 0) continue;
    const weight = overlap * clamp01(segment.confidence);
    total += weight;
    const membership = segment.pitchClasses.filter(pitchClass => scale.has(pitchClass)).length
      / Math.max(1, segment.pitchClasses.length);
    compatible += weight * membership;
    if (segment.rootPitchClass === root) tonicRoot += weight;
  }
  return {
    chordSupport: total > 0 ? clamp01(compatible / total) : 0,
    tonicRootSupport: total > 0 ? clamp01(tonicRoot / total) : 0,
  };
}

function candidateScores(
  chroma: readonly number[],
  segments: readonly ChordSegment[],
  start: number,
  end: number,
) {
  const normalizedChroma = normalize(chroma);
  return Array.from({ length: 12 }, (_, root) => MODES.map(mode => {
    const profile = normalizedProfiles[mode];
    let profileScore = 0;
    for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
      profileScore += (normalizedChroma[pitchClass] ?? 0) * (profile[(pitchClass - root + 12) % 12] ?? 0);
    }
    const { chordSupport, tonicRootSupport } = supportFromChords(segments, start, end, root, mode);
    const tonicEnergySupport = clamp01((chroma[root] ?? 0) * 5);
    const tonicSupport = clamp01(0.65 * tonicEnergySupport + 0.35 * tonicRootSupport);
    const score = clamp01(0.82 * profileScore + 0.10 * tonicSupport + 0.08 * chordSupport);
    return {
      label: `${PITCH_CLASS_NAMES[root]} ${mode}`,
      rootPitchClass: root,
      mode,
      score,
      profileScore: clamp01(profileScore),
      tonicSupport,
      chordSupport,
    } satisfies TonalCenterCandidate;
  })).flat().sort((a, b) => b.score - a.score || a.rootPitchClass - b.rootPitchClass
    || a.mode.localeCompare(b.mode));
}

function windowCenters(duration: number) {
  if (duration <= TONAL_CENTER_ANALYSIS.windowSize) return [duration / 2];
  const radius = TONAL_CENTER_ANALYSIS.windowSize / 2;
  const centers: number[] = [];
  for (let center = radius; center <= duration - radius + 1e-9; center += TONAL_CENTER_ANALYSIS.hopSize) {
    centers.push(Math.min(duration - radius, center));
  }
  if (centers.at(-1) !== duration - radius) centers.push(duration - radius);
  return centers;
}

function scoreWindow(
  harmony: HarmonyAnalysis,
  duration: number,
  center: number,
  requestedWindowSize: number = TONAL_CENTER_ANALYSIS.windowSize,
): WindowScore {
  const halfWindow = Math.min(requestedWindowSize, duration) / 2;
  const start = Math.max(0, center - halfWindow);
  const end = Math.min(duration, center + halfWindow);
  const selected = harmony.frames.filter(frame => frame.time >= start && frame.time <= end);
  const chroma = Array(12).fill(0) as number[];
  let totalWeight = 0;
  let usableWeight = 0;
  for (const frame of selected) {
    const weight = clamp01(frame.confidence) * Math.sqrt(Math.max(0, frame.energy));
    totalWeight += Math.sqrt(Math.max(0, frame.energy));
    usableWeight += weight;
    for (let pitchClass = 0; pitchClass < 12; pitchClass += 1) {
      chroma[pitchClass] += (frame.chroma[pitchClass] ?? 0) * weight;
    }
  }
  const chromaTotal = chroma.reduce((sum, value) => sum + value, 0);
  if (chromaTotal > 1e-12) for (let index = 0; index < 12; index += 1) chroma[index] /= chromaTotal;
  const candidates = candidateScores(chroma, harmony.segments, start, end);
  const top = candidates[0];
  const second = candidates[1];
  const margin = Math.max(0, (top?.score ?? 0) - (second?.score ?? 0));
  const usableCoverage = totalWeight > 1e-12 ? clamp01(usableWeight / totalWeight) : 0;
  const profileQuality = clamp01(((top?.profileScore ?? 0) - 0.68) / 0.24);
  const tonalContrast = chroma.length
    ? clamp01((Math.max(...chroma) - Math.min(...chroma)) / 0.08)
    : 0;
  // Confidence deliberately falls when relative keys have similar scores.
  const confidence = clamp01(
    0.22 * profileQuality
    + 0.30 * clamp01(margin / 0.08)
    + 0.15 * usableCoverage
    + 0.15 * (top?.tonicSupport ?? 0)
    + 0.10 * (top?.chordSupport ?? 0)
    + 0.08 * tonalContrast,
  );
  return { time: center, candidates, confidence, usableCoverage };
}

function smoothCandidateIndices(windows: readonly WindowScore[]) {
  if (!windows.length) return [];
  const stateCount = 24;
  const scores = windows.map(() => Array(stateCount).fill(Number.NEGATIVE_INFINITY) as number[]);
  const back = windows.map(() => Array(stateCount).fill(0) as number[]);
  for (let state = 0; state < stateCount; state += 1) scores[0][state] = windows[0].candidates[state]?.score ?? 0;
  for (let index = 1; index < windows.length; index += 1) {
    for (let state = 0; state < stateCount; state += 1) {
      let bestPrevious = 0;
      let bestScore = Number.NEGATIVE_INFINITY;
      const current = windows[index].candidates[state];
      for (let previous = 0; previous < stateCount; previous += 1) {
        const previousCandidate = windows[index - 1].candidates[previous];
        const switching = previousCandidate.label !== current.label;
        const relationPenalty = switching
          ? 0.01 * circleOfFifthsDistance(previousCandidate.rootPitchClass, current.rootPitchClass)
          : 0;
        const candidateScore = scores[index - 1][previous]
          - (switching ? TONAL_CENTER_ANALYSIS.switchPenalty + relationPenalty : 0);
        if (candidateScore > bestScore) { bestScore = candidateScore; bestPrevious = previous; }
      }
      scores[index][state] = bestScore + current.score;
      back[index][state] = bestPrevious;
    }
  }
  let state = scores.at(-1)?.reduce((best, score, index, values) => score > values[best] ? index : best, 0) ?? 0;
  const path = Array(windows.length).fill(0) as number[];
  for (let index = windows.length - 1; index >= 0; index -= 1) {
    path[index] = state;
    state = back[index][state] ?? state;
  }
  return path;
}

function mergeShortRuns(labels: string[], windows: readonly WindowScore[], duration: number) {
  if (labels.length < 2) return labels;
  let changed = true;
  while (changed) {
    changed = false;
    let start = 0;
    while (start < labels.length) {
      let end = start + 1;
      while (end < labels.length && labels[end] === labels[start]) end += 1;
      const boundaryStart = start === 0 ? 0 : (windows[start - 1].time + windows[start].time) / 2;
      const boundaryEnd = end === labels.length ? duration : (windows[end - 1].time + windows[end].time) / 2;
      if (boundaryEnd - boundaryStart < TONAL_CENTER_ANALYSIS.minimumSegmentDuration && labels.length > 1) {
        const before = start > 0 ? labels[start - 1] : null;
        const after = end < labels.length ? labels[end] : null;
        let replacement = before ?? after;
        if (before && after && before !== after) {
          const support = (label: string) => windows.slice(start, end).reduce((sum, window) =>
            sum + (window.candidates.find(candidate => candidate.label === label)?.score ?? 0), 0);
          replacement = support(before) >= support(after) ? before : after;
        }
        if (replacement && replacement !== labels[start]) {
          for (let index = start; index < end; index += 1) labels[index] = replacement;
          changed = true;
          break;
        }
      }
      start = end;
    }
  }
  return labels;
}

function buildSegments(
  frames: readonly TonalCenterFrame[],
  labels: readonly string[],
  duration: number,
): TonalCenterSegment[] {
  const segments: TonalCenterSegment[] = [];
  let start = 0;
  while (start < labels.length) {
    let end = start + 1;
    while (end < labels.length && labels[end] === labels[start]) end += 1;
    const rootPitchClass = frames[start].rootPitchClass;
    const mode = frames[start].mode;
    if (rootPitchClass !== null && mode !== null) {
      const segmentStart = start === 0 ? 0 : (frames[start - 1].time + frames[start].time) / 2;
      const segmentEnd = end === frames.length ? duration : (frames[end - 1].time + frames[end].time) / 2;
      const previous = segments.at(-1);
      segments.push({
        id: `tonal-center-${segments.length}`,
        start: segmentStart,
        end: segmentEnd,
        rootPitchClass,
        mode,
        label: labels[start],
        confidence: median(frames.slice(start, end).map(frame => frame.confidence)),
        circleOfFifthsIndex: circleOfFifthsIndex(rootPitchClass),
        distanceFromPrevious: previous
          ? circleOfFifthsDistance(previous.rootPitchClass, rootPitchClass)
          : null,
      });
    }
    start = end;
  }
  return segments;
}

export function analyzeTonalCenter(
  harmony: HarmonyAnalysis | null | undefined,
  duration: number,
): TonalCenterAnalysis {
  const metadata = {
    sourceChroma: 'harmony-analysis-normalized-chroma' as const,
    windowSize: TONAL_CENTER_ANALYSIS.windowSize,
    hopSize: TONAL_CENTER_ANALYSIS.hopSize,
    majorProfile: MAJOR_KEY_PROFILE,
    minorProfile: MINOR_KEY_PROFILE,
    similarity: 'cosine' as const,
    smoothing: 'non-causal-dynamic-programming-plus-minimum-segment' as const,
    minimumSegmentDuration: TONAL_CENTER_ANALYSIS.minimumSegmentDuration,
    minimumUsableDuration: TONAL_CENTER_ANALYSIS.minimumUsableDuration,
    availabilityThreshold: TONAL_CENTER_ANALYSIS.availabilityThreshold,
    switchPenalty: TONAL_CENTER_ANALYSIS.switchPenalty,
  };
  if (!harmony || !Number.isFinite(duration) || duration <= 0 || harmony.frames.length === 0) {
    return { version: 1, available: false, confidence: 0, globalTonalCenter: null,
      averageSegmentDuration: 0, frames: [], segments: [], metadata };
  }
  const windows = windowCenters(duration).map(center => scoreWindow(harmony, duration, center));
  const path = smoothCandidateIndices(windows);
  const rawLabels = path.map((state, index) => windows[index].candidates[state]?.label ?? '');
  const labels = mergeShortRuns(rawLabels, windows, duration);
  const frames: TonalCenterFrame[] = windows.map((window, index) => {
    const selected = window.candidates.find(candidate => candidate.label === labels[index]) ?? null;
    const top = window.candidates[0] ?? null;
    const second = window.candidates[1] ?? null;
    return {
      time: window.time,
      rootPitchClass: selected?.rootPitchClass ?? null,
      mode: selected?.mode ?? null,
      label: selected?.label ?? null,
      confidence: window.confidence,
      topCandidate: top,
      secondCandidate: second,
      topScore: top?.score ?? 0,
      secondScore: second?.score ?? 0,
      margin: clamp01((top?.score ?? 0) - (second?.score ?? 0)),
      usableCoverage: window.usableCoverage,
    };
  });
  const candidateSegments = buildSegments(frames, labels, duration);
  const globalWindow = scoreWindow(harmony, duration, duration / 2, duration);
  const globalTonalCenter = globalWindow.candidates[0] ?? null;
  const harmonicCoverage = median(frames.map(frame => frame.usableCoverage));
  const frameConfidence = median(frames.map(frame => frame.confidence));
  const confidence = clamp01(
    0.75 * frameConfidence
    + 0.15 * harmonicCoverage
    + 0.10 * Math.min(1, duration / TONAL_CENTER_ANALYSIS.windowSize),
  );
  const available = harmony.available
    && duration >= TONAL_CENTER_ANALYSIS.minimumUsableDuration
    && harmonicCoverage >= 0.35
    && frameConfidence >= 0.5
    && confidence >= TONAL_CENTER_ANALYSIS.availabilityThreshold
    && candidateSegments.length > 0;
  const segments = available ? candidateSegments : [];
  return {
    version: 1,
    available,
    confidence,
    globalTonalCenter: available ? globalTonalCenter : null,
    averageSegmentDuration: segments.length ? duration / segments.length : 0,
    frames,
    segments,
    metadata,
  };
}
