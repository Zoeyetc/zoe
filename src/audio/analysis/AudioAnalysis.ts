import type {
  AudioAmplitudeRegion,
  AudioAnalysisMetadata,
  ListeningMap,
  RhythmSection,
  SpectrumRegion,
} from '@computational-listening/engine';
import type { AudioMap } from '../types';
import { composeLegacyAudioMap } from '../composeLegacyAudioMap.ts';
import { analyzeRhythm } from './RhythmAnalysis.ts';
import { analyzeMelodyWithEvidence } from './MelodyAnalysis.ts';
import { analyzeHarmony } from './HarmonyAnalysis.ts';
import { analyzeTonalCenter } from './TonalCenterAnalysis.ts';
import { analyzeStructure } from './StructureAnalysis.ts';
import { analyzePercussion } from './PercussionAnalysis.ts';

export const REAL_AUDIO_ANALYSIS = {
  version: 1 as const,
  frameSize: 2048,
  hopSize: 1024,
  fftSize: 2048,
  lowHz: [20, 250] as const,
  midHz: [250, 4000] as const,
  highHz: 4000,
} as const;

export type PcmAudio = Readonly<{
  sampleRate: number;
  channels: readonly Float32Array[];
}>;

export type AnalysisSource = Readonly<{ id: string; filename: string; mimeType: string }>;

type RawFrame = {
  time: number;
  rms: number;
  peak: number;
  low: number;
  mid: number;
  high: number;
  brightness: number;
  texture: number;
  fullBandOnset: number;
  lowBandOnset: number;
  highBandOnset: number;
  sub: number;
  lowMid: number;
  percussionMid: number;
  percussionHigh: number;
  air: number;
  centroid: number;
  spread: number;
  flatness: number;
};

const EPSILON = 1e-12;
// Below roughly -100 dBFS, adaptive per-file normalization would turn numerical
// residue into false activity. Keep the raw references in metadata but emit rest.
const NEAR_SILENCE_RMS = 1e-5;
const bounded = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

export function downmixToMono(channels: readonly Float32Array[]): Float32Array {
  if (!channels.length) throw new Error('Audio has no channels');
  const length = Math.min(...channels.map(channel => channel.length));
  if (length <= 0) throw new Error('Audio is empty');
  const mono = new Float32Array(length);
  for (let channel = 0; channel < channels.length; channel += 1) {
    const samples = channels[channel];
    for (let index = 0; index < length; index += 1) mono[index] += samples[index] / channels.length;
  }
  return mono;
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

function percentile95(values: readonly number[]) {
  const finite = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!finite.length) return 0;
  return finite[Math.min(finite.length - 1, Math.floor((finite.length - 1) * 0.95))];
}

function* frameGenerator(mono: Float32Array, sampleRate: number): Generator<RawFrame> {
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) throw new Error('Invalid sample rate');
  const { frameSize, hopSize, fftSize } = REAL_AUDIO_ANALYSIS;
  const frameCount = Math.max(1, Math.ceil(mono.length / hopSize));
  let previousMagnitude = new Float64Array(fftSize / 2 + 1);
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const start = frameIndex * hopSize;
    const real = new Float64Array(fftSize);
    const imaginary = new Float64Array(fftSize);
    let sumSquares = 0;
    let peak = 0;
    for (let index = 0; index < frameSize; index += 1) {
      const sample = mono[start + index] ?? 0;
      sumSquares += sample * sample;
      peak = Math.max(peak, Math.abs(sample));
      real[index] = sample * (0.5 - 0.5 * Math.cos(2 * Math.PI * index / (frameSize - 1)));
    }
    fft(real, imaginary);
    const magnitude = new Float64Array(fftSize / 2 + 1);
    let lowEnergy = 0; let lowCount = 0;
    let midEnergy = 0; let midCount = 0;
    let highEnergy = 0; let highCount = 0;
    let magnitudeSum = 0; let weightedFrequency = 0; let weightedSquaredDistance = 0; let positiveFlux = 0;
    let logMagnitudeSum = 0; let spectralBinCount = 0;
    let sub = 0; let lowMid = 0; let percussionMid = 0; let percussionHigh = 0; let air = 0;
    let lowOnsetFlux = 0; let lowMagnitude = 0;
    let highOnsetFlux = 0; let highMagnitude = 0;
    for (let bin = 1; bin < magnitude.length; bin += 1) {
      const frequency = bin * sampleRate / fftSize;
      const value = Math.hypot(real[bin], imaginary[bin]) / (fftSize / 2);
      magnitude[bin] = value;
      magnitudeSum += value;
      weightedFrequency += frequency * value;
      logMagnitudeSum += Math.log(Math.max(EPSILON, value)); spectralBinCount += 1;
      const energy = value * value;
      if (frequency >= 20 && frequency < 160) sub += energy;
      else if (frequency < 600) lowMid += energy;
      else if (frequency < 2500) percussionMid += energy;
      else if (frequency < 8000) percussionHigh += energy;
      else air += energy;
      const positiveDifference = Math.max(0, value - previousMagnitude[bin]);
      positiveFlux += positiveDifference;
      if (frequency >= 20 && frequency < Math.min(180, sampleRate / 2)) {
        lowOnsetFlux += positiveDifference; lowMagnitude += value;
      }
      if (frequency >= 2500 && frequency <= sampleRate / 2) {
        highOnsetFlux += positiveDifference; highMagnitude += value;
      }
      if (frequency >= 20 && frequency < 250) { lowEnergy += value * value; lowCount += 1; }
      else if (frequency >= 250 && frequency < Math.min(4000, sampleRate / 2)) { midEnergy += value * value; midCount += 1; }
      else if (frequency >= 4000 && frequency <= sampleRate / 2) { highEnergy += value * value; highCount += 1; }
    }
    const centroidHz = magnitudeSum > EPSILON ? weightedFrequency / magnitudeSum : 0;
    for (let bin = 1; bin < magnitude.length; bin += 1) {
      const frequency = bin * sampleRate / fftSize;
      weightedSquaredDistance += (frequency - centroidHz) ** 2 * magnitude[bin];
    }
    const arithmeticMagnitude = magnitudeSum / Math.max(1, spectralBinCount);
    yield {
      time: start / sampleRate,
      rms: Math.sqrt(sumSquares / frameSize), peak,
      low: Math.sqrt(lowEnergy / Math.max(1, lowCount)),
      mid: Math.sqrt(midEnergy / Math.max(1, midCount)),
      high: Math.sqrt(highEnergy / Math.max(1, highCount)),
      brightness: magnitudeSum > EPSILON ? bounded(weightedFrequency / magnitudeSum / (sampleRate / 2)) : 0,
      texture: magnitudeSum > EPSILON ? positiveFlux / magnitudeSum : 0,
      fullBandOnset: magnitudeSum > EPSILON ? positiveFlux / magnitudeSum : 0,
      lowBandOnset: lowMagnitude > EPSILON ? lowOnsetFlux / lowMagnitude : 0,
      highBandOnset: highMagnitude > EPSILON ? highOnsetFlux / highMagnitude : 0,
      sub, lowMid, percussionMid, percussionHigh, air,
      centroid: bounded(centroidHz / (sampleRate / 2)),
      spread: magnitudeSum > EPSILON
        ? bounded(Math.sqrt(weightedSquaredDistance / magnitudeSum) / (sampleRate / 2)) : 0,
      flatness: arithmeticMagnitude > EPSILON
        ? bounded(Math.exp(logMagnitudeSum / Math.max(1, spectralBinCount)) / arithmeticMagnitude) : 0,
    };
    previousMagnitude = magnitude;
  }
}
function finalize(frames: RawFrame[], mono: Float32Array, pcm: PcmAudio): ListeningMap {
  const duration = Math.min(...pcm.channels.map(channel => channel.length)) / pcm.sampleRate;
  const rmsReference = percentile95(frames.map(frame => frame.rms));
  const bandReference = percentile95(frames.flatMap(frame => [frame.low, frame.mid, frame.high]));
  const textureReference = percentile95(frames.slice(1).map(frame => frame.texture));
  const fullOnsetReference = percentile95(frames.slice(1).map(frame => frame.fullBandOnset));
  const lowOnsetReference = percentile95(frames.slice(1).map(frame => frame.lowBandOnset));
  const highOnsetReference = percentile95(frames.slice(1).map(frame => frame.highBandOnset));
  const rmsDivisor = rmsReference > EPSILON ? rmsReference : 1;
  const bandDivisor = bandReference > EPSILON ? bandReference : 1;
  const textureDivisor = textureReference > EPSILON ? textureReference : 1;
  const fullOnsetDivisor = fullOnsetReference > EPSILON ? fullOnsetReference : 1;
  const lowOnsetDivisor = lowOnsetReference > EPSILON ? lowOnsetReference : 1;
  const highOnsetDivisor = highOnsetReference > EPSILON ? highOnsetReference : 1;
  const nearSilence = rmsReference < NEAR_SILENCE_RMS;
  const normalized = frames.map(frame => ({
    ...frame,
    rms: nearSilence ? 0 : bounded(frame.rms / rmsDivisor),
    peak: nearSilence ? 0 : bounded(frame.peak),
    low: nearSilence ? 0 : bounded(frame.low / bandDivisor),
    mid: nearSilence ? 0 : bounded(frame.mid / bandDivisor),
    high: nearSilence ? 0 : bounded(frame.high / bandDivisor),
    brightness: nearSilence ? 0 : frame.brightness,
    texture: nearSilence ? 0 : bounded(frame.texture / textureDivisor),
    fullBandOnset: nearSilence ? 0 : bounded(frame.fullBandOnset / fullOnsetDivisor),
    lowBandOnset: nearSilence ? 0 : bounded(frame.lowBandOnset / lowOnsetDivisor),
    highBandOnset: nearSilence ? 0 : bounded(frame.highBandOnset / highOnsetDivisor),
    onsetStrength: nearSilence ? 0 : bounded(frame.fullBandOnset / fullOnsetDivisor),
  }));
  const endFor = (index: number) => Math.max(normalized[index].time + 1 / pcm.sampleRate,
    Math.min(duration, normalized[index + 1]?.time ?? duration));
  const next = (index: number) => normalized[Math.min(normalized.length - 1, index + 1)];
  const spectrum: SpectrumRegion[] = normalized.map((frame, index) => ({
    id: `real-spectrum-${index}`, start: frame.time, end: endFor(index),
    low: [frame.low, next(index).low], mid: [frame.mid, next(index).mid], high: [frame.high, next(index).high],
    brightness: [frame.brightness, next(index).brightness], texture: [frame.texture, next(index).texture],
  }));
  const amplitude: AudioAmplitudeRegion[] = normalized.map((frame, index) => ({
    id: `real-amplitude-${index}`, start: frame.time, end: endFor(index),
    rms: [frame.rms, next(index).rms], peak: [frame.peak, next(index).peak],
    onsetStrength: [frame.onsetStrength, next(index).onsetStrength],
  }));
  const rhythmAnalysis = analyzeRhythm(
    normalized.map(frame => ({ time: frame.time, onsetStrength: frame.onsetStrength,
      fullBandOnset: frame.fullBandOnset, lowBandOnset: frame.lowBandOnset,
      highBandOnset: frame.highBandOnset, energy: frame.rms })),
    duration,
    REAL_AUDIO_ANALYSIS.hopSize / pcm.sampleRate,
  );
  const percussionAnalysis = analyzePercussion(normalized.map(frame => ({
    time: frame.time, rms: frame.rms, onsetStrength: frame.onsetStrength,
    sub: frame.sub, lowMid: frame.lowMid, mid: frame.percussionMid,
    high: frame.percussionHigh, air: frame.air, centroid: frame.centroid,
    spread: frame.spread, flatness: frame.flatness,
  })), duration, pcm.sampleRate, REAL_AUDIO_ANALYSIS.hopSize / pcm.sampleRate);
  const rhythm: RhythmSection[] | null = rhythmAnalysis.available && rhythmAnalysis.bpm !== null
    ? [{ id: 'real-rhythm', start: 0, end: duration, bpm: rhythmAnalysis.bpm,
      beatsPerBar: null, groove: rhythmAnalysis.groove, swing: rhythmAnalysis.swing }]
    : null;
  const melodyResult = analyzeMelodyWithEvidence({ mono, sampleRate: pcm.sampleRate });
  const melodyAnalysis = melodyResult.analysis;
  const melody = melodyAnalysis.available ? melodyAnalysis.notes : null;
  const harmonyAnalysis = analyzeHarmony({ mono, sampleRate: pcm.sampleRate });
  const harmony = harmonyAnalysis.available ? harmonyAnalysis.segments : null;
  const tonalCenterAnalysis = analyzeTonalCenter(harmonyAnalysis, duration);
  const structuralFrames = normalized.map(frame => {
    const harmonyFrame = harmonyAnalysis.frames.reduce<typeof harmonyAnalysis.frames[number] | null>((nearest, candidate) =>
      !nearest || Math.abs(candidate.time - frame.time) < Math.abs(nearest.time - frame.time) ? candidate : nearest, null);
    return { time: frame.time, chroma: harmonyFrame?.chroma ?? Array(12).fill(0),
      low: frame.low, mid: frame.mid, high: frame.high, brightness: frame.brightness,
      texture: frame.texture, rms: frame.rms, onsetStrength: frame.onsetStrength };
  });
  const structureAnalysis = analyzeStructure(
    structuralFrames, duration, rhythmAnalysis.available ? rhythmAnalysis.beats : null,
  );
  const metadata: AudioAnalysisMetadata = {
    version: 1, sampleRate: pcm.sampleRate, channelCount: pcm.channels.length,
    frameSize: REAL_AUDIO_ANALYSIS.frameSize, hopSize: REAL_AUDIO_ANALYSIS.hopSize,
    fftSize: REAL_AUDIO_ANALYSIS.fftSize, analyzedDuration: duration, downmix: 'arithmetic-mean',
    bandsHz: { low: [20, 250], mid: [250, 4000], high: [4000, pcm.sampleRate / 2] },
    normalization: { strategy: 'p95-reference', rmsReference, bandReference, textureReference },
  };
  return {
    version: 1, duration,
    capabilities: { melody: melodyAnalysis.available, rhythm: rhythmAnalysis.available,
      percussion: percussionAnalysis.available,
      harmony: harmonyAnalysis.available, tonalCenter: tonalCenterAnalysis.available,
      structure: structureAnalysis.available, spectrum: true },
    melody, melodyAnalysis, melodyEvidence: melodyResult.evidence,
    percussion: percussionAnalysis.available ? percussionAnalysis.events : null,
    percussionAnalysis, rhythm, rhythmAnalysis,
    harmony, harmonyAnalysis, tonalCenterAnalysis, structureAnalysis,
    spectrum, amplitude,
    analysis: metadata,
  };
}

function validatePcm(pcm: PcmAudio) {
  if (!pcm.channels.length || pcm.channels.some(channel => channel.length === 0)) throw new Error('Audio is empty');
  if (!Number.isFinite(pcm.sampleRate) || pcm.sampleRate <= 0) throw new Error('Invalid sample rate');
}

export function analyzePcmListening(pcm: PcmAudio): ListeningMap {
  validatePcm(pcm);
  const mono = downmixToMono(pcm.channels);
  return finalize([...frameGenerator(mono, pcm.sampleRate)], mono, pcm);
}

export async function analyzePcmListeningAsync(pcm: PcmAudio): Promise<ListeningMap> {
  validatePcm(pcm);
  const mono = downmixToMono(pcm.channels);
  const frames: RawFrame[] = [];
  let index = 0;
  for (const frame of frameGenerator(mono, pcm.sampleRate)) {
    frames.push(frame);
    index += 1;
    if (index % 24 === 0) await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return finalize(frames, mono, pcm);
}

const composeAnalyzedAudioMap = (listening: ListeningMap, source: AnalysisSource): AudioMap =>
  composeLegacyAudioMap(listening, {
    id: `real-audio-${source.id}`,
    source: { kind: 'real-audio', filename: source.filename, mimeType: source.mimeType },
  }, { structure: null, drops: null });

/** Temporary compatibility API for existing root AudioMap consumers. */
export function analyzePcmAudio(pcm: PcmAudio, source: AnalysisSource): AudioMap {
  return composeAnalyzedAudioMap(analyzePcmListening(pcm), source);
}

/** Temporary compatibility API for existing root AudioMap consumers. */
export async function analyzePcmAudioAsync(pcm: PcmAudio, source: AnalysisSource): Promise<AudioMap> {
  return composeAnalyzedAudioMap(await analyzePcmListeningAsync(pcm), source);
}

export function pcmFromAudioBuffer(buffer: AudioBuffer): PcmAudio {
  return {
    sampleRate: buffer.sampleRate,
    channels: Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index)),
  };
}
