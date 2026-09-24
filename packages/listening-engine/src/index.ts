export { hzToMidi, midiToNoteName } from './pitch.ts';
export type {
  MelodySource,
  MelodyNote,
  ScaleDegree,
  ScaleDegreeEvidence,
  TonalMode,
  TonalCenterSegment,
  MusicalDomain,
  MusicalCapabilities,
  MelodyPitchFrame,
  MelodyAnalysis,
  PercussionKind,
  PercussionDescriptors,
  PercussionHit,
  PercussionAnalysis,
  RhythmSection,
  TempoCandidate,
  BeatMarker,
  RhythmAnalysis,
  HarmonyRegion,
  ChordCandidateSummary,
  ChromaFrame,
  ChordSegment,
  HarmonyAnalysis,
  TonalCenterCandidate,
  TonalCenterFrame,
  TonalCenterAnalysis,
  StructureAnalysisFrame,
  StructureBoundary,
  ArrangementChange,
  StructureSegment,
  StructureAnalysis,
  SpectrumRegion,
  AudioAmplitudeRegion,
  AudioAnalysisMetadata,
  ListeningMap,
} from './types.ts';
export * from './melody-evidence/types.ts';

export * from './scaleDegree.ts';
export { MELODY_ANALYSIS, analyzeMelody, analyzeMelodyWithEvidence } from './analysis/MelodyAnalysis.ts';
export type { MelodyAnalysisInput, MelodyAnalysisWithEvidence } from './analysis/MelodyAnalysis.ts';
export * from './analysis/HarmonyAnalysis.ts';
export * from './analysis/RhythmAnalysis.ts';
export * from './analysis/PercussionAnalysis.ts';
export * from './analysis/TonalCenterAnalysis.ts';
export * from './analysis/StructureAnalysis.ts';
export * from './analysis/AudioAnalysis.ts';
export * from './melody-evidence/compactTimeline.ts';
export * from './melody-evidence/selectMelodyEvidence.ts';
export { collectListeningEvents, createListeningTimeline, lookupListeningSnapshot } from './ListeningTimeline.ts';
export type { ListeningEventCollectionOptions, ListeningTimeline } from './ListeningTimeline.ts';
export type { ListeningEvent, ListeningFrame, ListeningMapIdentity, ListeningSnapshot } from './listeningTimelineTypes.ts';
