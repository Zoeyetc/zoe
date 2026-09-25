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

/** Ignore sub-perceptual target changes, then ease tension through a damped spring. */
export function stepInstrumentMotion(state: InstrumentMotionState, target: number, dt: number): InstrumentMotionState {
  const heldTarget = target === 0 ? 0
    : Math.abs(target - state.heldTarget) >= .018 ? target : state.heldTarget;
  let { tension, activity, velocity } = state;
  const steps = Math.max(1, Math.ceil(Math.max(0, dt) / (1 / 120)));
  const step = Math.min(.1, Math.max(0, dt)) / steps;
  for (let index = 0; index < steps; index += 1) {
    tension += (heldTarget - tension) * (1 - Math.exp(-step / .16));
    velocity += ((tension - activity) * 81 - velocity * 15.3) * step;
    activity += velocity * step;
  }
  if (Math.abs(activity - heldTarget) < .0003 && Math.abs(velocity) < .0003) {
    activity = heldTarget;
    velocity = 0;
    tension = heldTarget;
  }
  return { heldTarget, tension, activity: Math.min(1, Math.max(0, activity)), velocity };
}
