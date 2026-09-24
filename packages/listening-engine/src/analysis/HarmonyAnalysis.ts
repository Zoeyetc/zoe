import type {
  ChordCandidateSummary,
  ChordSegment,
  ChromaFrame,
  HarmonyAnalysis,
} from '../types.ts';

export const HARMONY_ANALYSIS = {
  version: 1 as const,
  analysisSampleRate: 12_000 as const,
  frameSize: 4096 as const,
  hopSize: 1024 as const,
  minimumHz: 80 as const,
  maximumHz: 5000 as const,
  minimumRms: 0.003,
  frameConfidenceThreshold: 0.52 as const,
  minimumSegmentDuration: 0.24 as const,
  availabilityThreshold: 0.6 as const,
  minimumUsableDuration: 0.75,
} as const;

export type HarmonyAnalysisInput = Readonly<{
  mono: Float32Array;
  sampleRate: number;
}>;

type Quality = 'major' | 'minor';
type ScoredFrame = {
  time: number;
  energy: number;
  chroma: number[];
  confidence: number;
  topCandidate: ChordCandidateSummary | null;
  secondCandidate: ChordCandidateSummary | null;
  scoreMargin: number;
  selectedLabel: string | null;
};

const PITCH_CLASS_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const clamp01 = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const median = (values: readonly number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};
const pitchClassesFor = (root: number, quality: Quality) => [
  root,
  (root + (quality === 'major' ? 4 : 3)) % 12,
  (root + 7) % 12,
];
const templates: readonly ChordCandidateSummary[] = Array.from({ length: 12 }, (_, root) =>
  (['major', 'minor'] as const).map(quality => ({
    label: `${PITCH_CLASS_NAMES[root]} ${quality}`,
    rootPitchClass: root,
    quality,
    pitchClasses: pitchClassesFor(root, quality),
    score: 0,
  }))).flat();

/** Analysis-only box resampling. Playback channels and the decoded buffer remain untouched. */
function resample(input: Float32Array, sourceRate: number) {
  if (sourceRate === HARMONY_ANALYSIS.analysisSampleRate) return input;
  const ratio = sourceRate / HARMONY_ANALYSIS.analysisSampleRate;
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

function fft(real: Float64Array, imaginary: Float64Array) {
  const size = real.length;
  for (let index = 1, reversed = 0; index < size; index += 1) {
    let bit = size >> 1;
    for (; reversed & bit; bit >>= 1) reversed ^= bit;
    reversed ^= bit;
    if (index < reversed) {
      [real[index], real[reversed]] = [real[reversed], real[index]];
      [imaginary[index], imaginary[reversed]] = [imaginary[reversed], imaginary[index]];
    }
  }
  for (let length = 2; length <= size; length <<= 1) {
    const angle = -2 * Math.PI / length;
    const baseReal = Math.cos(angle);
    const baseImaginary = Math.sin(angle);
    for (let offset = 0; offset < size; offset += length) {
      let twiddleReal = 1;
      let twiddleImaginary = 0;
      for (let index = 0; index < length / 2; index += 1) {
        const even = offset + index;
        const odd = even + length / 2;
        const oddReal = real[odd] * twiddleReal - imaginary[odd] * twiddleImaginary;
        const oddImaginary = real[odd] * twiddleImaginary + imaginary[odd] * twiddleReal;
        real[odd] = real[even] - oddReal;
        imaginary[odd] = imaginary[even] - oddImaginary;
        real[even] += oddReal;
        imaginary[even] += oddImaginary;
        const nextReal = twiddleReal * baseReal - twiddleImaginary * baseImaginary;
        twiddleImaginary = twiddleReal * baseImaginary + twiddleImaginary * baseReal;
        twiddleReal = nextReal;
      }
    }
  }
}

function extractChroma(frame: Float32Array) {
  const size = HARMONY_ANALYSIS.frameSize;
  const real = new Float64Array(size);
  const imaginary = new Float64Array(size);
  let sumSquares = 0;
  for (let index = 0; index < size; index += 1) {
    const sample = frame[index] ?? 0;
    sumSquares += sample * sample;
    real[index] = sample * (0.5 - 0.5 * Math.cos(2 * Math.PI * index / (size - 1)));
  }
  const energy = Math.sqrt(sumSquares / size);
  if (energy < HARMONY_ANALYSIS.minimumRms) return { energy, chroma: Array(12).fill(0) as number[] };
  fft(real, imaginary);
  const magnitudes = new Float64Array(size / 2 + 1);
  let maximum = 0;
  for (let bin = 1; bin < magnitudes.length; bin += 1) {
    const frequency = bin * HARMONY_ANALYSIS.analysisSampleRate / size;
    if (frequency < HARMONY_ANALYSIS.minimumHz || frequency > HARMONY_ANALYSIS.maximumHz) continue;
    const magnitude = Math.hypot(real[bin], imaginary[bin]);
    magnitudes[bin] = magnitude;
    maximum = Math.max(maximum, magnitude);
  }
  if (maximum <= 1e-12) return { energy, chroma: Array(12).fill(0) as number[] };
  const chroma = Array(12).fill(0) as number[];
  for (let bin = 2; bin < magnitudes.length - 1; bin += 1) {
    const magnitude = magnitudes[bin];
    if (magnitude < maximum * 0.025 || magnitude < magnitudes[bin - 1] || magnitude < magnitudes[bin + 1]) continue;
    const frequency = bin * HARMONY_ANALYSIS.analysisSampleRate / size;
    if (frequency < HARMONY_ANALYSIS.minimumHz || frequency > HARMONY_ANALYSIS.maximumHz) continue;
    const midi = 69 + 12 * Math.log2(frequency / 440);
    const rounded = Math.round(midi);
    const pitchClass = ((rounded % 12) + 12) % 12;
    const tuningDistance = Math.abs(midi - rounded);
    const tuningWeight = Math.max(0.35, 1 - tuningDistance);
    const spectralWeight = Math.log1p(12 * magnitude / maximum) / Math.sqrt(Math.max(1, frequency / 220));
    chroma[pitchClass] += spectralWeight * tuningWeight;
  }
  const floor = Math.min(...chroma);
  const compressed = chroma.map(value => Math.max(0, value - floor * 0.75) ** 0.8);
  const total = compressed.reduce((sum, value) => sum + value, 0);
  return { energy, chroma: total > 1e-12 ? compressed.map(value => value / total) : Array(12).fill(0) as number[] };
}

function scoreTemplates(chroma: readonly number[]) {
  const scored = templates.map(template => {
    const [root, third, fifth] = template.pitchClasses;
    const wrongThird = (root + (template.quality === 'major' ? 3 : 4)) % 12;
    const rootEnergy = chroma[root] ?? 0;
    const thirdEnergy = chroma[third] ?? 0;
    const fifthEnergy = chroma[fifth] ?? 0;
    const chordEnergy = rootEnergy + thirdEnergy + fifthEnergy;
    const coverage = Math.min(1, 3 * Math.min(rootEnergy, thirdEnergy, fifthEnergy));
    const thirdContrast = Math.max(0, thirdEnergy - (chroma[wrongThird] ?? 0));
    const outsideEnergy = Math.max(0, 1 - chordEnergy);
    const score = clamp01(
      0.48 * chordEnergy + 0.22 * coverage + 0.16 * thirdContrast
      + 0.14 * rootEnergy - 0.25 * outsideEnergy,
    );
    return { ...template, score };
  }).sort((a, b) => b.score - a.score || a.rootPitchClass - b.rootPitchClass || a.quality.localeCompare(b.quality));
  return [scored[0] ?? null, scored[1] ?? null] as const;
}

function analyzeFrames(signal: Float32Array) {
  const duration = signal.length / HARMONY_ANALYSIS.analysisSampleRate;
  const frames: ScoredFrame[] = [];
  for (let start = 0; start < signal.length; start += HARMONY_ANALYSIS.hopSize) {
    const frame = new Float32Array(HARMONY_ANALYSIS.frameSize);
    frame.set(signal.subarray(start, Math.min(signal.length, start + frame.length)));
    const { energy, chroma } = extractChroma(frame);
    const [topCandidate, secondCandidate] = scoreTemplates(chroma);
    const scoreMargin = Math.max(0, (topCandidate?.score ?? 0) - (secondCandidate?.score ?? 0));
    const tones = topCandidate?.pitchClasses.map(pitchClass => chroma[pitchClass] ?? 0) ?? [0, 0, 0];
    const coverage = Math.min(1, 3 * Math.min(...tones));
    const chordEnergy = tones.reduce((sum, value) => sum + value, 0);
    const concentration = [...chroma].sort((a, b) => b - a).slice(0, 3).reduce((sum, value) => sum + value, 0);
    const confidence = energy < HARMONY_ANALYSIS.minimumRms ? 0 : clamp01(
      0.35 * coverage + 0.30 * chordEnergy + 0.25 * Math.min(1, scoreMargin / 0.22) + 0.10 * concentration,
    );
    frames.push({
      time: Math.min(duration, start / HARMONY_ANALYSIS.analysisSampleRate), energy, chroma,
      confidence, topCandidate, secondCandidate, scoreMargin,
      selectedLabel: confidence >= HARMONY_ANALYSIS.frameConfidenceThreshold ? topCandidate?.label ?? null : null,
    });
  }
  return frames;
}

function smoothLabels(frames: readonly ScoredFrame[]) {
  const labels = frames.map(frame => frame.selectedLabel);
  for (let index = 1; index < labels.length - 1; index += 1) {
    if (labels[index - 1] === labels[index + 1] && labels[index] !== labels[index - 1]) labels[index] = labels[index - 1];
  }
  const minimumFrames = Math.ceil(
    HARMONY_ANALYSIS.minimumSegmentDuration * HARMONY_ANALYSIS.analysisSampleRate / HARMONY_ANALYSIS.hopSize,
  );
  let runStart = 0;
  while (runStart < labels.length) {
    let runEnd = runStart + 1;
    while (runEnd < labels.length && labels[runEnd] === labels[runStart]) runEnd += 1;
    if (labels[runStart] !== null && runEnd - runStart < minimumFrames) {
      const before = labels[runStart - 1] ?? null;
      const after = labels[runEnd] ?? null;
      const replacement = before !== null && before === after ? before : null;
      for (let index = runStart; index < runEnd; index += 1) labels[index] = replacement;
    }
    runStart = runEnd;
  }
  for (let index = 1; index < labels.length - 1; index += 1) {
    if (labels[index] === null && labels[index - 1] !== null && labels[index - 1] === labels[index + 1]) labels[index] = labels[index - 1];
  }
  return labels;
}

function makeSegments(frames: readonly ScoredFrame[], labels: readonly (string | null)[], duration: number) {
  const segments: ChordSegment[] = [];
  let start = 0;
  while (start < labels.length) {
    const label = labels[start];
    let end = start + 1;
    while (end < labels.length && labels[end] === label) end += 1;
    if (label !== null) {
      const template = templates.find(candidate => candidate.label === label);
      if (template) {
        const segmentStart = frames[start]?.time ?? 0;
        const segmentEnd = Math.min(duration, frames[end]?.time ?? duration);
        if (segmentEnd - segmentStart >= HARMONY_ANALYSIS.minimumSegmentDuration) {
          segments.push({
            id: `real-chord-${segments.length}`,
            start: segmentStart,
            end: segmentEnd,
            chord: template.label,
            rootPitchClass: template.rootPitchClass,
            quality: template.quality,
            pitchClasses: template.pitchClasses,
            confidence: median(frames.slice(start, end).map(frame => frame.confidence)),
          });
        }
      }
    }
    start = end;
  }
  return segments.reduce<ChordSegment[]>((merged, segment) => {
    const previous = merged.at(-1);
    if (previous && previous.chord === segment.chord
      && segment.start - previous.end <= HARMONY_ANALYSIS.frameSize / HARMONY_ANALYSIS.analysisSampleRate) {
      merged[merged.length - 1] = {
        ...previous,
        end: segment.end,
        confidence: (previous.confidence + segment.confidence) / 2,
      };
    } else merged.push(segment);
    return merged;
  }, []);
}

export function analyzeHarmony(input: HarmonyAnalysisInput): HarmonyAnalysis {
  if (!Number.isFinite(input.sampleRate) || input.sampleRate <= 0) throw new Error('Invalid sample rate');
  const signal = resample(input.mono, input.sampleRate);
  const duration = signal.length / HARMONY_ANALYSIS.analysisSampleRate;
  const analyzed = analyzeFrames(signal);
  const labels = smoothLabels(analyzed);
  const segments = makeSegments(analyzed, labels, duration);
  const frames: ChromaFrame[] = analyzed.map((frame, index) => {
    const selectedLabel = labels[index];
    const selectedCandidate = selectedLabel === null
      ? null
      : selectedLabel === frame.topCandidate?.label
        ? frame.topCandidate
        : selectedLabel === frame.secondCandidate?.label
          ? frame.secondCandidate
          : scoreTemplates(frame.chroma).find(candidate => candidate.label === selectedLabel) ?? null;
    return {
      time: frame.time,
      chroma: frame.chroma.map(clamp01),
      energy: Math.max(0, frame.energy),
      confidence: clamp01(frame.confidence),
      chord: selectedCandidate,
      topCandidate: frame.topCandidate,
      secondCandidate: frame.secondCandidate,
      scoreMargin: clamp01(frame.scoreMargin),
    };
  });
  const usableFrames = labels.filter(label => label !== null).length;
  const noChordRatio = frames.length ? 1 - usableFrames / frames.length : 1;
  const usableDuration = segments.reduce((sum, segment) => sum + segment.end - segment.start, 0);
  const averageSegmentDuration = segments.length ? usableDuration / segments.length : 0;
  const medianConfidence = median(frames.filter((_, index) => labels[index] !== null).map(frame => frame.confidence));
  const usableRatio = frames.length ? usableFrames / frames.length : 0;
  const stableCoverage = duration > 0 ? Math.min(1, usableDuration / duration) : 0;
  const confidence = clamp01(0.45 * medianConfidence + 0.30 * usableRatio + 0.25 * stableCoverage);
  const available = segments.length > 0
    && usableDuration >= HARMONY_ANALYSIS.minimumUsableDuration
    && confidence >= HARMONY_ANALYSIS.availabilityThreshold;
  return {
    version: 1,
    available,
    confidence,
    noChordRatio,
    averageSegmentDuration,
    frames,
    segments: available ? segments : [],
    metadata: {
      analysisSampleRate: HARMONY_ANALYSIS.analysisSampleRate,
      frameSize: HARMONY_ANALYSIS.frameSize,
      hopSize: HARMONY_ANALYSIS.hopSize,
      frequencyRange: [HARMONY_ANALYSIS.minimumHz, HARMONY_ANALYSIS.maximumHz],
      chordVocabulary: '12-major-12-minor-triads',
      normalization: 'log-compressed-peak-weighted-l1-chroma',
      smoothing: 'three-frame-island-removal-and-minimum-segment',
      minimumSegmentDuration: HARMONY_ANALYSIS.minimumSegmentDuration,
      frameConfidenceThreshold: HARMONY_ANALYSIS.frameConfidenceThreshold,
      availabilityThreshold: HARMONY_ANALYSIS.availabilityThreshold,
    },
  };
}
