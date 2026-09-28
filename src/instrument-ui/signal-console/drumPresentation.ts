import type {
  DrumClassifierEvidence, DrumEvidence, DrumEvidenceAttempt, DrumHypothesis,
} from '@zoeyetc/computational-listening-engine';

export type DrumPresentationState = 'SELECTED' | 'ABSTAINED' | 'REJECTED'
  | 'NO_EVENT' | 'UNAVAILABLE' | 'NO_CURRENT_ATTEMPT';

export type DrumPresentation = Readonly<{
  state: DrumPresentationState;
  reason: string;
  experimental: boolean;
  calibration: 'UNCALIBRATED';
  analyzedWindow: Readonly<{ start: number; end: number }>;
  trackCapability: 'AVAILABLE' | 'UNAVAILABLE';
  attempt: DrumEvidenceAttempt | null;
  selectedClass: string | null;
  physicalEventStrength: number | null;
  classifierEvidence: DrumClassifierEvidence | null;
  hypotheses: readonly DrumHypothesis[];
  ambiguityReasons: readonly string[];
}>;

function attemptAt(attempts: readonly DrumEvidenceAttempt[], time: number, ended: boolean) {
  if (!attempts.length) return null;
  if (ended) return attempts.at(-1) ?? null;
  let low = 0;
  let high = attempts.length - 1;
  let result = -1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if ((attempts[middle]?.time ?? Infinity) <= time) {
      result = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  return result < 0 ? null : attempts[result] ?? null;
}

export function selectDrumPresentation(evidence: DrumEvidence | null | undefined,
  time: number, ended = false): DrumPresentation {
  const base = {
    experimental: evidence?.experimental ?? true,
    calibration: evidence?.calibration ?? 'UNCALIBRATED' as const,
    analyzedWindow: evidence?.analyzedWindow ?? { start: 0, end: 0 },
    trackCapability: evidence?.trackCapability ?? 'UNAVAILABLE' as const,
  };
  if (!evidence || evidence.status === 'UNAVAILABLE') return {
    ...base, state: 'UNAVAILABLE', reason: evidence?.reason ?? 'ANALYSIS_NOT_RUN', attempt: null,
    selectedClass: null, physicalEventStrength: null, classifierEvidence: null, hypotheses: [],
    ambiguityReasons: [],
  };
  if (evidence.status === 'NO_EVENT') return {
    ...base, state: 'NO_EVENT', reason: evidence.reason, attempt: null,
    selectedClass: null, physicalEventStrength: null, classifierEvidence: null, hypotheses: [],
    ambiguityReasons: [],
  };
  const attempt = attemptAt(evidence.attempts, time, ended);
  if (!attempt) return {
    ...base, state: 'NO_CURRENT_ATTEMPT', reason: 'AWAITING_PERCUSSIVE_OPPORTUNITY', attempt: null,
    selectedClass: null, physicalEventStrength: null, classifierEvidence: null, hypotheses: [],
    ambiguityReasons: [],
  };
  const decision = attempt.decision;
  const classifierEvidence = 'classifierEvidence' in decision ? decision.classifierEvidence : null;
  return {
    ...base,
    state: decision.state,
    reason: decision.reason,
    attempt,
    selectedClass: decision.state === 'SELECTED' ? decision.selectedClass : null,
    physicalEventStrength: decision.state === 'SELECTED' || (decision.state === 'ABSTAINED'
      && decision.reason === 'AMBIGUOUS_CLASS_EVIDENCE') ? decision.physicalEventStrength : null,
    classifierEvidence,
    hypotheses: classifierEvidence?.hypotheses ?? [],
    ambiguityReasons: decision.state === 'ABSTAINED' && decision.reason === 'AMBIGUOUS_CLASS_EVIDENCE'
      ? decision.ambiguityReasons : [],
  };
}
