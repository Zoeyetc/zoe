import { createListeningTimeline, lookupListeningSnapshot } from '@computational-listening/engine';
import type { AudioFrame, AudioMap, AudioSnapshot, TransportState } from './types.ts';
import { adaptZlandSnapshot, createZlandListeningAdapter } from './zland/ZlandListeningAdapter.ts';

export interface AudioWorld {
  read(transport: TransportState): AudioFrame;
  synchronize(from: number, transport: TransportState): AudioFrame;
}

/** Temporary legacy facade. Generic observation belongs to ListeningTimeline. */
export function lookupSnapshot(map: AudioMap, transport: TransportState): AudioSnapshot {
  return adaptZlandSnapshot(map, lookupListeningSnapshot(map, transport.time), transport);
}

/** Temporary Z.land facade over generic timeline observation and authored overlays. */
export function createAudioWorld(map: AudioMap): AudioWorld {
  const timeline = createListeningTimeline(map, map.id);
  const zland = createZlandListeningAdapter(map);
  return {
    read(transport) {
      return zland.read(timeline.read(transport.time), transport);
    },
    synchronize(from, transport) {
      return zland.synchronize(timeline.synchronize(transport.time), from, transport);
    },
  };
}
