import type { MelodyEvidenceTimeline } from './melody-evidence/types';

export type TransportState = Readonly<{
  time: number; // seconds
  duration: number; // seconds
  playing: boolean;
}>;

export type MusicalDomain = 'melody' | 'rhythm' | 'percussion' | 'harmony' | 'tonalCenter' | 'structure' | 'spectrum';
export type MusicalCapabilities = Readonly<Record<MusicalDomain, boolean>>;

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

export type MelodyPitchFrame = Readonly<{
  time: number;
  voiced: boolean;
  pitchHz: number | null;
  midiFloat: number | null;
  confidence: number;
  salience: number;
}>;

export type MelodyAnalysis = Readonly<{
  version: 1;
  available: boolean;
  confidence: number;
  voicedFrameRatio: number;
  pitchRange: Readonly<{ minHz: 80; maxHz: 1400; minMidi: number | null; maxMidi: number | null }>;
  contour: readonly MelodyPitchFrame[];
  notes: readonly MelodyNote[];
  medianNoteConfidence: number;
  octaveCorrectionCount: number;
  rejectedLowConfidenceFrameCount: number;
  rejectedShortNoteCount: number;
  metadata: Readonly<{
    analysisSampleRate: 12000;
    frameSize: 2048;
    hopSize: 192;
    voicingThreshold: 0.56;
    minimumNoteDuration: 0.08;
    maximumMergeGap: 0.064;
    availabilityThreshold: 0.58;
  }>;
}>;

export type PercussionKind = 'kick' | 'snare' | 'closed-hat' | 'open-hat' | 'tom' | 'other-percussion';

export type PercussionDescriptors = Readonly<{
  subRatio: number; lowMidRatio: number; midRatio: number; highRatio: number; airRatio: number;
  centroid: number; spread: number; flatness: number; duration: number; decay: number;
  onsetStrength: number; highPersistence: number; lowPersistence: number; rms: number;
}>;

export type PercussionHit = Readonly<{
  id: string;
  time: number;
  type: PercussionKind;
  strength: number; // physical intensity candidate, 0..1
  confidence?: number;
  topScore?: number;
  secondScore?: number;
  margin?: number;
  descriptors?: PercussionDescriptors;
}>;

export type PercussionAnalysis = Readonly<{
  version: 1;
  available: boolean;
  confidence: number;
  candidateCount: number;
  acceptedEventCount: number;
  eventDensity: number;
  classCounts: Readonly<Record<PercussionKind, number>>;
  events: readonly PercussionHit[];
  metadata: Readonly<{
    preprocessing: 'positive-spectral-difference-shared-stft';
    frameSize: 2048; hopSize: 1024;
    bandsHz: Readonly<{ sub: readonly [20, 160]; lowMid: readonly [160, 600]; mid: readonly [600, 2500]; high: readonly [2500, number]; air: readonly [number, number] }>;
    descriptorNormalization: 'unit-energy-ratios-and-nyquist-normalized-moments';
    classifier: 'deterministic-rule-scores-v1';
    onsetThreshold: number; confidenceThreshold: number; capabilityThreshold: number;
    refractorySeconds: Readonly<Record<PercussionKind, number>>;
  }>;
}>;

export type RhythmSection = Readonly<{
  id: string;
  start: number;
  end: number;
  bpm: number;
  beatsPerBar: number | null;
  groove: number; // 0..1
  swing: number; // 0..1
}>;

export type TempoCandidate = Readonly<{
  bpm: number;
  score: number; // 0..1 normalized periodicity
  familyBpm: number;
  fullBandPeriodicity: number;
  lowBandPeriodicity: number;
  subdivisionSupport: number;
  energyPulseSupport: number;
  gridSupport: number;
  ambiguityPenalty: number;
}>;

export type BeatMarker = Readonly<{
  id: string;
  index: number;
  time: number;
  strength: number; // generic onset support, 0..1
}>;

export type RhythmAnalysis = Readonly<{
  version: 1;
  searchBpm: readonly [60, 200];
  available: boolean;
  bpm: number | null;
  confidence: number;
  beatInterval: number | null;
  beats: readonly BeatMarker[];
  beatsPerBar: null; // meter/downbeat analysis is deliberately deferred
  groove: number;
  swing: number;
  swingConfidence: number;
  tempoCandidates: readonly TempoCandidate[];
  evidence: Readonly<{
    fullBandPeakCount: number;
    lowBandPeakCount: number;
    highBandPeakCount: number;
    lowBandSupport: number;
    subdivisionSupport: number;
    energyPulseSupport: number;
    gridSupport: number;
    tempoFamilyMargin: number;
    pulseConsistency: number;
  }>;
}>;

export type HarmonyRegion = Readonly<{
  id: string;
  start: number;
  end: number;
  chord: string;
  rootPitchClass: number; // 0..11, C = 0
  quality?: 'major' | 'minor'; // authored fixtures may omit the explicit quality field
  pitchClasses: readonly number[];
  confidence: number; // 0..1
}>;

export type ChordCandidateSummary = Readonly<{
  label: string;
  rootPitchClass: number;
  quality: 'major' | 'minor';
  pitchClasses: readonly number[];
  score: number;
}>;

export type ChromaFrame = Readonly<{
  time: number;
  chroma: readonly number[];
  energy: number;
  confidence: number;
  chord: ChordCandidateSummary | null;
  topCandidate: ChordCandidateSummary | null;
  secondCandidate: ChordCandidateSummary | null;
  scoreMargin: number;
}>;

export type ChordSegment = HarmonyRegion & Readonly<{
  quality: 'major' | 'minor';
}>;

export type HarmonyAnalysis = Readonly<{
  version: 1;
  available: boolean;
  confidence: number;
  noChordRatio: number;
  averageSegmentDuration: number;
  frames: readonly ChromaFrame[];
  segments: readonly ChordSegment[];
  metadata: Readonly<{
    analysisSampleRate: 12000;
    frameSize: 4096;
    hopSize: 1024;
    frequencyRange: readonly [80, 5000];
    chordVocabulary: '12-major-12-minor-triads';
    normalization: 'log-compressed-peak-weighted-l1-chroma';
    smoothing: 'three-frame-island-removal-and-minimum-segment';
    minimumSegmentDuration: 0.24;
    frameConfidenceThreshold: 0.52;
    availabilityThreshold: 0.6;
  }>;
}>;

export type TonalMode = 'major' | 'minor';

export type TonalCenterCandidate = Readonly<{
  label: string;
  rootPitchClass: number;
  mode: TonalMode;
  score: number;
  profileScore: number;
  tonicSupport: number;
  chordSupport: number;
}>;

export type TonalCenterFrame = Readonly<{
  time: number;
  rootPitchClass: number | null;
  mode: TonalMode | null;
  label: string | null;
  confidence: number;
  topCandidate: TonalCenterCandidate | null;
  secondCandidate: TonalCenterCandidate | null;
  topScore: number;
  secondScore: number;
  margin: number;
  usableCoverage: number;
}>;

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

export type TonalCenterAnalysis = Readonly<{
  version: 1;
  available: boolean;
  confidence: number;
  globalTonalCenter: TonalCenterCandidate | null;
  averageSegmentDuration: number;
  frames: readonly TonalCenterFrame[];
  segments: readonly TonalCenterSegment[];
  metadata: Readonly<{
    sourceChroma: 'harmony-analysis-normalized-chroma';
    windowSize: 8;
    hopSize: 2;
    majorProfile: readonly number[];
    minorProfile: readonly number[];
    similarity: 'cosine';
    smoothing: 'non-causal-dynamic-programming-plus-minimum-segment';
    minimumSegmentDuration: 4;
    minimumUsableDuration: 2;
    availabilityThreshold: 0.56;
    switchPenalty: 0.11;
  }>;
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

export type StructureAnalysisFrame = Readonly<{
  id: string;
  start: number;
  end: number;
  vector: readonly number[];
  energy: number;
  onsetDensity: number;
}>;

export type StructureBoundary = Readonly<{
  id: string;
  time: number;
  frameIndex: number;
  novelty: number;
  confidence: number;
  sectionScore: number;
  shortNovelty: number;
  mediumNovelty: number;
  longNovelty: number;
  gridAlignmentBonus: number;
}>;

export type ArrangementChange = Readonly<{
  id: string;
  time: number;
  frameIndex: number;
  confidence: number;
  magnitude: number;
  featureContributions: Readonly<{
    brightness: number;
    texture: number;
    highBand: number;
    onsetDensity: number;
    energy: number;
  }>;
}>;

export type StructureSegment = Readonly<{
  id: string;
  start: number;
  end: number;
  label: string;
  recurrenceGroup: string;
  confidence: number;
  energy: number;
  contrast: number;
  importance: number;
  startBoundaryConfidence: number;
}>;

export type StructureAnalysis = Readonly<{
  version: 1;
  available: boolean;
  trackConfidence: number;
  aggregationMode: 'beat-synchronous' | 'time-fallback';
  frames: readonly StructureAnalysisFrame[];
  selfSimilarity: Readonly<{ size: number; values: Float32Array }>;
  novelty: readonly number[];
  noveltyScales: Readonly<{
    short: readonly number[];
    medium: readonly number[];
    long: readonly number[];
  }>;
  arrangementChanges: readonly ArrangementChange[];
  boundaries: readonly StructureBoundary[];
  segments: readonly StructureSegment[];
  recurrenceGroupCount: number;
  averageSegmentDuration: number;
  metadata: Readonly<{
    featureDimensions: readonly string[];
    normalization: 'per-dimension-z-score-clamped-3-then-l2';
    similarity: 'cosine-mapped-0-1';
    noveltyKernelRadii: readonly [number, number, number];
    minimumBoundarySeparation: 4;
    minimumArrangementSpacing: 2;
    minimumSectionDuration: 8;
    strongBoundaryMinimumSectionDuration: 4;
    boundarySnapMaximumBins: 1;
    beatBlockSizes: readonly [8, 16, 32];
    coreFeatureDimensions: readonly string[];
    arrangementFeatureDimensions: readonly string[];
    tempoAwareScaleTerminology: 'beat-count-blocks-not-meter';
    boundaryScoreFormula: string;
    arrangementScoreFormula: string;
    fallbackWindowDuration: 1;
    recurrenceThreshold: 0.82;
    exactRecurrenceThreshold: 0.94;
    capabilityThreshold: 0.48;
    maximumFrameCount: 384;
  }>;
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

export type AudioAmplitudeRegion = Readonly<{
  id: string;
  start: number;
  end: number;
  rms: readonly [number, number];
  peak: readonly [number, number];
  onsetStrength: readonly [number, number];
}>;

export type AudioSourceMetadata = Readonly<{
  kind: 'fixture' | 'real-audio';
  filename: string | null;
  mimeType: string | null;
}>;

export type AudioAnalysisMetadata = Readonly<{
  version: 1;
  sampleRate: number;
  channelCount: number;
  frameSize: number;
  hopSize: number;
  fftSize: number;
  analyzedDuration: number;
  downmix: 'arithmetic-mean';
  bandsHz: Readonly<{ low: readonly [20, 250]; mid: readonly [250, 4000]; high: readonly [4000, number] }>;
  normalization: Readonly<{
    strategy: 'p95-reference';
    rmsReference: number;
    bandReference: number;
    textureReference: number;
  }>;
}>;

/** Serializable prepared data; no analysis or actor state belongs here. */
export type AudioMap = Readonly<{
  version: 1;
  id: string;
  duration: number;
  capabilities: MusicalCapabilities;
  melody: readonly MelodyNote[] | null; // null = unavailable; [] = available silence
  melodyAnalysis?: MelodyAnalysis | null;
  melodyEvidence?: MelodyEvidenceTimeline | null;
  percussion: readonly PercussionHit[] | null; // null = unavailable; [] = available silence
  percussionAnalysis?: PercussionAnalysis | null;
  rhythm: readonly RhythmSection[] | null;
  rhythmAnalysis?: RhythmAnalysis | null;
  harmony: readonly HarmonyRegion[] | null;
  harmonyAnalysis?: HarmonyAnalysis | null;
  tonalCenterAnalysis?: TonalCenterAnalysis | null;
  structureAnalysis?: StructureAnalysis | null;
  structure: readonly StructureRegion[] | null;
  drops: readonly StructuralDrop[] | null;
  spectrum: readonly SpectrumRegion[] | null;
  amplitude?: readonly AudioAmplitudeRegion[] | null;
  source?: AudioSourceMetadata;
  analysis?: AudioAnalysisMetadata;
}>;

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
