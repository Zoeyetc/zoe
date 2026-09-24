import type { ListeningMap } from '@computational-listening/engine';
import type { ZlandAudioMap, AudioMapHostMetadata, ZlandAuthoredOverlay } from './types.ts';

/** Compose generic analyzed truth with explicitly Z.land-owned host and authored data. */
export function composeZlandAudioMap(
  listening: ListeningMap,
  host: AudioMapHostMetadata,
  authored: ZlandAuthoredOverlay,
): ZlandAudioMap {
  return { ...listening, ...host, ...authored };
}
