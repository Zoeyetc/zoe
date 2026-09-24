export type MelodySource = 'midi' | 'isolated-stem' | 'predominant-analysis' | 'authored' | 'unavailable';

export type MelodyNote = Readonly<{
  id: string;
  start: number; // seconds, inclusive
  end: number; // seconds, exclusive
  midi: number;
  pitchHz?: number;
  noteName?: string;
  intensity: number; // 0..1
  confidence?: number; // 0..1; authored notes may omit analysis confidence
  source?: MelodySource;
}>;

export type ScaleDegree = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Derived tonal relation. Absolute note fields remain the authoritative evidence. */
export type ScaleDegreeEvidence = Readonly<{
  available: boolean;
  inScale: boolean;
  degree: ScaleDegree | null;
  displayDegree: string | null;
  tonicPitchClass: number | null;
  mode: TonalMode | null;
  absoluteMidi: number | null;
  absoluteNoteName: string | null;
  relativeSemitones: number | null;
  referenceTonicMidi: number | null;
  octaveRelation: number | null;
  chromaticOffset: number | null;
  confidence: number;
}>;

export type TonalMode = 'major' | 'minor';

export type TonalCenterSegment = Readonly<{
  id: string;
  start: number;
  end: number;
  rootPitchClass: number;
  mode: TonalMode;
  label: string;
  confidence: number;
  circleOfFifthsIndex: number;
  distanceFromPrevious: number | null;
}>;
