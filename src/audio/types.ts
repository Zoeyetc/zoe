export type TransportState = Readonly<{
  time: number; // seconds
  duration: number; // seconds
  playing: boolean;
}>;

export type MusicalDomain = 'melody' | 'rhythm' | 'harmony' | 'structure' | 'spectrum';
export type MusicalCapabilities = Readonly<Record<MusicalDomain, boolean>>;

export type MelodyNote = Readonly<{
  id: string;
  start: number; // seconds, inclusive
  end: number; // seconds, exclusive
  midi: number;
  intensity: number; // 0..1
}>;

export type PercussionKind = 'kick' | 'snare' | 'hat';

export type PercussionHit = Readonly<{
  id: string;
  time: number;
  type: PercussionKind;
  strength: number;
}>;

export type RhythmSection = Readonly<{
  id: string;
  start: number;
  end: number;
  bpm: number;
  beatsPerBar: number;
  groove: number; // 0..1
  swing: number; // 0..1
}>;

export type HarmonyRegion = Readonly<{
  id: string;
  start: number;
  end: number;
  chord: string;
  rootPitchClass: number; // 0..11, C = 0
  pitchClasses: readonly number[];
  confidence: number; // 0..1
}>;

export type StructureRegion = Readonly<{
  id: string;
  start: number;
  end: number;
  section: string;
  energy: readonly [number, number];
  tension: readonly [number, number];
  build: readonly [number, number];
  phraseProgress: readonly [number, number];
}>;

export type StructuralDrop = Readonly<{
  id: string;
  time: number;
  strength: number;
}>;

export type SpectrumRegion = Readonly<{
  id: string;
  start: number;
  end: number;
  low: readonly [number, number];
  mid: readonly [number, number];
  high: readonly [number, number];
  brightness: readonly [number, number];
  texture: readonly [number, number];
}>;

/** Serializable prepared data; no analysis or actor state belongs here. */
export type AudioMap = Readonly<{
  version: 1;
  id: string;
  duration: number;
  capabilities: MusicalCapabilities;
  melody: readonly MelodyNote[] | null; // null = unavailable; [] = available silence
  percussion: readonly PercussionHit[] | null; // null = unavailable; [] = available silence
  rhythm: readonly RhythmSection[] | null;
  harmony: readonly HarmonyRegion[] | null;
  structure: readonly StructureRegion[] | null;
  drops: readonly StructuralDrop[] | null;
  spectrum: readonly SpectrumRegion[] | null;
}>;

export type AudioSnapshot = Readonly<{
  mapId: string;
  transport: TransportState;
  capabilities: MusicalCapabilities;
  melody: Readonly<{
    available: boolean;
    active: boolean;
    activeNote: MelodyNote | null;
    noteProgress: number;
  }>;
  percussion: Readonly<{
    available: boolean;
  }>;
  rhythm: Readonly<{
    available: boolean;
    bpm: number | null;
    beatPhase: number;
    barPhase: number;
    groove: number;
    swing: number;
  }>;
  harmony: Readonly<{
    available: boolean;
    active: boolean;
    chord: string | null;
    rootPitchClass: number | null;
    pitchClasses: readonly number[];
    confidence: number;
  }>;
  structure: Readonly<{
    available: boolean;
    section: string | null;
    sectionProgress: number;
    energy: number;
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
  }>;
}>;

export type AudioEvent =
  | Readonly<{ type: 'note-on' | 'note-off'; time: number; note: MelodyNote }>
  | Readonly<{ type: PercussionKind; time: number; id: string; strength: number }>
  | Readonly<{ type: 'chord-change'; time: number; harmony: HarmonyRegion | null }>
  | Readonly<{ type: 'drop'; time: number; id: string; strength: number }>
  | Readonly<{ type: 'seek'; from: number; to: number }>;

export type AudioFrame = Readonly<{
  snapshot: AudioSnapshot;
  events: readonly AudioEvent[];
}>;
