import type { MelodyAnalysis, MelodyNote, MelodyPitchFrame } from '../types';

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
};

type AnalyzedFrame = {
  time: number;
  rms: number;
  candidates: Candidate[];
};

type PathState = {
  candidate: Candidate | null;
  score: number;
  previous: number;
};

const clamp01 = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const hzToMidi = (frequency: number) => 69 + 12 * Math.log2(frequency / 440);
const midiToHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const YIN_WINDOW = Float64Array.from({ length: MELODY_ANALYSIS.frameSize }, (_, index) =>
  0.5 - 0.5 * Math.cos(2 * Math.PI * index / (MELODY_ANALYSIS.frameSize - 1)));
export const midiToNoteName = (midi: number) => `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

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

function harmonicSalience(frame: Float32Array, frequency: number, rms: number) {
  if (rms <= 1e-12) return 0;
  let support = 0;
  let weights = 0;
  for (let harmonic = 1; harmonic <= MELODY_ANALYSIS.maximumHarmonics; harmonic += 1) {
    const harmonicFrequency = frequency * harmonic;
    if (harmonicFrequency >= MELODY_ANALYSIS.analysisSampleRate / 2) break;
    const weight = 1 / harmonic;
    support += harmonicAmplitude(frame, harmonicFrequency, MELODY_ANALYSIS.analysisSampleRate) * weight;
    weights += weight;
  }
  return clamp01(support / Math.max(1e-9, rms * weights * 1.35));
}

function candidateFrames(signal: Float32Array): AnalyzedFrame[] {
  const sampleRate = MELODY_ANALYSIS.analysisSampleRate;
  const minimumLag = Math.max(2, Math.floor(sampleRate / MELODY_ANALYSIS.maximumHz));
  const maximumLag = Math.min(MELODY_ANALYSIS.frameSize - 2, Math.ceil(sampleRate / MELODY_ANALYSIS.minimumHz));
  const frames: AnalyzedFrame[] = [];
  for (let start = 0; start < signal.length; start += MELODY_ANALYSIS.hopSize) {
    const frame = new Float32Array(MELODY_ANALYSIS.frameSize);
    frame.set(signal.subarray(start, Math.min(signal.length, start + frame.length)));
    // Periodicity needs the long frame, while voicing boundaries use a short
    // center window so rests are not smeared by the 171 ms pitch aperture.
    const centerStart = Math.floor((frame.length - 512) / 2);
    let sumSquares = 0;
    for (let index = centerStart; index < centerStart + 512; index += 1) sumSquares += frame[index] * frame[index];
    const rms = Math.sqrt(sumSquares / 512);
    const candidates: Candidate[] = [];
    if (rms >= MELODY_ANALYSIS.minimumRms) {
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
      const minima: number[] = [];
      for (let lag = minimumLag + 1; lag < maximumLag; lag += 1) {
        if (cumulative[lag] <= cumulative[lag - 1] && cumulative[lag] < cumulative[lag + 1]
          && cumulative[lag] < 0.48) minima.push(lag);
      }
      if (!minima.length) {
        let best = minimumLag;
        for (let lag = minimumLag + 1; lag <= maximumLag; lag += 1) {
          if (cumulative[lag] < cumulative[best]) best = lag;
        }
        minima.push(best);
      }
      for (const lag of minima) {
        const left = cumulative[lag - 1] ?? cumulative[lag];
        const center = cumulative[lag];
        const right = cumulative[lag + 1] ?? cumulative[lag];
        const denominator = left - 2 * center + right;
        const interpolatedLag = denominator === 0 ? lag : lag + 0.5 * (left - right) / denominator;
        const pitchHz = sampleRate / interpolatedLag;
        if (!(pitchHz >= MELODY_ANALYSIS.minimumHz && pitchHz <= MELODY_ANALYSIS.maximumHz)) continue;
        const periodicity = clamp01(1 - center);
        const salience = harmonicSalience(frame, pitchHz, rms);
        const energySupport = clamp01((rms - MELODY_ANALYSIS.minimumRms) / 0.035);
        const score = clamp01(periodicity * 0.50 + salience * 0.40 + energySupport * 0.10);
        candidates.push({ pitchHz, midiFloat: hzToMidi(pitchHz), periodicity, salience, score });
      }
      candidates.sort((a, b) => b.score - a.score || a.pitchHz - b.pitchHz);
      // Remove near-duplicates while preserving octave-related alternatives for the path stage.
      for (let index = candidates.length - 1; index >= 0; index -= 1) {
        if (candidates.slice(0, index).some(other => Math.abs(other.midiFloat - candidates[index].midiFloat) < 0.22)) {
          candidates.splice(index, 1);
        }
      }
      candidates.splice(MELODY_ANALYSIS.maximumCandidates);
    }
    frames.push({
      time: Math.min(signal.length / sampleRate, (start + MELODY_ANALYSIS.frameSize / 2) / sampleRate),
      rms,
      candidates,
    });
    if (start + MELODY_ANALYSIS.frameSize >= signal.length && start > 0) break;
  }
  return frames;
}

function transitionScore(previous: Candidate | null, current: Candidate | null) {
  if (!previous && !current) return 0.05;
  if (!previous || !current) return -0.13;
  const distance = Math.abs(previous.midiFloat - current.midiFloat);
  const octavePenalty = Math.abs(distance - 12) < 1.1 ? 0.20 : 0;
  return -Math.min(0.42, distance * 0.035) - octavePenalty;
}

function choosePath(frames: readonly AnalyzedFrame[]) {
  const layers: PathState[][] = [];
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const frame = frames[frameIndex];
    const states = [null, ...frame.candidates];
    const layer: PathState[] = states.map(candidate => {
      const emission = candidate
        ? candidate.score - (candidate.score < MELODY_ANALYSIS.voicingThreshold ? 0.22 : 0)
        : frame.rms < MELODY_ANALYSIS.minimumRms ? 0.58 : 0.18;
      if (frameIndex === 0) return { candidate, score: emission, previous: -1 };
      let bestScore = -Infinity;
      let previous = 0;
      for (let previousIndex = 0; previousIndex < layers[frameIndex - 1].length; previousIndex += 1) {
        const previousState = layers[frameIndex - 1][previousIndex];
        const score = previousState.score + transitionScore(previousState.candidate, candidate) + emission;
        if (score > bestScore) { bestScore = score; previous = previousIndex; }
      }
      return { candidate, score: bestScore, previous };
    });
    layers.push(layer);
  }
  const path: (Candidate | null)[] = Array(frames.length).fill(null);
  if (!layers.length) return path;
  let stateIndex = layers.at(-1)!.reduce((best, state, index, layer) => state.score > layer[best].score ? index : best, 0);
  for (let frameIndex = layers.length - 1; frameIndex >= 0; frameIndex -= 1) {
    const state = layers[frameIndex][stateIndex];
    path[frameIndex] = state.candidate;
    stateIndex = state.previous;
  }
  return path;
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
  const contour: MelodyPitchFrame[] = mutable.map((candidate, index) => {
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
    return {
      time: frames[index].time,
      voiced,
      pitchHz: voiced ? candidate.pitchHz : null,
      midiFloat: voiced ? candidate.midiFloat : null,
      confidence: voiced ? confidence : 0,
      salience: voiced ? candidate.salience : 0,
    };
  });
  return { contour, octaveCorrectionCount, rejectedLowConfidenceFrameCount };
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
  const signal = resampleForAnalysis(input.mono, input.sampleRate);
  const duration = input.mono.length / input.sampleRate;
  const frames = candidateFrames(signal);
  const path = choosePath(frames);
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
  return {
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
}
