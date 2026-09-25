import type { MotionStudySample } from './motionStudyEvidence.ts';

export type MaterialMotionState = Readonly<{
  pressure: number;
  deformation: number;
  velocity: number;
  activity: number;
}>;

export const initialMaterialMotion: MaterialMotionState = {
  pressure: 0, deformation: 0, velocity: 0, activity: 0,
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Store pressure from retained evidence, then let the divider deform and recover with inertia. */
export function stepMaterialMotion(state: MaterialMotionState, sample: MotionStudySample, dt: number): MaterialMotionState {
  const sustained = sample.active ? clamp((sample.level - .12) / .5) : 0;
  const onset = sample.active ? clamp((sample.transient - .4) / .6) : 0;
  const beat = sample.active ? clamp((sample.beat - .35) / .65) : 0;
  const drive = clamp(sustained * .7 + onset * .4 + beat * .55);
  const steps = Math.max(1, Math.ceil(Math.max(0, dt) / (1 / 120)));
  const step = Math.min(.1, Math.max(0, dt)) / steps;
  let { pressure, deformation, velocity } = state;
  for (let index = 0; index < steps; index += 1) {
    pressure += (drive * .85 * (1 - pressure) - pressure * (drive > 0 ? .25 : .65)) * step;
    pressure = clamp(pressure);
    const target = Math.pow(clamp((pressure - .04) / .96), 1.3);
    velocity += ((target - deformation) * 16 - velocity * 7.2) * step;
    deformation += velocity * step;
  }
  if (drive === 0 && pressure < .001) pressure = 0;
  if (pressure === 0 && Math.abs(deformation) < .0005 && Math.abs(velocity) < .0005) {
    deformation = 0;
    velocity = 0;
  }
  return { pressure, deformation, velocity, activity: clamp(deformation) };
}
