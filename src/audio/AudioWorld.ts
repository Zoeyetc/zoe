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
  const harmonyRegion = map.capabilities.harmony
    ? (map.harmony ?? []).find(region => region.start <= transport.time && transport.time < region.end) ?? null
    : null;
  const structureRegion = map.capabilities.structure
    ? (map.structure ?? []).find(region => region.start <= transport.time && transport.time < region.end) ?? null
    : null;
  const spectrumRegion = map.capabilities.spectrum
    ? (map.spectrum ?? []).find(region => region.start <= transport.time && transport.time < region.end) ?? null
    : null;
  const structureProgress = structureRegion
    ? Math.min(1, Math.max(0, (transport.time - structureRegion.start) / (structureRegion.end - structureRegion.start)))
    : 0;
  const interpolate = (range: readonly [number, number]) => range[0] + (range[1] - range[0]) * structureProgress;
  const spectrumProgress = spectrumRegion
    ? Math.min(1, Math.max(0, (transport.time - spectrumRegion.start) / (spectrumRegion.end - spectrumRegion.start)))
    : 0;
  const interpolateSpectrum = (range: readonly [number, number]) => range[0] + (range[1] - range[0]) * spectrumProgress;
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
    harmony: {
      available: map.capabilities.harmony && map.harmony !== null,
      active: harmonyRegion !== null,
      chord: harmonyRegion?.chord ?? null,
      rootPitchClass: harmonyRegion?.rootPitchClass ?? null,
      pitchClasses: harmonyRegion?.pitchClasses ?? [],
      confidence: harmonyRegion?.confidence ?? 0,
    },
    structure: {
      available: map.capabilities.structure && map.structure !== null,
      section: structureRegion?.section ?? null,
      sectionProgress: structureProgress,
      energy: structureRegion ? interpolate(structureRegion.energy) : 0,
      tension: structureRegion ? interpolate(structureRegion.tension) : 0,
      build: structureRegion ? interpolate(structureRegion.build) : 0,
      phraseProgress: structureRegion ? interpolate(structureRegion.phraseProgress) : 0,
    },
    spectrum: {
      available: map.capabilities.spectrum && map.spectrum !== null,
      low: spectrumRegion ? interpolateSpectrum(spectrumRegion.low) : 0,
      mid: spectrumRegion ? interpolateSpectrum(spectrumRegion.mid) : 0,
      high: spectrumRegion ? interpolateSpectrum(spectrumRegion.high) : 0,
      brightness: spectrumRegion ? interpolateSpectrum(spectrumRegion.brightness) : 0,
      texture: spectrumRegion ? interpolateSpectrum(spectrumRegion.texture) : 0,
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
  const harmony: TimelineEvent[] = !map.capabilities.harmony || map.harmony === null
    ? []
    : map.harmony.flatMap((region, index, regions) => {
      const changes: TimelineEvent[] = [{ type: 'chord-change', time: region.start, harmony: region }];
      const next = regions[index + 1];
      if (!next || next.start > region.end) {
        changes.push({ type: 'chord-change', time: region.end, harmony: null });
      }
      return changes;
    });
  const drops: TimelineEvent[] = !map.capabilities.structure || map.drops === null
    ? []
    : map.drops.map(drop => ({ type: 'drop', time: drop.time, id: drop.id, strength: drop.strength }));
  return [...melody, ...percussion, ...harmony, ...drops]
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
