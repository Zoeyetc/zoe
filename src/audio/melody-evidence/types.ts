export type MelodyEvidenceStage = 'input' | 'candidate' | 'path' | 'frame' | 'note' | 'track';

export type MelodyFrameDecisionReason =
  | 'LOW_RMS'
  | 'NO_USABLE_CANDIDATE'
  | 'PATH_SELECTED_NULL'
  | 'LOW_CONFIDENCE'
  | 'VOICED'
  | 'MERGED_GAP';

export type MelodyTrackDecisionReason =
  | 'ACCEPTED'
  | 'TRACK_LOW_CONFIDENCE'
  | 'TRACK_LOW_USABLE_DURATION'
  | 'TRACK_LOW_VOICED_RATIO'
  | 'TRACK_NO_NOTES';
export type MelodyNoteDecisionReason = 'SHORT_NOTE';
export type MelodyRejectedCandidateReason = 'BELOW_PITCH_RANGE' | 'ABOVE_PITCH_RANGE';

export type MelodyCandidateGenerationOutcome =
  | 'NOT_ATTEMPTED_RMS_GATE'
  | 'ATTEMPTED_NO_RAW_CANDIDATE'
  | 'RAW_CANDIDATES_ALL_RANGE_REJECTED'
  | 'USABLE_CANDIDATES_SURVIVED';

export type MelodyCandidateSearchMode =
  | 'NOT_RUN'
  | 'LOCAL_MINIMA'
  | 'GLOBAL_MINIMUM_FALLBACK';

export type MelodyCandidateGenerationEvidence = Readonly<{
  attempted: boolean;
  outcome: MelodyCandidateGenerationOutcome;
  searchMode: MelodyCandidateSearchMode;
  localMinimumCount: number;
  rawCandidateCount: number;
  inRangeCandidateCountBeforeDeduplication: number;
  duplicateCandidateRemovalCount: number;
}>;

export const MELODY_REJECTED_CANDIDATE_CAP = 3;

export type MelodyEvidenceThresholds = Readonly<{
  minimumRms: number;
  minimumHz: number;
  maximumHz: number;
  voicingConfidence: number;
  trackConfidence: number;
  minimumUsableDuration: number;
  minimumVoicedFrameRatio: number;
  minimumNoteDuration: number;
}>;

export type MelodyEvidenceCandidate = Readonly<{
  rank: number;
  pitchHz: number;
  midiFloat: number;
  noteName: string;
  periodicity: number;
  salience: number;
  score: number;
}>;

export type MelodyRejectedCandidate = Readonly<{
  rank: number;
  frequencyHz: number;
  periodicity: number;
  salience: number;
  score: number;
  reason: MelodyRejectedCandidateReason;
}>;

export type MelodyEvidenceObservation = Readonly<{
  frameIndex: number;
  time: number;
  rms: number;
  candidates: readonly MelodyEvidenceCandidate[];
  generation: MelodyCandidateGenerationEvidence;
  outOfRangeCandidateCount: number;
  rejectedCandidates: readonly MelodyRejectedCandidate[];
  selectedCandidateIndex: number | null;
  selectedPitchHz: number | null;
  selectedMidiFloat: number | null;
  finalPitchHz: number | null;
  finalMidiFloat: number | null;
  finalConfidence: number;
  finalSalience: number;
  voiced: boolean;
  stage: MelodyEvidenceStage;
  reason: MelodyFrameDecisionReason;
}>;

export type MelodyEvidenceTrackDecision = Readonly<{
  available: boolean;
  confidence: number;
  voicedFrameRatio: number;
  usableDuration: number;
  noteCountBeforeTrackGate: number;
  acceptedNoteCount: number;
  rejectedShortNoteCount: number;
  noteReasons: readonly MelodyNoteDecisionReason[];
  reasons: readonly MelodyTrackDecisionReason[];
}>;

/**
 * Compact retained evidence. Storage is private to the melody-evidence module;
 * consumers receive only immutable observations selected at transport time.
 */
export type MelodyEvidenceTimeline = Readonly<{
  version: 1;
  frameCount: number;
  candidateCount: number;
  retainedRejectedCandidateCount: number;
  rejectedCandidateCap: typeof MELODY_REJECTED_CANDIDATE_CAP;
  byteLength: number;
  channelProjection: 'arithmetic-mean';
  thresholds: MelodyEvidenceThresholds;
  track: MelodyEvidenceTrackDecision;
}>;

export type MelodyEvidenceBuildFrame = Readonly<{
  time: number;
  rms: number;
  candidates: readonly Readonly<{
    pitchHz: number;
    periodicity: number;
    salience: number;
    score: number;
  }>[];
  generation: MelodyCandidateGenerationEvidence;
  outOfRangeCandidateCount: number;
  rejectedCandidates: readonly Readonly<{
    frequencyHz: number;
    periodicity: number;
    salience: number;
    score: number;
    reason: MelodyRejectedCandidateReason;
  }>[];
  selectedCandidateIndex: number | null;
  finalPitchHz: number | null;
  finalConfidence: number;
  finalSalience: number;
  voiced: boolean;
  reason: MelodyFrameDecisionReason;
}>;
