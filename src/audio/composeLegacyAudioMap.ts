import type { ListeningMap } from '@computational-listening/engine';
import type { AudioMap, AudioMapHostMetadata, ZlandAuthoredOverlay } from './types.ts';

/** Temporary root composition. Delete after legacy AudioMap consumers migrate. */
export function composeLegacyAudioMap(
  listening: ListeningMap,
  host: AudioMapHostMetadata,
  authored: ZlandAuthoredOverlay,
): AudioMap {
  return { ...listening, ...host, ...authored };
}
