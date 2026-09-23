import type {
  MelodyEvidenceBuildFrame, MelodyEvidenceThresholds, MelodyEvidenceTimeline, MelodyEvidenceTrackDecision,
  MelodyRejectedCandidate,
} from './types';
import { MELODY_REJECTED_CANDIDATE_CAP } from './types.ts';

export const MELODY_EVIDENCE_REASON_CODE = {
  LOW_RMS: 0,
  NO_USABLE_CANDIDATE: 1,
  PATH_SELECTED_NULL: 2,
  LOW_CONFIDENCE: 3,
  VOICED: 4,
  MERGED_GAP: 5,
} as const;

export const MELODY_GENERATION_OUTCOME_CODE = {
  NOT_ATTEMPTED_RMS_GATE: 0,
  ATTEMPTED_NO_RAW_CANDIDATE: 1,
  RAW_CANDIDATES_ALL_RANGE_REJECTED: 2,
  USABLE_CANDIDATES_SURVIVED: 3,
} as const;

export const MELODY_CANDIDATE_SEARCH_MODE_CODE = {
  NOT_RUN: 0,
  LOCAL_MINIMA: 1,
  GLOBAL_MINIMUM_FALLBACK: 2,
} as const;

export type CompactMelodyEvidenceStorage = Readonly<{
  frameTimes: Float32Array;
  frameRms: Float32Array;
  candidateOffsets: Uint32Array;
  candidatePitchHz: Float32Array;
  candidatePeriodicity: Uint16Array;
  candidateSalience: Uint16Array;
  candidateScore: Uint16Array;
  rejectedCandidateOffsets: Uint32Array;
  rejectedCandidateFrequencyHz: Float32Array;
  rejectedCandidatePeriodicity: Uint16Array;
  rejectedCandidateSalience: Uint16Array;
  rejectedCandidateScore: Uint16Array;
  rejectedCandidateReasonCodes: Uint8Array;
  generationOutcomeCodes: Uint8Array;
  candidateSearchModeCodes: Uint8Array;
  localMinimumCounts: Uint8Array;
  rawCandidateCounts: Uint8Array;
  inRangeCandidateCountsBeforeDeduplication: Uint8Array;
  duplicateCandidateRemovalCounts: Uint8Array;
  selectedCandidateIndexes: Int8Array;
  finalPitchHz: Float32Array;
  finalConfidence: Float32Array;
  finalSalience: Float32Array;
  outOfRangeCandidateCounts: Uint16Array;
  voiced: Uint8Array;
  reasonCodes: Uint8Array;
}>;

type StoredMelodyEvidenceTimeline = MelodyEvidenceTimeline & Readonly<{
  /** Internal compact payload; intentionally absent from the product-facing timeline type. */
  _compactStorage: CompactMelodyEvidenceStorage;
}>;
export const encodeNormalizedEvidence = (value: number) => Math.round(Math.min(1, Math.max(0, value)) * 65_535);
export const decodeNormalizedEvidence = (value: number) => value / 65_535;

/** Keeps only the strongest diagnostic rejects without changing the total rejection counter. */
export function retainMelodyRejectedCandidate(
  retained: readonly Omit<MelodyRejectedCandidate, 'rank'>[],
  candidate: Omit<MelodyRejectedCandidate, 'rank'>,
) {
  return [...retained, candidate]
    .sort((a, b) => b.score - a.score || a.frequencyHz - b.frequencyHz || a.reason.localeCompare(b.reason))
    .slice(0, MELODY_REJECTED_CANDIDATE_CAP);
}

const byteLength = (storage: CompactMelodyEvidenceStorage) => Object.values(storage)
  .reduce((sum, array) => sum + array.byteLength, 0);

export function createCompactMelodyEvidenceTimeline(
  frames: readonly MelodyEvidenceBuildFrame[],
  thresholds: MelodyEvidenceThresholds,
  track: MelodyEvidenceTrackDecision,
): MelodyEvidenceTimeline {
  const candidateCount = frames.reduce((sum, frame) => sum + frame.candidates.length, 0);
  const retainedRejectedCandidateCount = frames.reduce((sum, frame) => sum + frame.rejectedCandidates.length, 0);
  const storage: CompactMelodyEvidenceStorage = {
    frameTimes: new Float32Array(frames.length),
    frameRms: new Float32Array(frames.length),
    candidateOffsets: new Uint32Array(frames.length + 1),
    candidatePitchHz: new Float32Array(candidateCount),
    candidatePeriodicity: new Uint16Array(candidateCount),
    candidateSalience: new Uint16Array(candidateCount),
    candidateScore: new Uint16Array(candidateCount),
    rejectedCandidateOffsets: new Uint32Array(frames.length + 1),
    rejectedCandidateFrequencyHz: new Float32Array(retainedRejectedCandidateCount),
    rejectedCandidatePeriodicity: new Uint16Array(retainedRejectedCandidateCount),
    rejectedCandidateSalience: new Uint16Array(retainedRejectedCandidateCount),
    rejectedCandidateScore: new Uint16Array(retainedRejectedCandidateCount),
    rejectedCandidateReasonCodes: new Uint8Array(retainedRejectedCandidateCount),
    generationOutcomeCodes: new Uint8Array(frames.length),
    candidateSearchModeCodes: new Uint8Array(frames.length),
    localMinimumCounts: new Uint8Array(frames.length),
    rawCandidateCounts: new Uint8Array(frames.length),
    inRangeCandidateCountsBeforeDeduplication: new Uint8Array(frames.length),
    duplicateCandidateRemovalCounts: new Uint8Array(frames.length),
    selectedCandidateIndexes: new Int8Array(frames.length).fill(-1),
    finalPitchHz: new Float32Array(frames.length).fill(Number.NaN),
    finalConfidence: new Float32Array(frames.length),
    finalSalience: new Float32Array(frames.length),
    outOfRangeCandidateCounts: new Uint16Array(frames.length),
    voiced: new Uint8Array(frames.length),
    reasonCodes: new Uint8Array(frames.length),
  };
  let candidateOffset = 0;
  let rejectedCandidateOffset = 0;
  frames.forEach((frame, frameIndex) => {
    storage.frameTimes[frameIndex] = frame.time;
    storage.frameRms[frameIndex] = frame.rms;
    storage.candidateOffsets[frameIndex] = candidateOffset;
    frame.candidates.forEach(candidate => {
      storage.candidatePitchHz[candidateOffset] = candidate.pitchHz;
      storage.candidatePeriodicity[candidateOffset] = encodeNormalizedEvidence(candidate.periodicity);
      storage.candidateSalience[candidateOffset] = encodeNormalizedEvidence(candidate.salience);
      storage.candidateScore[candidateOffset] = encodeNormalizedEvidence(candidate.score);
      candidateOffset += 1;
    });
    storage.rejectedCandidateOffsets[frameIndex] = rejectedCandidateOffset;
    frame.rejectedCandidates.forEach(candidate => {
      storage.rejectedCandidateFrequencyHz[rejectedCandidateOffset] = candidate.frequencyHz;
      storage.rejectedCandidatePeriodicity[rejectedCandidateOffset] = encodeNormalizedEvidence(candidate.periodicity);
      storage.rejectedCandidateSalience[rejectedCandidateOffset] = encodeNormalizedEvidence(candidate.salience);
      storage.rejectedCandidateScore[rejectedCandidateOffset] = encodeNormalizedEvidence(candidate.score);
      storage.rejectedCandidateReasonCodes[rejectedCandidateOffset] = candidate.reason === 'BELOW_PITCH_RANGE' ? 0 : 1;
      rejectedCandidateOffset += 1;
    });
    storage.selectedCandidateIndexes[frameIndex] = frame.selectedCandidateIndex ?? -1;
    storage.generationOutcomeCodes[frameIndex] = MELODY_GENERATION_OUTCOME_CODE[frame.generation.outcome];
    storage.candidateSearchModeCodes[frameIndex] = MELODY_CANDIDATE_SEARCH_MODE_CODE[frame.generation.searchMode];
    storage.localMinimumCounts[frameIndex] = frame.generation.localMinimumCount;
    storage.rawCandidateCounts[frameIndex] = frame.generation.rawCandidateCount;
    storage.inRangeCandidateCountsBeforeDeduplication[frameIndex]
      = frame.generation.inRangeCandidateCountBeforeDeduplication;
    storage.duplicateCandidateRemovalCounts[frameIndex] = frame.generation.duplicateCandidateRemovalCount;
    storage.finalPitchHz[frameIndex] = frame.finalPitchHz ?? Number.NaN;
    storage.finalConfidence[frameIndex] = frame.finalConfidence;
    storage.finalSalience[frameIndex] = frame.finalSalience;
    storage.outOfRangeCandidateCounts[frameIndex] = frame.outOfRangeCandidateCount;
    storage.voiced[frameIndex] = frame.voiced ? 1 : 0;
    storage.reasonCodes[frameIndex] = MELODY_EVIDENCE_REASON_CODE[frame.reason];
  });
  storage.candidateOffsets[frames.length] = candidateOffset;
  storage.rejectedCandidateOffsets[frames.length] = rejectedCandidateOffset;
  const timeline: StoredMelodyEvidenceTimeline = Object.freeze({
    version: 1 as const,
    frameCount: frames.length,
    candidateCount,
    retainedRejectedCandidateCount,
    rejectedCandidateCap: MELODY_REJECTED_CANDIDATE_CAP,
    byteLength: byteLength(storage),
    channelProjection: 'arithmetic-mean' as const,
    thresholds: Object.freeze({ ...thresholds }),
    track: Object.freeze({ ...track, noteReasons: Object.freeze([...track.noteReasons]),
      reasons: Object.freeze([...track.reasons]) }),
    _compactStorage: storage,
  });
  return timeline;
}

export function readCompactMelodyEvidenceStorage(timeline: MelodyEvidenceTimeline) {
  const storage = (timeline as Partial<StoredMelodyEvidenceTimeline>)._compactStorage;
  if (!storage) throw new Error('Unknown Melody evidence timeline');
  return storage;
}
