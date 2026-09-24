import type { ListeningMap } from './types.ts';
import type { ListeningEvent, ListeningFrame, ListeningMapIdentity, ListeningSnapshot } from './listeningTimelineTypes.ts';
import { deriveScaleDegreeEvidence, selectReferenceTonicMidi } from './scaleDegree.ts';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const noteNameForMidi = (midi: number) => `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
const pitchForMidi = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Pure musical lookup. Transport is supplied by AudioClock, never advanced here. */
export function lookupListeningSnapshot(map: ListeningMap, time: number): ListeningSnapshot {
  const activeNote = map.capabilities.melody
    ? (map.melody ?? []).find(note => note.start <= time && time < note.end) ?? null
    : null;
  const rhythmSection = map.capabilities.rhythm
    ? (map.rhythm ?? []).find(section => section.start <= time
      && (time < section.end || (time === map.duration && section.end === map.duration))) ?? null
    : null;
  const harmonyRegion = map.capabilities.harmony
    ? (map.harmony ?? []).find(region => region.start <= time && time < region.end) ?? null
    : null;
  const tonalCenterSegment = map.capabilities.tonalCenter && map.tonalCenterAnalysis?.available
    ? map.tonalCenterAnalysis.segments.find(segment => segment.start <= time
      && (time < segment.end || (time === map.duration && segment.end === map.duration))) ?? null
    : null;
  const analyzedStructure = map.capabilities.structure && map.structureAnalysis?.available
    ? map.structureAnalysis : null;
  const structureSegment = analyzedStructure?.segments.find(segment => segment.start <= time
    && (time < segment.end || (time === map.duration && segment.end === map.duration))) ?? null;
  const spectrumRegion = map.capabilities.spectrum
    ? (map.spectrum ?? []).find(region => region.start <= time && time < region.end) ?? null
    : null;
  const amplitudeRegion = map.capabilities.spectrum
    ? (map.amplitude ?? []).find(region => region.start <= time && time < region.end) ?? null
    : null;
  const activeStructureStart = structureSegment?.start;
  const activeStructureEnd = structureSegment?.end;
  const structureProgress = activeStructureStart !== undefined && activeStructureEnd !== undefined
    ? Math.min(1, Math.max(0, (time - activeStructureStart) / (activeStructureEnd - activeStructureStart)))
    : 0;
  const spectrumProgress = spectrumRegion
    ? Math.min(1, Math.max(0, (time - spectrumRegion.start) / (spectrumRegion.end - spectrumRegion.start)))
    : 0;
  const interpolateSpectrum = (range: readonly [number, number]) => range[0] + (range[1] - range[0]) * spectrumProgress;
  const amplitudeProgress = amplitudeRegion
    ? Math.min(1, Math.max(0, (time - amplitudeRegion.start) / (amplitudeRegion.end - amplitudeRegion.start)))
    : 0;
  const interpolateAmplitude = (range: readonly [number, number]) => range[0] + (range[1] - range[0]) * amplitudeProgress;
  const positiveModulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;
  const analyzedRhythm = map.capabilities.rhythm && map.rhythmAnalysis?.available ? map.rhythmAnalysis : null;
  const analyzedBeats = analyzedRhythm?.beats ?? [];
  let analyzedPreviousIndex = -1;
  for (let index = 0; index < analyzedBeats.length && analyzedBeats[index].time <= time; index += 1) {
    analyzedPreviousIndex = index;
  }
  const analyzedPrevious = analyzedPreviousIndex >= 0 ? analyzedBeats[analyzedPreviousIndex] : null;
  const analyzedNext = analyzedBeats[analyzedPreviousIndex + 1] ?? null;
  const analyzedInterval = analyzedPrevious && analyzedNext
    ? analyzedNext.time - analyzedPrevious.time
    : analyzedRhythm?.beatInterval ?? null;
  const analyzedPhase = analyzedRhythm && analyzedInterval && analyzedInterval > 0
    ? positiveModulo((time - (analyzedPrevious?.time ?? analyzedBeats[0]?.time ?? 0)) / analyzedInterval, 1)
    : 0;
  const nearestAnalyzedBeat = analyzedBeats.reduce<typeof analyzedBeats[number] | null>((nearest, beat) =>
    !nearest || Math.abs(beat.time - time) < Math.abs(nearest.time - time) ? beat : nearest, null);
  const beatPosition = rhythmSection ? time * rhythmSection.bpm / 60 : 0;
  const authoredBeatIndex = rhythmSection ? Math.floor(beatPosition) : null;
  const beatsPerBar = rhythmSection?.beatsPerBar ?? null;
  const previousStructureBoundary = analyzedStructure?.boundaries.filter(boundary => boundary.time <= time).at(-1) ?? null;
  const nextStructureBoundary = analyzedStructure?.boundaries.find(boundary => boundary.time > time) ?? null;
  const currentStructureFrameIndex = analyzedStructure?.frames.findIndex(frame => frame.start <= time
    && (time < frame.end || (time === map.duration && frame.end === map.duration))) ?? -1;
  const percussionAvailable = map.capabilities.percussion && map.percussion !== null;
  const recentPercussion = percussionAvailable
    ? (map.percussion ?? []).filter(hit => hit.time <= time && time - hit.time <= 0.35)
    : [];
  const percussionActivity = recentPercussion.reduce((sum, hit) => {
    const decay = Math.max(0, 1 - (time - hit.time) / 0.35);
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
    capabilities: map.capabilities,
    melody: {
      available: map.capabilities.melody && map.melody !== null,
      active: activeNote !== null,
      source: activeNote?.source ?? (map.melodyAnalysis ? 'predominant-analysis'
        : map.capabilities.melody && map.melody !== null ? 'authored' : 'unavailable'),
      activeNote,
      noteProgress: activeNote
        ? Math.min(1, Math.max(0, (time - activeNote.start) / (activeNote.end - activeNote.start)))
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
        ? Math.min(1, Math.max(0, (time - tonalCenterSegment.start)
          / Math.max(1e-9, tonalCenterSegment.end - tonalCenterSegment.start)))
        : 0,
      circleOfFifthsIndex: tonalCenterSegment?.circleOfFifthsIndex ?? null,
      distanceFromPrevious: tonalCenterSegment?.distanceFromPrevious ?? null,
      segmentId: tonalCenterSegment?.id ?? null,
    },
    structure: {
      available: map.capabilities.structure && structureSegment !== null,
      segmentId: structureSegment?.id ?? null,
      section: structureSegment?.label ?? null,
      label: structureSegment?.label ?? null,
      recurrenceGroup: structureSegment?.recurrenceGroup ?? null,
      segmentStart: activeStructureStart ?? null,
      segmentEnd: activeStructureEnd ?? null,
      sectionProgress: structureProgress,
      confidence: structureSegment?.confidence ?? 0,
      energy: structureSegment?.energy ?? 0,
      contrast: structureSegment?.contrast ?? 0,
      importance: structureSegment?.importance ?? 0,
      novelty: currentStructureFrameIndex >= 0 ? analyzedStructure?.novelty[currentStructureFrameIndex] ?? 0 : 0,
      previousBoundaryTime: previousStructureBoundary?.time ?? null,
      nextBoundaryTime: nextStructureBoundary?.time ?? null,
      previousBoundaryConfidence: previousStructureBoundary?.confidence ?? null,
      nextBoundaryConfidence: nextStructureBoundary?.confidence ?? null,
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

type TimelineEvent = ListeningEvent;

export type ListeningEventCollectionOptions = Readonly<{
  includeInitialTonalCenter?: boolean;
  includeHarmonyEnds?: boolean;
  percussionDefaultConfidence?: number;
  noteOffFirstAtSameTime?: boolean;
}>;

export function collectListeningEvents(map: ListeningMap, options: ListeningEventCollectionOptions = {}): TimelineEvent[] {
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
      confidence: hit.confidence ?? options.percussionDefaultConfidence ?? 1, hit,
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
      if (options.includeHarmonyEnds !== false && (!next || next.start > region.end)) {
        changes.push({ type: 'chord-change', time: region.end, harmony: null });
      }
      return changes;
    });
  const tonalCenter: TimelineEvent[] = !map.capabilities.tonalCenter || !map.tonalCenterAnalysis?.available
    ? []
    : map.tonalCenterAnalysis.segments.slice(options.includeInitialTonalCenter ? 0 : 1).map(segment => ({
      type: 'tonal-center-change', time: segment.start, tonalCenter: segment,
    }));
  const structure: TimelineEvent[] = !map.capabilities.structure || !map.structureAnalysis?.available
    ? []
    : map.structureAnalysis.segments.slice(1).map(segment => ({
      type: 'section-change', time: segment.start, structure: segment,
    }));
  return [...melody, ...percussion, ...beats, ...harmony, ...tonalCenter, ...structure]
    .sort((a, b) => a.time - b.time || (options.noteOffFirstAtSameTime === false ? 0 : a.type === 'note-off' ? -1 : 1));
}

export interface ListeningTimeline {
  read(time: number): ListeningFrame;
  synchronize(time: number): ListeningFrame;
  replaceMap(map: ListeningMap, identity: ListeningMapIdentity, time: number): ListeningFrame;
  readonly identity: ListeningMapIdentity;
}

/** Owns generic listening lookup and crossing state, never transport time. */
export function createListeningTimeline(initialMap: ListeningMap, initialIdentity: ListeningMapIdentity): ListeningTimeline {
  let map = initialMap;
  let identity = initialIdentity;
  let timeline = collectListeningEvents(map);
  let previousTime: number | null = null;

  return {
    get identity() { return identity; },
    read(time) {
      const from = previousTime;
      previousTime = time;
      const events = from !== null && time > from
        ? timeline.filter(event => from < event.time && event.time <= time)
        : [];
      return { snapshot: lookupListeningSnapshot(map, time), events };
    },
    synchronize(time) {
      previousTime = time;
      return { snapshot: lookupListeningSnapshot(map, time), events: [] };
    },
    replaceMap(nextMap, nextIdentity, time) {
      map = nextMap;
      identity = nextIdentity;
      timeline = collectListeningEvents(map);
      previousTime = time;
      return { snapshot: lookupListeningSnapshot(map, time), events: [] };
    },
  };
}
