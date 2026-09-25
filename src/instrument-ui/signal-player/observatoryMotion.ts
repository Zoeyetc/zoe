import { fieldAgreement } from './fieldMotion.ts';
import type { MotionStudySample } from './motionStudyEvidence.ts';

export type ObservatoryMotionState = Readonly<{
  confirmed: boolean;
  candidate: boolean;
  candidateSeconds: number;
  transitionFrom: number;
  transitionSeconds: number;
  activity: number;
}>;

export const initialObservatoryMotion: ObservatoryMotionState = {
  confirmed: false,
  candidate: false,
  candidateSeconds: 0,
  transitionFrom: 0,
  transitionSeconds: 0,
  activity: 0,
};

const confirmationSeconds = 1.5;
const transitionDuration = 1.1;
const confirmedActivity = .55;
const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Confirm a lasting agreement change, then move once to a stable presentation state. */
export function stepObservatoryMotion(state: ObservatoryMotionState, sample: MotionStudySample,
  dt: number): ObservatoryMotionState {
  const elapsed = Math.min(.1, Math.max(0, dt));
  const agreement = fieldAgreement(sample);
  const candidate = agreement >= (state.confirmed ? .06 : .1);
  let candidateSeconds = candidate === state.confirmed ? 0
    : candidate === state.candidate ? state.candidateSeconds + elapsed : elapsed;
  let confirmed = state.confirmed;
  let transitionFrom = state.transitionFrom;
  let transitionSeconds = state.transitionSeconds;
  if (candidate !== confirmed && candidateSeconds + 1e-9 >= confirmationSeconds) {
    confirmed = candidate;
    candidateSeconds = 0;
    transitionFrom = state.activity;
    transitionSeconds = 0;
  }
  const target = confirmed ? confirmedActivity : 0;
  if (state.activity !== target || transitionSeconds > 0) {
    transitionSeconds = Math.min(transitionDuration, transitionSeconds + elapsed);
  }
  const progress = clamp(transitionSeconds / transitionDuration);
  const eased = progress * progress * (3 - 2 * progress);
  const activity = progress === 1 ? target : transitionFrom + (target - transitionFrom) * eased;
  return { confirmed, candidate, candidateSeconds, transitionFrom, transitionSeconds, activity };
}
