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

/** Serializable prepared data; no analysis or actor state belongs here. */
export type AudioMap = Readonly<{
  version: 1;
  id: string;
  duration: number;
  capabilities: MusicalCapabilities;
  melody: readonly MelodyNote[] | null; // null = unavailable; [] = available silence
  percussion: readonly PercussionHit[] | null; // null = unavailable; [] = available silence
  rhythm: readonly RhythmSection[] | null;
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
}>;

export type AudioEvent =
  | Readonly<{ type: 'note-on' | 'note-off'; time: number; note: MelodyNote }>
  | Readonly<{ type: PercussionKind; time: number; id: string; strength: number }>
  | Readonly<{ type: 'seek'; from: number; to: number }>;

export type AudioFrame = Readonly<{
  snapshot: AudioSnapshot;
  events: readonly AudioEvent[];
}>;
