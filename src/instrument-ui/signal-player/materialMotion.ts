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

/** Persistent accepted evidence loads the material; isolated impulses only make small deposits. */
export function materialEvidenceDrive(sample: MotionStudySample) {
  if (!sample.active) return 0;
  const acceptedPersistence = clamp(sample.melodySupport * .38 + sample.bassSupport * .3
    + sample.harmonySupport * .14 + sample.tonalSupport * .1 + sample.level * .55);
  const impulse = Math.max(sample.transient, sample.notePulse, sample.percussionPulse, sample.beat);
  return clamp(acceptedPersistence * .86 + impulse * .34);
}

/** Store pressure from retained evidence, then let the divider deform and recover with inertia. */
export function stepMaterialMotion(state: MaterialMotionState, sample: MotionStudySample, dt: number): MaterialMotionState {
  const drive = materialEvidenceDrive(sample);
  const steps = Math.max(1, Math.ceil(Math.max(0, dt) / (1 / 120)));
  const step = Math.min(.1, Math.max(0, dt)) / steps;
  let { pressure, deformation, velocity } = state;
  for (let index = 0; index < steps; index += 1) {
    pressure += (drive * .72 * (1 - pressure) - pressure * (drive > .04 ? .2 : .48)) * step;
    pressure = clamp(pressure);
    const target = Math.pow(clamp((pressure - .04) / .96), 1.3);
    velocity += ((target - deformation) * 13 - velocity * 6.1) * step;
    deformation += velocity * step;
  }
  if (drive === 0 && pressure < .001) pressure = 0;
  if (pressure === 0 && Math.abs(deformation) < .0005 && Math.abs(velocity) < .0005) {
    deformation = 0;
    velocity = 0;
  }
  return { pressure, deformation, velocity, activity: clamp(deformation) };
}
