import { analyzePcmListening, analyzePcmListeningAsync, type ListeningMap, type PcmAudio } from '@computational-listening/engine';
import { composeZlandAudioMap } from './composeZlandAudioMap.ts';
import type { ZlandAudioMap } from './types.ts';

export type ZlandAnalysisSource = Readonly<{ id: string; filename: string; mimeType: string }>;

const composeAnalyzedMap = (listening: ListeningMap, source: ZlandAnalysisSource): ZlandAudioMap =>
  composeZlandAudioMap(listening, {
    id: `real-audio-${source.id}`,
    source: { kind: 'real-audio', filename: source.filename, mimeType: source.mimeType },
  }, { structure: null, drops: null });

export function analyzeZlandPcmAudio(pcm: PcmAudio, source: ZlandAnalysisSource): ZlandAudioMap {
  return composeAnalyzedMap(analyzePcmListening(pcm), source);
}

export async function analyzeZlandPcmAudioAsync(pcm: PcmAudio, source: ZlandAnalysisSource): Promise<ZlandAudioMap> {
  return composeAnalyzedMap(await analyzePcmListeningAsync(pcm), source);
}
