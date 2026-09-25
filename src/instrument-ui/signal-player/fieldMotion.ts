import type { MotionStudySample } from './motionStudyEvidence.ts';

export type FieldMotionState = Readonly<{ confidence: number }>;

export const initialFieldMotion: FieldMotionState = { confidence: 0 };

/** Pairwise overlap: a strong observation needs another observation to support it. */
export function fieldAgreement(sample: MotionStudySample): number {
  if (!sample.active) return 0;
  const observations = [sample.level, sample.transient, sample.structureEnergy, sample.beat];
  let shared = 0;
  for (let first = 0; first < observations.length; first += 1) {
    for (let second = first + 1; second < observations.length; second += 1) {
      shared += Math.min(observations[first], observations[second]);
    }
  }
  const spread = Math.max(...observations) - Math.min(...observations);
  return shared / 6 * (1 - spread * .5);
}

/** Agreement coordinates all dividers; conflict only withdraws confidence. */
export function stepFieldMotion(state: FieldMotionState, sample: MotionStudySample, dt: number): FieldMotionState {
  const agreement = fieldAgreement(sample);
  const seconds = agreement > state.confidence ? .28 : .4;
  let confidence = state.confidence + (agreement - state.confidence)
    * (1 - Math.exp(-Math.max(0, Math.min(.1, dt)) / seconds));
  if (agreement === 0 && confidence < .0005) confidence = 0;
  return { confidence };
}
