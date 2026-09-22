import type { AudioEvent, AudioFrame, AudioMap, AudioSnapshot, TransportState } from './types';

export interface AudioWorld {
  read(transport: TransportState): AudioFrame;
  synchronize(from: number, transport: TransportState): AudioFrame;
}

/** Pure musical lookup. Transport is supplied by AudioClock, never advanced here. */
export function lookupSnapshot(map: AudioMap, transport: TransportState): AudioSnapshot {
  const activeNote = map.capabilities.melody
    ? (map.melody ?? []).find(note => note.start <= transport.time && transport.time < note.end) ?? null
    : null;
  const rhythmSection = map.capabilities.rhythm
    ? (map.rhythm ?? []).find(section => section.start <= transport.time && transport.time < section.end) ?? null
    : null;
  const beatPosition = rhythmSection ? transport.time * rhythmSection.bpm / 60 : 0;
  const positiveModulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;
  return {
    mapId: map.id,
    transport,
    capabilities: map.capabilities,
    melody: {
      available: map.capabilities.melody && map.melody !== null,
      active: activeNote !== null,
      activeNote,
      noteProgress: activeNote
        ? Math.min(1, Math.max(0, (transport.time - activeNote.start) / (activeNote.end - activeNote.start)))
        : 0,
    },
    percussion: {
      available: map.capabilities.rhythm && map.percussion !== null,
    },
    rhythm: {
      available: map.capabilities.rhythm && map.rhythm !== null,
      bpm: rhythmSection?.bpm ?? null,
      beatPhase: rhythmSection ? positiveModulo(beatPosition, 1) : 0,
      barPhase: rhythmSection ? positiveModulo(beatPosition, rhythmSection.beatsPerBar) / rhythmSection.beatsPerBar : 0,
      groove: rhythmSection?.groove ?? 0,
      swing: rhythmSection?.swing ?? 0,
    },
  };
}

type TimelineEvent = Extract<AudioEvent, { readonly time: number }>;

function createTimeline(map: AudioMap): TimelineEvent[] {
  const melody: TimelineEvent[] = !map.capabilities.melody || map.melody === null
    ? []
    : map.melody.flatMap(note => [
      { type: 'note-on' as const, time: note.start, note },
      { type: 'note-off' as const, time: note.end, note },
    ]);
  const percussion: TimelineEvent[] = !map.capabilities.rhythm || map.percussion === null
    ? []
    : map.percussion.map(hit => ({
      type: hit.type, time: hit.time, id: hit.id, strength: hit.strength,
    }));
  return [...melody, ...percussion]
    .sort((a, b) => a.time - b.time || (a.type === 'note-off' ? -1 : 1));
}

/** Owns musical lookup and a timeline-crossing cursor, never transport time. */
export function createAudioWorld(map: AudioMap): AudioWorld {
  const timeline = createTimeline(map);
  let previousTime: number | null = null;

  return {
    read(transport) {
      const from = previousTime;
      previousTime = transport.time;
      const events = from !== null && transport.time > from
        ? timeline.filter(event => from < event.time && event.time <= transport.time)
        : [];
      return { snapshot: lookupSnapshot(map, transport), events };
    },
    synchronize(from, transport) {
      previousTime = transport.time;
      return {
        snapshot: lookupSnapshot(map, transport),
        events: [{ type: 'seek', from, to: transport.time }],
      };
    },
  };
}
