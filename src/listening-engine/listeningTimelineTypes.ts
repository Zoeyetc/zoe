import type {
  HarmonyRegion, MelodyNote, MelodySource, MusicalCapabilities, PercussionHit, PercussionKind,
  ScaleDegreeEvidence, StructureSegment, TonalCenterSegment, TonalMode,
} from './types.ts';

export type ListeningSnapshot = Readonly<{
  capabilities: MusicalCapabilities;
  melody: Readonly<{ available: boolean; active: boolean; source: MelodySource; activeNote: MelodyNote | null;
    noteProgress: number; midi: number | null; pitchHz: number | null; noteName: string | null;
    intensity: number; confidence: number; scaleDegree: ScaleDegreeEvidence }>;
  percussion: Readonly<{ available: boolean; activity: number; confidence: number }>;
  rhythm: Readonly<{ available: boolean; bpm: number | null; confidence: number; beatIndex: number | null;
    beatInterval: number | null; nearestBeatTime: number | null; beatPhase: number; beatInBar: number | null;
    barIndex: number | null; barPhase: number; groove: number; swing: number; swingConfidence: number }>;
  harmony: Readonly<{ available: boolean; active: boolean; chord: string | null; rootPitchClass: number | null;
    pitchClasses: readonly number[]; confidence: number }>;
  tonalCenter: Readonly<{ available: boolean; rootPitchClass: number | null; mode: TonalMode | null;
    label: string | null; confidence: number; segmentProgress: number; circleOfFifthsIndex: number | null;
    distanceFromPrevious: number | null; segmentId: string | null }>;
  structure: Readonly<{ available: boolean; segmentId: string | null; section: string | null;
    label: string | null; recurrenceGroup: string | null; segmentStart: number | null; segmentEnd: number | null;
    sectionProgress: number; confidence: number; energy: number; contrast: number; importance: number;
    novelty: number; previousBoundaryTime: number | null; nextBoundaryTime: number | null;
    previousBoundaryConfidence: number | null; nextBoundaryConfidence: number | null }>;
  spectrum: Readonly<{ available: boolean; low: number; mid: number; high: number; brightness: number;
    texture: number; rms: number; peak: number; onsetStrength: number }>;
}>;

export type ListeningEvent =
  | Readonly<{ type: 'note-on' | 'note-off'; time: number; note: MelodyNote }>
  | Readonly<{ type: PercussionKind; time: number; id: string; strength: number; confidence: number; hit: PercussionHit }>
  | Readonly<{ type: 'beat'; time: number; id: string; index: number; strength: number }>
  | Readonly<{ type: 'chord-change'; time: number; harmony: HarmonyRegion | null }>
  | Readonly<{ type: 'tonal-center-change'; time: number; tonalCenter: TonalCenterSegment }>
  | Readonly<{ type: 'section-change'; time: number; structure: StructureSegment }>;

export type ListeningFrame = Readonly<{ snapshot: ListeningSnapshot; events: readonly ListeningEvent[] }>;
export type ListeningMapIdentity = string | number | symbol;
