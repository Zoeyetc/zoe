import type {
  HarmonyRegion,
  ListeningMap,
  MelodyNote,
  MelodySource,
  MusicalCapabilities,
  PercussionHit,
  PercussionKind,
  ScaleDegreeEvidence,
  StructureSegment,
  TonalCenterSegment,
  TonalMode,
} from '@computational-listening/engine';
import type { AudioMapHostMetadata } from './host/AudioMapHostMetadata.ts';
import type { ZlandAuthoredOverlay } from './zland/ZlandAuthoredOverlay.ts';

export type * from '@computational-listening/engine';
export type { AudioSourceMetadata } from '@computational-listening/audio-source-browser';
export type { AudioMapHostMetadata } from './host/AudioMapHostMetadata.ts';
export type {
  StructuralDrop,
  StructureRegion,
  ZlandAuthoredOverlay,
} from './zland/ZlandAuthoredOverlay.ts';

export type TransportState = Readonly<{
  time: number; // seconds
  duration: number; // seconds
  playing: boolean;
}>;

/**
 * Temporary migration composition. Delete after root AudioMap consumers move to
 * explicit ListeningMap, ZlandAuthoredOverlay, and host/source contracts.
 */
export type AudioMap = ListeningMap & ZlandAuthoredOverlay & AudioMapHostMetadata;

export type AudioSnapshot = Readonly<{
  mapId: string;
  transport: TransportState;
  capabilities: MusicalCapabilities;
  melody: Readonly<{
    available: boolean;
    active: boolean;
    source: MelodySource;
    activeNote: MelodyNote | null;
    noteProgress: number;
    midi: number | null;
    pitchHz: number | null;
    noteName: string | null;
    intensity: number;
    confidence: number;
    scaleDegree: ScaleDegreeEvidence;
  }>;
  percussion: Readonly<{
    available: boolean;
    activity: number;
    confidence: number;
  }>;
  rhythm: Readonly<{
    available: boolean;
    bpm: number | null;
    confidence: number;
    beatIndex: number | null;
    beatInterval: number | null;
    nearestBeatTime: number | null;
    beatPhase: number;
    beatInBar: number | null;
    barIndex: number | null;
    barPhase: number;
    groove: number;
    swing: number;
    swingConfidence: number;
  }>;
  harmony: Readonly<{
    available: boolean;
    active: boolean;
    chord: string | null;
    rootPitchClass: number | null;
    pitchClasses: readonly number[];
    confidence: number;
  }>;
  tonalCenter: Readonly<{
    available: boolean;
    rootPitchClass: number | null;
    mode: TonalMode | null;
    label: string | null;
    confidence: number;
    segmentProgress: number;
    circleOfFifthsIndex: number | null;
    distanceFromPrevious: number | null;
    segmentId: string | null;
  }>;
  structure: Readonly<{
    source: 'authored' | 'analysis' | null;
    available: boolean;
    segmentId: string | null;
    section: string | null;
    label: string | null;
    recurrenceGroup: string | null;
    segmentStart: number | null;
    segmentEnd: number | null;
    sectionProgress: number;
    confidence: number;
    energy: number;
    contrast: number;
    importance: number;
    novelty: number;
    previousBoundaryTime: number | null;
    nextBoundaryTime: number | null;
    previousBoundaryConfidence: number | null;
    nextBoundaryConfidence: number | null;
    tension: number;
    build: number;
    phraseProgress: number;
  }>;
  spectrum: Readonly<{
    available: boolean;
    low: number;
    mid: number;
    high: number;
    brightness: number;
    texture: number;
    rms: number;
    peak: number;
    onsetStrength: number;
  }>;
}>;

export type AudioEvent =
  | Readonly<{ type: 'note-on' | 'note-off'; time: number; note: MelodyNote }>
  | Readonly<{ type: PercussionKind; time: number; id: string; strength: number; confidence: number; hit: PercussionHit }>
  | Readonly<{ type: 'beat'; time: number; id: string; index: number; strength: number }>
  | Readonly<{ type: 'chord-change'; time: number; harmony: HarmonyRegion | null }>
  | Readonly<{ type: 'tonal-center-change'; time: number; tonalCenter: TonalCenterSegment }>
  | Readonly<{ type: 'section-change'; time: number; structure: StructureSegment }>
  | Readonly<{ type: 'drop'; time: number; id: string; strength: number }>
  | Readonly<{ type: 'seek'; from: number; to: number }>;

export type AudioFrame = Readonly<{
  snapshot: AudioSnapshot;
  events: readonly AudioEvent[];
}>;
