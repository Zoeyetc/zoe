/** Product modes; disabling motion is a separate setting. */
export enum MotionMode {
  Instrument = 'instrument',
  Material = 'material',
  Field = 'field',
  Observatory = 'observatory',
}

export const MOTION_MODES: readonly MotionMode[] = [
  MotionMode.Instrument, MotionMode.Material, MotionMode.Field, MotionMode.Observatory,
];

export const MOTION_MODE_NAMES: Readonly<Record<MotionMode, string>> = {
  [MotionMode.Instrument]: 'Instrument',
  [MotionMode.Material]: 'Material',
  [MotionMode.Field]: 'Field',
  [MotionMode.Observatory]: 'Observatory',
};
