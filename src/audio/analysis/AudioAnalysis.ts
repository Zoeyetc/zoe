import {
  analyzePcmListening,
  analyzePcmListeningAsync,
  type ListeningMap,
  type PcmAudio,
} from '@computational-listening/engine';
import { composeLegacyAudioMap } from '../composeLegacyAudioMap.ts';
import type { AudioMap } from '../types.ts';

export {
  REAL_AUDIO_ANALYSIS,
  analyzePcmListening,
  analyzePcmListeningAsync,
  downmixToMono,
} from '@computational-listening/engine';
export type { PcmAudio } from '@computational-listening/engine';
export { pcmFromAudioBuffer } from '@computational-listening/audio-source-browser';

export type AnalysisSource = Readonly<{ id: string; filename: string; mimeType: string }>;

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
