import type { MotionStudySample } from './motionStudyEvidence.ts';

/** Presentation state for Instrument's divider tension. The evidence target is read-only. */
export type InstrumentMotionState = Readonly<{
  heldTarget: number;
  tension: number;
  activity: number;
  velocity: number;
}>;

export const initialInstrumentMotion: InstrumentMotionState = {
  heldTarget: 0, tension: 0, activity: 0, velocity: 0,
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Present accepted paths and current events act directly; uncertainty never fabricates a result. */
export function instrumentEvidenceTarget(sample: MotionStudySample) {
  if (!sample.active) return 0;
  const accepted = Math.max(sample.melodySupport, sample.bassSupport);
  const event = Math.max(sample.transient, sample.notePulse, sample.percussionPulse, sample.beat * .8);
  const current = clamp(sample.level * .18 + accepted * .72
    + Math.max(sample.harmonySupport, sample.tonalSupport) * .1);
  return clamp(Math.max(current, event * .9));
}

/** Ignore sub-perceptual target changes, then ease tension through a damped spring. */
export function stepInstrumentMotion(state: InstrumentMotionState, target: number, dt: number): InstrumentMotionState {
  const heldTarget = target === 0 ? 0
    : Math.abs(target - state.heldTarget) >= .018 ? target : state.heldTarget;
  let { tension, activity, velocity } = state;
  const steps = Math.max(1, Math.ceil(Math.max(0, dt) / (1 / 120)));
  const step = Math.min(.1, Math.max(0, dt)) / steps;
  for (let index = 0; index < steps; index += 1) {
    const tensionSeconds = heldTarget > tension ? .045 : .11;
    tension += (heldTarget - tension) * (1 - Math.exp(-step / tensionSeconds));
    velocity += ((tension - activity) * 144 - velocity * 22) * step;
    activity += velocity * step;
  }
  if (Math.abs(activity - heldTarget) < .0003 && Math.abs(velocity) < .0003) {
    activity = heldTarget;
    velocity = 0;
    tension = heldTarget;
  }
  return { heldTarget, tension, activity: clamp(activity), velocity };
}
