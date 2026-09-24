import type { PirateShipInput } from './adapter';

export type PirateShipState = Readonly<{
  status: 'milestone-two-b';
  mode: 'resting' | 'active' | 'settling';
  reducedMotion: boolean;
  angle: number;
  angularVelocity: number;
  driveTorque: number;
  driveAmplitude: number;
  targetPhase: number;
  phaseError: number;
  bpm: number | null;
  beatPhase: number;
  barPhase: number;
  groove: number;
  swing: number;
}>;

export type PirateShipOptions = Readonly<{
  reducedMotion?: boolean;
  initialAngle?: number;
  initialAngularVelocity?: number;
}>;

export const PIRATE_MAX_ANGLE = Math.PI * 0.24;
export const PIRATE_MAX_ANGULAR_VELOCITY = 3.2;
const GRAVITY = 4.4;
const DAMPING = 0.48;
const DRIVE_LIMIT = 2.4;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => clamp(value, 0, 1);
const wrapSignedPhase = (value: number) => ((value + 0.5) % 1 + 1) % 1 - 0.5;

/** Swing changes the time division of the two half-beats while preserving phase continuity. */
export function warpBeatPhase(beatPhase: number, swing: number) {
  const phase = ((beatPhase % 1) + 1) % 1;
  const division = 0.5 + clamp01(swing) * 0.22;
  return phase < division
    ? 0.5 * phase / division
    : 0.5 + 0.5 * (phase - division) / (1 - division);
}

function physicalPhase(angle: number, angularVelocity: number) {
  const phase = Math.atan2(angle / PIRATE_MAX_ANGLE, angularVelocity / PIRATE_MAX_ANGULAR_VELOCITY) / (Math.PI * 2);
  return ((phase % 1) + 1) % 1;
}

/** Legacy-derived local pendulum: gravity, damping, bounded substeps, and a safety envelope. */
export function createPirateShipSimulation(options: PirateShipOptions = {}) {
  const reducedMotion = options.reducedMotion ?? false;
  const initialAngle = options.initialAngle ?? 0;
  const initialAngularVelocity = options.initialAngularVelocity ?? 0;
  let angle = initialAngle;
  let angularVelocity = initialAngularVelocity;
  let driveTorque = 0;
  let driveAmplitude = 0;
  let targetPhase = 0;
  let phaseError = 0;
  let musical: Pick<PirateShipState, 'bpm' | 'beatPhase' | 'barPhase' | 'groove' | 'swing'> = {
    bpm: null, beatPhase: 0, barPhase: 0, groove: 0, swing: 0,
  };
  let mode: PirateShipState['mode'] = 'resting';

  const reset = () => {
    angle = initialAngle;
    angularVelocity = initialAngularVelocity;
    driveTorque = 0;
    driveAmplitude = 0;
    targetPhase = 0;
    phaseError = 0;
    musical = { bpm: null, beatPhase: 0, barPhase: 0, groove: 0, swing: 0 };
    mode = 'resting';
  };
  const read = (): PirateShipState => ({
    status: 'milestone-two-b', mode, reducedMotion, angle, angularVelocity,
    driveTorque, driveAmplitude, targetPhase, phaseError, ...musical,
  });

  return {
    read,
    reset,
    accept(input: PirateShipInput, dt: number) {
      if (input.restart) reset();
      musical = {
        bpm: input.bpm,
        beatPhase: input.beatPhase,
        barPhase: input.barPhase,
        groove: clamp01(input.groove),
        swing: clamp01(input.swing),
      };
      const rhythmicDrive = input.rhythmAvailable && input.bpm !== null && input.transportPlaying;
      targetPhase = warpBeatPhase(input.beatPhase, input.swing);
      phaseError = wrapSignedPhase(targetPhase - physicalPhase(angle, angularVelocity));
      const motionScale = reducedMotion ? 0.08 : 1;
      const amplitudeTarget = rhythmicDrive
        ? (0.72 + clamp01(input.groove) * 0.68) * motionScale
        : 0;
      const waveform = Math.sin(targetPhase * Math.PI * 2)
        + clamp01(input.groove) * 0.22 * Math.sin(targetPhase * Math.PI * 4 + input.swing * 0.8);
      const torqueTarget = rhythmicDrive
        ? clamp(amplitudeTarget * waveform + phaseError * 0.45 * motionScale, -DRIVE_LIMIT, DRIVE_LIMIT)
        : 0;

      const boundedDt = Math.min(0.1, Math.max(0, dt));
      const steps = Math.max(1, Math.ceil(boundedDt * 240));
      const h = boundedDt / steps;
      for (let step = 0; step < steps; step += 1) {
        driveAmplitude += (amplitudeTarget - driveAmplitude) * (1 - Math.exp(-4 * h));
        driveTorque += (torqueTarget - driveTorque) * (1 - Math.exp(-7 * h));
        const acceleration = -GRAVITY * Math.sin(angle) - DAMPING * angularVelocity + driveTorque;
        angularVelocity = clamp(
          angularVelocity + acceleration * h,
          -PIRATE_MAX_ANGULAR_VELOCITY,
          PIRATE_MAX_ANGULAR_VELOCITY,
        );
        angle += angularVelocity * h;
        const angleLimit = reducedMotion ? PIRATE_MAX_ANGLE * 0.14 : PIRATE_MAX_ANGLE;
        if (Math.abs(angle) > angleLimit) {
          angle = Math.sign(angle) * angleLimit;
          if (angle * angularVelocity > 0) angularVelocity *= -0.18;
        }
        if (!rhythmicDrive && Math.abs(angle) < 0.00005 && Math.abs(angularVelocity) < 0.00005) {
          angle = 0;
          angularVelocity = 0;
        }
      }
      const moving = Math.abs(angle) + Math.abs(angularVelocity) > 0.002;
      mode = rhythmicDrive ? 'active' : moving ? 'settling' : 'resting';
    },
  };
}
