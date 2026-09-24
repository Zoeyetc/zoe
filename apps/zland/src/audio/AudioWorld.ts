import { createListeningTimeline, lookupListeningSnapshot } from '@computational-listening/engine';
import type { AudioFrame, ZlandAudioMap, AudioSnapshot, TransportState } from './types.ts';
import { adaptZlandSnapshot, createZlandListeningAdapter } from './zland/ZlandListeningAdapter.ts';

export interface AudioWorld {
  read(transport: TransportState): AudioFrame;
  synchronize(from: number, transport: TransportState): AudioFrame;
}

/** Project generic listening truth into Z.land's authored snapshot contract. */
export function lookupSnapshot(map: ZlandAudioMap, transport: TransportState): AudioSnapshot {
  return adaptZlandSnapshot(map, lookupListeningSnapshot(map, transport.time), transport);
}

/** Z.land-owned facade over generic timeline observation and authored overlays. */
export function createAudioWorld(map: ZlandAudioMap): AudioWorld {
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
