import type { AudioEvent, AudioFrame, AudioMap, AudioSnapshot, TransportState } from './types';
import { deriveScaleDegreeEvidence, selectReferenceTonicMidi } from './ScaleDegree.ts';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const noteNameForMidi = (midi: number) => `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
const pitchForMidi = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

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
    ? (map.rhythm ?? []).find(section => section.start <= transport.time
      && (transport.time < section.end || (transport.time === map.duration && section.end === map.duration))) ?? null
    : null;
  const harmonyRegion = map.capabilities.harmony
    ? (map.harmony ?? []).find(region => region.start <= transport.time && transport.time < region.end) ?? null
    : null;
  const tonalCenterSegment = map.capabilities.tonalCenter && map.tonalCenterAnalysis?.available
    ? map.tonalCenterAnalysis.segments.find(segment => segment.start <= transport.time
      && (transport.time < segment.end || (transport.time === map.duration && segment.end === map.duration))) ?? null
    : null;
  const structureRegion = map.capabilities.structure
    ? (map.structure ?? []).find(region => region.start <= transport.time && transport.time < region.end) ?? null
    : null;
  const analyzedStructure = map.capabilities.structure && map.structureAnalysis?.available
    ? map.structureAnalysis : null;
  const structureSegment = analyzedStructure?.segments.find(segment => segment.start <= transport.time
    && (transport.time < segment.end || (transport.time === map.duration && segment.end === map.duration))) ?? null;
  const spectrumRegion = map.capabilities.spectrum
    ? (map.spectrum ?? []).find(region => region.start <= transport.time && transport.time < region.end) ?? null
    : null;
  const amplitudeRegion = map.capabilities.spectrum
    ? (map.amplitude ?? []).find(region => region.start <= transport.time && transport.time < region.end) ?? null
    : null;
  const activeStructureStart = structureSegment?.start ?? structureRegion?.start;
  const activeStructureEnd = structureSegment?.end ?? structureRegion?.end;
  const structureProgress = activeStructureStart !== undefined && activeStructureEnd !== undefined
    ? Math.min(1, Math.max(0, (transport.time - activeStructureStart) / (activeStructureEnd - activeStructureStart)))
    : 0;
  const interpolate = (range: readonly [number, number]) => range[0] + (range[1] - range[0]) * structureProgress;
  const spectrumProgress = spectrumRegion
    ? Math.min(1, Math.max(0, (transport.time - spectrumRegion.start) / (spectrumRegion.end - spectrumRegion.start)))
    : 0;
  const interpolateSpectrum = (range: readonly [number, number]) => range[0] + (range[1] - range[0]) * spectrumProgress;
  const amplitudeProgress = amplitudeRegion
    ? Math.min(1, Math.max(0, (transport.time - amplitudeRegion.start) / (amplitudeRegion.end - amplitudeRegion.start)))
    : 0;
  const interpolateAmplitude = (range: readonly [number, number]) => range[0] + (range[1] - range[0]) * amplitudeProgress;
  const positiveModulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;
  const analyzedRhythm = map.capabilities.rhythm && map.rhythmAnalysis?.available ? map.rhythmAnalysis : null;
  const analyzedBeats = analyzedRhythm?.beats ?? [];
  let analyzedPreviousIndex = -1;
  for (let index = 0; index < analyzedBeats.length && analyzedBeats[index].time <= transport.time; index += 1) {
    analyzedPreviousIndex = index;
  }
  const analyzedPrevious = analyzedPreviousIndex >= 0 ? analyzedBeats[analyzedPreviousIndex] : null;
  const analyzedNext = analyzedBeats[analyzedPreviousIndex + 1] ?? null;
  const analyzedInterval = analyzedPrevious && analyzedNext
    ? analyzedNext.time - analyzedPrevious.time
    : analyzedRhythm?.beatInterval ?? null;
  const analyzedPhase = analyzedRhythm && analyzedInterval && analyzedInterval > 0
    ? positiveModulo((transport.time - (analyzedPrevious?.time ?? analyzedBeats[0]?.time ?? 0)) / analyzedInterval, 1)
    : 0;
  const nearestAnalyzedBeat = analyzedBeats.reduce<typeof analyzedBeats[number] | null>((nearest, beat) =>
    !nearest || Math.abs(beat.time - transport.time) < Math.abs(nearest.time - transport.time) ? beat : nearest, null);
  const beatPosition = rhythmSection ? transport.time * rhythmSection.bpm / 60 : 0;
  const authoredBeatIndex = rhythmSection ? Math.floor(beatPosition) : null;
  const beatsPerBar = rhythmSection?.beatsPerBar ?? null;
  const previousStructureBoundary = analyzedStructure?.boundaries.filter(boundary => boundary.time <= transport.time).at(-1) ?? null;
  const nextStructureBoundary = analyzedStructure?.boundaries.find(boundary => boundary.time > transport.time) ?? null;
  const currentStructureFrameIndex = analyzedStructure?.frames.findIndex(frame => frame.start <= transport.time
    && (transport.time < frame.end || (transport.time === map.duration && frame.end === map.duration))) ?? -1;
  const percussionAvailable = map.capabilities.percussion && map.percussion !== null;
  const recentPercussion = percussionAvailable
    ? (map.percussion ?? []).filter(hit => hit.time <= transport.time && transport.time - hit.time <= 0.35)
    : [];
  const percussionActivity = recentPercussion.reduce((sum, hit) => {
    const decay = Math.max(0, 1 - (transport.time - hit.time) / 0.35);
    return Math.min(1, sum + hit.strength * decay);
  }, 0);
  const activeNoteName = activeNote?.noteName ?? (activeNote ? noteNameForMidi(activeNote.midi) : null);
  const referenceTonicMidi = tonalCenterSegment
    ? selectReferenceTonicMidi(map.melody ?? [], tonalCenterSegment.rootPitchClass, tonalCenterSegment)
    : null;
  const scaleDegree = deriveScaleDegreeEvidence({ note: activeNote, noteName: activeNoteName,
    melodyConfidence: activeNote?.confidence ?? (activeNote ? 1 : 0),
    tonalCenter: tonalCenterSegment, referenceTonicMidi });
  return {
    mapId: map.id,
    transport,
    capabilities: map.capabilities,
    melody: {
      available: map.capabilities.melody && map.melody !== null,
      active: activeNote !== null,
      source: activeNote?.source ?? (map.melodyAnalysis ? 'predominant-analysis'
        : map.capabilities.melody && map.melody !== null ? 'authored' : 'unavailable'),
      activeNote,
      noteProgress: activeNote
        ? Math.min(1, Math.max(0, (transport.time - activeNote.start) / (activeNote.end - activeNote.start)))
        : 0,
      midi: activeNote?.midi ?? null,
      pitchHz: activeNote?.pitchHz ?? (activeNote ? pitchForMidi(activeNote.midi) : null),
      noteName: activeNoteName,
      intensity: activeNote?.intensity ?? 0,
      confidence: activeNote?.confidence ?? (activeNote ? 1 : 0),
      scaleDegree,
    },
    percussion: {
      available: percussionAvailable,
      activity: percussionActivity,
      confidence: map.percussionAnalysis?.confidence ?? (percussionAvailable ? 1 : 0),
    },
    rhythm: {
      available: map.capabilities.rhythm && map.rhythm !== null,
      bpm: rhythmSection?.bpm ?? null,
      confidence: analyzedRhythm?.confidence ?? (rhythmSection ? 1 : 0),
      beatIndex: analyzedRhythm ? (analyzedPrevious?.index ?? null) : authoredBeatIndex,
      beatInterval: analyzedRhythm?.beatInterval ?? (rhythmSection ? 60 / rhythmSection.bpm : null),
      nearestBeatTime: analyzedRhythm ? nearestAnalyzedBeat?.time ?? null
        : rhythmSection && authoredBeatIndex !== null ? authoredBeatIndex * 60 / rhythmSection.bpm : null,
      beatPhase: analyzedRhythm ? analyzedPhase : rhythmSection ? positiveModulo(beatPosition, 1) : 0,
      beatInBar: beatsPerBar && authoredBeatIndex !== null ? positiveModulo(authoredBeatIndex, beatsPerBar) : null,
      barIndex: beatsPerBar && authoredBeatIndex !== null ? Math.floor(authoredBeatIndex / beatsPerBar) : null,
      barPhase: rhythmSection && beatsPerBar ? positiveModulo(beatPosition, beatsPerBar) / beatsPerBar : 0,
      groove: rhythmSection?.groove ?? 0,
      swing: rhythmSection?.swing ?? 0,
      swingConfidence: analyzedRhythm?.swingConfidence ?? (rhythmSection ? 1 : 0),
    },
    harmony: {
      available: map.capabilities.harmony && map.harmony !== null,
      active: harmonyRegion !== null,
      chord: harmonyRegion?.chord ?? null,
      rootPitchClass: harmonyRegion?.rootPitchClass ?? null,
      pitchClasses: harmonyRegion?.pitchClasses ?? [],
      confidence: harmonyRegion?.confidence ?? 0,
    },
    tonalCenter: {
      available: map.capabilities.tonalCenter && map.tonalCenterAnalysis?.available === true,
      rootPitchClass: tonalCenterSegment?.rootPitchClass ?? null,
      mode: tonalCenterSegment?.mode ?? null,
      label: tonalCenterSegment?.label ?? null,
      confidence: tonalCenterSegment?.confidence ?? 0,
      segmentProgress: tonalCenterSegment
        ? Math.min(1, Math.max(0, (transport.time - tonalCenterSegment.start)
          / Math.max(1e-9, tonalCenterSegment.end - tonalCenterSegment.start)))
        : 0,
      circleOfFifthsIndex: tonalCenterSegment?.circleOfFifthsIndex ?? null,
      distanceFromPrevious: tonalCenterSegment?.distanceFromPrevious ?? null,
      segmentId: tonalCenterSegment?.id ?? null,
    },
    structure: {
      source: structureSegment ? 'analysis' : structureRegion ? 'authored' : null,
      available: map.capabilities.structure && (structureSegment !== null || structureRegion !== null),
      segmentId: structureSegment?.id ?? structureRegion?.id ?? null,
      section: structureSegment?.label ?? structureRegion?.section ?? null,
      label: structureSegment?.label ?? structureRegion?.section ?? null,
      recurrenceGroup: structureSegment?.recurrenceGroup ?? null,
      segmentStart: activeStructureStart ?? null,
      segmentEnd: activeStructureEnd ?? null,
      sectionProgress: structureProgress,
      confidence: structureSegment?.confidence ?? (structureRegion ? 1 : 0),
      energy: structureSegment?.energy ?? (structureRegion ? interpolate(structureRegion.energy) : 0),
      contrast: structureSegment?.contrast ?? 0,
      importance: structureSegment?.importance ?? 0,
      novelty: currentStructureFrameIndex >= 0 ? analyzedStructure?.novelty[currentStructureFrameIndex] ?? 0 : 0,
      previousBoundaryTime: previousStructureBoundary?.time ?? null,
      nextBoundaryTime: nextStructureBoundary?.time ?? null,
      previousBoundaryConfidence: previousStructureBoundary?.confidence ?? null,
      nextBoundaryConfidence: nextStructureBoundary?.confidence ?? null,
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
      rms: amplitudeRegion ? interpolateAmplitude(amplitudeRegion.rms) : 0,
      peak: amplitudeRegion ? interpolateAmplitude(amplitudeRegion.peak) : 0,
      onsetStrength: amplitudeRegion ? interpolateAmplitude(amplitudeRegion.onsetStrength) : 0,
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
  const percussion: TimelineEvent[] = !map.capabilities.percussion || map.percussion === null
    ? []
    : map.percussion.map(hit => ({
      type: hit.type, time: hit.time, id: hit.id, strength: hit.strength,
      confidence: hit.confidence ?? 1, hit,
    }));
  const beats: TimelineEvent[] = !map.capabilities.rhythm || !map.rhythmAnalysis?.available
    ? []
    : map.rhythmAnalysis.beats.map(beat => ({
      type: 'beat', time: beat.time, id: beat.id, index: beat.index, strength: beat.strength,
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
  const tonalCenter: TimelineEvent[] = !map.capabilities.tonalCenter || !map.tonalCenterAnalysis?.available
    ? []
    : map.tonalCenterAnalysis.segments.slice(1).map(segment => ({
      type: 'tonal-center-change', time: segment.start, tonalCenter: segment,
    }));
  const structure: TimelineEvent[] = !map.capabilities.structure || !map.structureAnalysis?.available
    ? []
    : map.structureAnalysis.segments.slice(1).map(segment => ({
      type: 'section-change', time: segment.start, structure: segment,
    }));
  const drops: TimelineEvent[] = !map.capabilities.structure || map.drops === null
    ? []
    : map.drops.map(drop => ({ type: 'drop', time: drop.time, id: drop.id, strength: drop.strength }));
  return [...melody, ...percussion, ...beats, ...harmony, ...tonalCenter, ...structure, ...drops]
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
