import type { MotionStudySample } from './motionStudyEvidence.ts';

export type MaterialMotionState = Readonly<{ pressure: number; activity: number }>;

export const initialMaterialMotion: MaterialMotionState = { pressure: 0, activity: 0 };

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Accumulate repeated or sustained retained evidence; an isolated weak event stays below expression. */
export function stepMaterialMotion(state: MaterialMotionState, sample: MotionStudySample, dt: number): MaterialMotionState {
  const sustained = sample.active ? clamp((sample.level - .12) / .5) : 0;
  const onset = sample.active ? clamp((sample.transient - .4) / .6) : 0;
  const beat = sample.active ? clamp((sample.beat - .35) / .65) : 0;
  const drive = clamp(sustained * .7 + onset * .4 + beat * .55);
  const steps = Math.max(1, Math.ceil(Math.max(0, dt) / (1 / 120)));
  const step = Math.min(.1, Math.max(0, dt)) / steps;
  let pressure = state.pressure;
  for (let index = 0; index < steps; index += 1) {
    pressure += (drive * .85 * (1 - pressure) - pressure * (drive > 0 ? .25 : .8)) * step;
    pressure = clamp(pressure);
  }
  if (drive === 0 && pressure < .001) pressure = 0;
  const activity = Math.pow(clamp((pressure - .03) / .97), 1.2);
  return { pressure, activity };
}
