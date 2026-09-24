export const FERRIS_CABIN_COUNT = 12;
export const FERRIS_TAU = Math.PI * 2;
export const FERRIS_FIFTH_STEP = FERRIS_TAU / FERRIS_CABIN_COUNT;

/** Physical clockwise cabin order. Pitch-class identity remains canonical (C = 0). */
export const FERRIS_FIFTHS_PITCH_CLASSES = Object.freeze([
  0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5,
] as const);

export const FERRIS_BOARDING_ANGLE = Math.PI / 2;

const canonicalPitchClass = (pitchClass: number) => ((pitchClass % 12) + 12) % 12;

export function pitchClassAtFifthsIndex(index: number): number {
  return FERRIS_FIFTHS_PITCH_CLASSES[((index % 12) + 12) % 12];
}

export function fifthsIndexForPitchClass(pitchClass: number): number {
  const index = FERRIS_FIFTHS_PITCH_CLASSES.indexOf(
    canonicalPitchClass(pitchClass) as typeof FERRIS_FIFTHS_PITCH_CLASSES[number],
  );
  if (index < 0) throw new RangeError(`Invalid pitch class: ${pitchClass}`);
  return index;
}

/** Canonical wheel angle that places the requested tonic cabin at the bottom. */
export function canonicalTonicTargetAngle(pitchClass: number): number {
  return FERRIS_BOARDING_ANGLE - fifthsIndexForPitchClass(pitchClass) * FERRIS_FIFTH_STEP;
}

/** Signed shortest angular delta. Exact half-turns deterministically move positive. */
export function shortestSignedAngularDelta(from: number, to: number): number {
  let delta = ((to - from + Math.PI) % FERRIS_TAU + FERRIS_TAU) % FERRIS_TAU - Math.PI;
  if (Math.abs(delta + Math.PI) < 1e-12) delta = Math.PI;
  return delta;
}

/** Nearest unwrapped equivalent of a canonical orientation to the current physical angle. */
export function nearestContinuousTonicTarget(currentAngle: number, pitchClass: number): number {
  return currentAngle + shortestSignedAngularDelta(currentAngle, canonicalTonicTargetAngle(pitchClass));
}
