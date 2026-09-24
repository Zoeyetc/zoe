import { decodeNormalizedEvidence, MELODY_CANDIDATE_SEARCH_MODE_CODE, MELODY_EVIDENCE_REASON_CODE,
  MELODY_GENERATION_OUTCOME_CODE,
  readCompactMelodyEvidenceStorage } from './compactTimeline.ts';
import type {
  MelodyCandidateGenerationOutcome, MelodyCandidateSearchMode, MelodyEvidenceObservation,
  MelodyEvidenceTimeline, MelodyFrameDecisionReason, ObservedPitchEvidence,
} from './types';
import { hzToMidi, midiToNoteName } from '../pitch.ts';

const REASON_BY_CODE = Object.fromEntries(Object.entries(MELODY_EVIDENCE_REASON_CODE)
  .map(([reason, code]) => [code, reason])) as Record<number, MelodyFrameDecisionReason>;
const GENERATION_OUTCOME_BY_CODE = Object.fromEntries(Object.entries(MELODY_GENERATION_OUTCOME_CODE)
  .map(([outcome, code]) => [code, outcome])) as Record<number, MelodyCandidateGenerationOutcome>;
const SEARCH_MODE_BY_CODE = Object.fromEntries(Object.entries(MELODY_CANDIDATE_SEARCH_MODE_CODE)
  .map(([mode, code]) => [code, mode])) as Record<number, MelodyCandidateSearchMode>;

const NO_OBSERVED_PITCH: ObservedPitchEvidence = Object.freeze({
  frequencyHz: null,
  midi: null,
  noteName: null,
  score: null,
  source: 'NONE',
  melodyRangeStatus: 'UNAVAILABLE',
  rangeReason: null,
});

/** Selects raw pitch evidence before path, frame-confidence, note, or track interpretation.
 * Candidate and rejected arrays are both score-descending and retain their strongest item. */
export function selectObservedPitchEvidence(evidence: Pick<MelodyEvidenceObservation,
  'candidates' | 'rejectedCandidates'>): ObservedPitchEvidence {
  const usable = evidence.candidates[0];
  const rejected = evidence.rejectedCandidates[0];
  if (!usable && !rejected) return NO_OBSERVED_PITCH;
  if (!rejected || (usable && usable.score >= rejected.score)) {
    return Object.freeze({
      frequencyHz: usable!.pitchHz,
      midi: usable!.midiFloat,
      noteName: usable!.noteName,
      score: usable!.score,
      source: 'USABLE_CANDIDATE',
      melodyRangeStatus: 'IN_RANGE',
      rangeReason: null,
    });
  }
  const midi = hzToMidi(rejected.frequencyHz);
  return Object.freeze({
    frequencyHz: rejected.frequencyHz,
    midi,
    noteName: midiToNoteName(Math.round(midi)),
    score: rejected.score,
    source: 'RANGE_REJECTED',
    melodyRangeStatus: rejected.reason === 'BELOW_PITCH_RANGE'
      ? 'BELOW_MELODY_RANGE' : 'ABOVE_MELODY_RANGE',
    rangeReason: rejected.reason,
  });
}

export function melodyEvidenceIndexAt(timeline: MelodyEvidenceTimeline, time: number, ended = false) {
  if (!timeline.frameCount) return -1;
  if (ended) return timeline.frameCount - 1;
  const { frameTimes } = readCompactMelodyEvidenceStorage(timeline);
  let low = 0;
  let high = frameTimes.length - 1;
  let result = -1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (frameTimes[middle] <= time) { result = middle; low = middle + 1; } else high = middle - 1;
  }
  return Math.max(0, result);
}

export function selectMelodyEvidence(
  timeline: MelodyEvidenceTimeline | null | undefined,
  time: number,
  ended = false,
): MelodyEvidenceObservation | null {
  if (!timeline?.frameCount) return null;
  const frameIndex = melodyEvidenceIndexAt(timeline, time, ended);
  const storage = readCompactMelodyEvidenceStorage(timeline);
  const from = storage.candidateOffsets[frameIndex];
  const to = storage.candidateOffsets[frameIndex + 1];
  const candidates = Object.freeze(Array.from({ length: to - from }, (_, offset) => {
    const index = from + offset;
    const pitchHz = storage.candidatePitchHz[index];
    const midiFloat = 69 + 12 * Math.log2(pitchHz / 440);
    return Object.freeze({ rank: offset + 1, pitchHz, midiFloat, noteName: midiToNoteName(Math.round(midiFloat)),
      periodicity: decodeNormalizedEvidence(storage.candidatePeriodicity[index]),
      salience: decodeNormalizedEvidence(storage.candidateSalience[index]),
      score: decodeNormalizedEvidence(storage.candidateScore[index]) });
  }));
  const selectedCandidateIndex = storage.selectedCandidateIndexes[frameIndex];
  const selected = selectedCandidateIndex < 0 ? null : candidates[selectedCandidateIndex] ?? null;
  const rejectedFrom = storage.rejectedCandidateOffsets[frameIndex];
  const rejectedTo = storage.rejectedCandidateOffsets[frameIndex + 1];
  const rejectedCandidates = Object.freeze(Array.from({ length: rejectedTo - rejectedFrom }, (_, offset) => {
    const index = rejectedFrom + offset;
    return Object.freeze({
      rank: offset + 1,
      frequencyHz: storage.rejectedCandidateFrequencyHz[index],
      periodicity: decodeNormalizedEvidence(storage.rejectedCandidatePeriodicity[index]),
      salience: decodeNormalizedEvidence(storage.rejectedCandidateSalience[index]),
      score: decodeNormalizedEvidence(storage.rejectedCandidateScore[index]),
      reason: storage.rejectedCandidateReasonCodes[index] === 0
        ? 'BELOW_PITCH_RANGE' as const : 'ABOVE_PITCH_RANGE' as const,
    });
  }));
  const observedPitch = selectObservedPitchEvidence({ candidates, rejectedCandidates });
  const finalPitchHz = storage.finalPitchHz[frameIndex];
  const derivedFinalMidi = Number.isFinite(finalPitchHz) ? 69 + 12 * Math.log2(finalPitchHz / 440) : null;
  const reason = REASON_BY_CODE[storage.reasonCodes[frameIndex]];
  return Object.freeze({
    frameIndex,
    time: storage.frameTimes[frameIndex],
    rms: storage.frameRms[frameIndex],
    candidates,
    generation: Object.freeze({
      attempted: storage.generationOutcomeCodes[frameIndex]
        !== MELODY_GENERATION_OUTCOME_CODE.NOT_ATTEMPTED_RMS_GATE,
      outcome: GENERATION_OUTCOME_BY_CODE[storage.generationOutcomeCodes[frameIndex]],
      searchMode: SEARCH_MODE_BY_CODE[storage.candidateSearchModeCodes[frameIndex]],
      localMinimumCount: storage.localMinimumCounts[frameIndex],
      rawCandidateCount: storage.rawCandidateCounts[frameIndex],
      inRangeCandidateCountBeforeDeduplication:
        storage.inRangeCandidateCountsBeforeDeduplication[frameIndex],
      duplicateCandidateRemovalCount: storage.duplicateCandidateRemovalCounts[frameIndex],
    }),
    outOfRangeCandidateCount: storage.outOfRangeCandidateCounts[frameIndex],
    rejectedCandidates,
    observedPitch,
    selectedCandidateIndex: selectedCandidateIndex < 0 ? null : selectedCandidateIndex,
    selectedPitchHz: selected?.pitchHz ?? null,
    selectedMidiFloat: selected?.midiFloat ?? null,
    finalPitchHz: Number.isFinite(finalPitchHz) ? finalPitchHz : null,
    finalMidiFloat: derivedFinalMidi,
    finalConfidence: storage.finalConfidence[frameIndex],
    finalSalience: storage.finalSalience[frameIndex],
    voiced: storage.voiced[frameIndex] === 1,
    stage: reason === 'LOW_RMS' ? 'input' : reason === 'NO_USABLE_CANDIDATE' ? 'candidate'
      : reason === 'PATH_SELECTED_NULL' ? 'path' : 'frame',
    reason,
  });
}

export function selectMelodyEvidenceForTransport(
  timeline: MelodyEvidenceTimeline | null | undefined,
  transport: Readonly<{ time: number; duration: number }>,
) {
  const tolerance = Math.max(1e-6, Math.min(1e-3, Math.abs(transport.duration) * 1e-6));
  return selectMelodyEvidence(timeline, transport.time, transport.time >= transport.duration - tolerance);
}
