import type { MotionStudySample } from './motionStudyEvidence.ts';

export type ObservatoryAssessment = Readonly<{
  key: string | null;
  support: number;
  ambiguity: number;
  breadth: number;
  abstained: boolean;
  eligible: boolean;
}>;

export type ObservatoryMotionState = Readonly<{
  confirmed: boolean;
  confirmedKey: string | null;
  candidateKey: string | null;
  candidateSeconds: number;
  support: number;
  transitionFrom: number;
  transitionTarget: number;
  transitionSeconds: number;
  activity: number;
}>;

export const initialObservatoryMotion: ObservatoryMotionState = {
  confirmed: false,
  confirmedKey: null,
  candidateKey: null,
  candidateSeconds: 0,
  support: 0,
  transitionFrom: 0,
  transitionTarget: 0,
  transitionSeconds: 0,
  activity: 0,
};

const confirmationSeconds = 1.5;
const withdrawalSeconds = .6;
const transitionDuration = 1.1;
const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Candidate support and competition are observed without promoting scores into false confidence. */
export function assessObservatoryEvidence(sample: MotionStudySample): ObservatoryAssessment {
  if (!sample.active) return { key: null, support: 0, ambiguity: 0, breadth: 0, abstained: false, eligible: false };
  const supported = [
    sample.melodyIdentity ? sample.melodySupport : null,
    sample.bassIdentity ? sample.bassSupport : null,
    sample.harmonyIdentity ? sample.harmonySupport : null,
    sample.tonalIdentity ? sample.tonalSupport : null,
  ].filter((value): value is number => value !== null);
  const competing = [
    sample.melodyIdentity ? sample.melodyCompetition : null,
    sample.bassIdentity ? sample.bassCompetition : null,
    sample.harmonyIdentity ? sample.harmonyCompetition : null,
    sample.tonalIdentity ? sample.tonalCompetition : null,
  ].filter((value): value is number => value !== null);
  const breadth = clamp(supported.length / 3);
  const meanSupport = supported.length
    ? supported.reduce((total, value) => total + value, 0) / supported.length : 0;
  const support = clamp(meanSupport * (.72 + breadth * .28));
  const ambiguity = competing.length ? Math.max(...competing) : 0;
  const abstained = sample.melodyAbstained || sample.bassAbstained;
  const eligible = sample.interpretationKey !== null && support >= .5 && ambiguity <= .55 && !abstained;
  return { key: eligible ? sample.interpretationKey : null, support, ambiguity, breadth, abstained, eligible };
}

/** A decision must retain the same identity and support before one stable response is admitted. */
export function stepObservatoryMotion(state: ObservatoryMotionState, sample: MotionStudySample,
  dt: number): ObservatoryMotionState {
  const elapsed = Math.min(.1, Math.max(0, dt));
  const assessment = assessObservatoryEvidence(sample);
  const candidateKey = assessment.eligible ? assessment.key : null;
  const alreadyConfirmed = candidateKey === state.confirmedKey;
  let candidateSeconds = alreadyConfirmed ? 0
    : candidateKey === state.candidateKey ? state.candidateSeconds + elapsed : elapsed;
  let confirmedKey = state.confirmedKey;
  let support = state.support;
  let transitionFrom = state.transitionFrom;
  let transitionTarget = state.transitionTarget;
  let transitionSeconds = state.transitionSeconds;
  const requiredSeconds = candidateKey === null ? withdrawalSeconds : confirmationSeconds;
  if (!alreadyConfirmed && candidateSeconds + 1e-9 >= requiredSeconds) {
    confirmedKey = candidateKey;
    support = candidateKey === null ? 0 : assessment.support;
    candidateSeconds = 0;
    transitionFrom = state.activity;
    transitionTarget = candidateKey === null ? 0 : clamp(.24 + support * .48);
    transitionSeconds = 0;
  } else if (alreadyConfirmed && candidateKey !== null) {
    support = assessment.support;
  }
  if (state.activity !== transitionTarget || transitionSeconds > 0) {
    transitionSeconds = Math.min(transitionDuration, transitionSeconds + elapsed);
  }
  const progress = clamp(transitionSeconds / transitionDuration);
  const eased = progress * progress * (3 - 2 * progress);
  const activity = progress === 1
    ? transitionTarget : transitionFrom + (transitionTarget - transitionFrom) * eased;
  return {
    confirmed: confirmedKey !== null,
    confirmedKey,
    candidateKey,
    candidateSeconds,
    support,
    transitionFrom,
    transitionTarget,
    transitionSeconds,
    activity,
  };
}
