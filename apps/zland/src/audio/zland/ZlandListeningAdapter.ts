import type { ListeningEvent, ListeningFrame, ListeningSnapshot } from '@computational-listening/engine';
import type { AudioEvent, AudioFrame, ZlandAudioMap, AudioSnapshot, TransportState } from '../types.ts';

const interpolate = (range: readonly [number, number], progress: number) => range[0] + (range[1] - range[0]) * progress;
const eventOrder = (a: Extract<AudioEvent, { time: number }>, b: Extract<AudioEvent, { time: number }>) =>
  a.time - b.time || (a.type === 'note-off' ? -1 : 1);

export function adaptZlandSnapshot(
  map: ZlandAudioMap,
  listening: ListeningSnapshot,
  transport: TransportState,
): AudioSnapshot {
  const authored = !listening.structure.available && map.capabilities.structure
    ? (map.structure ?? []).find(region => region.start <= transport.time && transport.time < region.end) ?? null
    : null;
  const authoredProgress = authored
    ? Math.min(1, Math.max(0, (transport.time - authored.start) / (authored.end - authored.start)))
    : 0;
  const analyzed = listening.structure;
  return {
    mapId: map.id,
    transport,
    capabilities: listening.capabilities,
    melody: listening.melody,
    percussion: listening.percussion,
    rhythm: listening.rhythm,
    harmony: listening.harmony,
    tonalCenter: listening.tonalCenter,
    structure: {
      source: analyzed.available ? 'analysis' : authored ? 'authored' : null,
      available: analyzed.available || authored !== null,
      segmentId: analyzed.segmentId ?? authored?.id ?? null,
      section: analyzed.section ?? authored?.section ?? null,
      label: analyzed.label ?? authored?.section ?? null,
      recurrenceGroup: analyzed.recurrenceGroup,
      segmentStart: analyzed.segmentStart ?? authored?.start ?? null,
      segmentEnd: analyzed.segmentEnd ?? authored?.end ?? null,
      sectionProgress: analyzed.available ? analyzed.sectionProgress : authoredProgress,
      confidence: analyzed.available ? analyzed.confidence : authored ? 1 : 0,
      energy: analyzed.available ? analyzed.energy : authored ? interpolate(authored.energy, authoredProgress) : 0,
      contrast: analyzed.contrast,
      importance: analyzed.importance,
      novelty: analyzed.novelty,
      previousBoundaryTime: analyzed.previousBoundaryTime,
      nextBoundaryTime: analyzed.nextBoundaryTime,
      previousBoundaryConfidence: analyzed.previousBoundaryConfidence,
      nextBoundaryConfidence: analyzed.nextBoundaryConfidence,
      tension: authored ? interpolate(authored.tension, authoredProgress) : 0,
      build: authored ? interpolate(authored.build, authoredProgress) : 0,
      phraseProgress: authored ? interpolate(authored.phraseProgress, authoredProgress) : 0,
    },
    spectrum: listening.spectrum,
  };
}

export interface ZlandListeningAdapter {
  read(frame: ListeningFrame, transport: TransportState): AudioFrame;
  synchronize(frame: ListeningFrame, from: number, transport: TransportState): AudioFrame;
}

export function createZlandListeningAdapter(map: ZlandAudioMap): ZlandListeningAdapter {
  let previousTime: number | null = null;
  const drops: Extract<AudioEvent, { type: 'drop' }>[] = !map.capabilities.structure || map.drops === null
    ? [] : map.drops.map(drop => ({ type: 'drop', time: drop.time, id: drop.id, strength: drop.strength }));
  return {
    read(frame, transport) {
      const from = previousTime;
      previousTime = transport.time;
      const crossedDrops = from !== null && transport.time > from
        ? drops.filter(event => from < event.time && event.time <= transport.time) : [];
      const events = [...frame.events as readonly ListeningEvent[], ...crossedDrops].sort(eventOrder);
      return { snapshot: adaptZlandSnapshot(map, frame.snapshot, transport), events };
    },
    synchronize(frame, from, transport) {
      previousTime = transport.time;
      return {
        snapshot: adaptZlandSnapshot(map, frame.snapshot, transport),
        events: [{ type: 'seek', from, to: transport.time }],
      };
    },
  };
}
