import type { TonalMode } from '../../audio/types';
import type { FerrisWheelInput } from './adapter';
import {
  FERRIS_BOARDING_ANGLE,
  FERRIS_CABIN_COUNT,
  FERRIS_FIFTHS_PITCH_CLASSES,
  FERRIS_TAU,
  fifthsIndexForPitchClass,
  nearestContinuousTonicTarget,
} from './circleOfFifths.ts';

export type FerrisCabinState = Readonly<{
  /** Stable physical slot in circle-of-fifths order. */
  id: number;
  /** Canonical musical identity, C = 0 through B = 11. */
  pitchClass: number;
  active: boolean;
  emphasis: number;
  emphasisVelocity: number;
  swingAngle: number;
  swingVelocity: number;
  /** Cabin orientation relative to gravity; wheel rotation is intentionally excluded. */
  worldOrientation: number;
}>;

export type FerrisWheelState = Readonly<{
  status: 'milestone-nine-d-two';
  mode: 'resting' | 'active' | 'settling';
  reducedMotion: boolean;
  wheelAngle: number;
  targetWheelAngle: number;
  wheelAngularVelocity: number;
  wheelAngularAcceleration: number;
  wheelDrive: number;
  targetError: number;
  settling: boolean;
  chord: string | null;
  rootPitchClass: number | null;
  confidence: number;
  tonalCenterLabel: string | null;
  tonalRootPitchClass: number | null;
  tonalMode: TonalMode | null;
  tonalConfidence: number;
  tonicCabinId: number | null;
  targetFifthsIndex: number | null;
  activeCabinIds: readonly number[];
  cabins: readonly FerrisCabinState[];
  latestChordChange: string | null;
  latestTonalCenterChange: string | null;
}>;

export type FerrisWheelOptions = Readonly<{
  reducedMotion?: boolean;
  initialAngle?: number;
}>;

export const FERRIS_INITIAL_ANGLE = FERRIS_BOARDING_ANGLE;
export const FERRIS_MAX_WHEEL_SPEED = 0.28;
export const FERRIS_MAX_WHEEL_ACCELERATION = 0.34;
export const FERRIS_MAX_CABIN_SWING = 4 * Math.PI / 180;
export const FERRIS_TONAL_CONFIDENCE_THRESHOLD = 0.56;
const ROTATIONAL_STIFFNESS = 0.38;
const ROTATIONAL_DAMPING = 1.18;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => clamp(value, 0, 1);
const makeCabins = (): FerrisCabinState[] => FERRIS_FIFTHS_PITCH_CLASSES.map((pitchClass, id) => ({
  id, pitchClass, active: false, emphasis: 0, emphasisVelocity: 0,
  swingAngle: 0, swingVelocity: 0, worldOrientation: 0,
}));

/** Actor-local tonal orientation spring and acceleration-driven suspended-cabin springs. */
export function createFerrisWheelSimulation(options: FerrisWheelOptions = {}) {
  const reducedMotion = options.reducedMotion ?? false;
  const initialAngle = options.initialAngle ?? FERRIS_INITIAL_ANGLE;
  let state: FerrisWheelState;

  const reset = () => {
    state = {
      status: 'milestone-nine-d-two', mode: 'resting', reducedMotion,
      wheelAngle: initialAngle, targetWheelAngle: initialAngle,
      wheelAngularVelocity: 0, wheelAngularAcceleration: 0, wheelDrive: 0,
      targetError: 0, settling: false,
      chord: null, rootPitchClass: null, confidence: 0,
      tonalCenterLabel: null, tonalRootPitchClass: null, tonalMode: null, tonalConfidence: 0,
      tonicCabinId: null, targetFifthsIndex: null,
      activeCabinIds: [], cabins: makeCabins(),
      latestChordChange: null, latestTonalCenterChange: null,
    };
  };
  reset();

  return {
    read: (): FerrisWheelState => state,
    reset,
    accept(input: FerrisWheelInput, dt: number) {
      if (input.restart) reset();
      const harmonyActive = input.harmonyAvailable && input.chord !== null;
      const activePitchClasses = new Set(harmonyActive ? input.pitchClasses : []);
      const confidence = harmonyActive ? clamp01(input.confidence) : 0;
      const tonalValid = input.tonalCenterAvailable
        && input.tonicPitchClass !== null
        && input.tonalConfidence >= FERRIS_TONAL_CONFIDENCE_THRESHOLD;

      let targetWheelAngle = state.targetWheelAngle;
      let tonicCabinId = state.tonicCabinId;
      let targetFifthsIndex = state.targetFifthsIndex;
      const targetChanged = tonalValid && (
        input.tonicPitchClass !== state.tonicCabinId || input.seek || input.restart
      );
      if (targetChanged && input.tonicPitchClass !== null) {
        tonicCabinId = input.tonicPitchClass;
        targetFifthsIndex = fifthsIndexForPitchClass(input.tonicPitchClass);
        targetWheelAngle = nearestContinuousTonicTarget(state.wheelAngle, input.tonicPitchClass);
      }

      const boundedDt = Math.min(0.1, Math.max(0, Number.isFinite(dt) ? dt : 0));
      const steps = Math.max(1, Math.ceil(boundedDt * 120));
      const h = boundedDt / steps;
      let wheelAngle = state.wheelAngle;
      let wheelAngularVelocity = state.wheelAngularVelocity;
      let wheelAngularAcceleration = h > 0 ? 0 : state.wheelAngularAcceleration;
      let cabins = state.cabins.map(cabin => ({ ...cabin }));

      if (input.seek) {
        cabins = cabins.map(cabin => ({
          ...cabin,
          active: activePitchClasses.has(cabin.pitchClass),
          emphasis: activePitchClasses.has(cabin.pitchClass) ? confidence : 0,
          emphasisVelocity: 0,
        }));
      }

      for (let step = 0; step < steps && h > 0; step += 1) {
        const previousVelocity = wheelAngularVelocity;
        if (reducedMotion) {
          wheelAngularAcceleration = 0;
          wheelAngularVelocity = 0;
        } else {
          const targetError = targetWheelAngle - wheelAngle;
          wheelAngularAcceleration = clamp(
            targetError * ROTATIONAL_STIFFNESS - wheelAngularVelocity * ROTATIONAL_DAMPING,
            -FERRIS_MAX_WHEEL_ACCELERATION,
            FERRIS_MAX_WHEEL_ACCELERATION,
          );
          wheelAngularVelocity = clamp(
            wheelAngularVelocity + wheelAngularAcceleration * h,
            -FERRIS_MAX_WHEEL_SPEED,
            FERRIS_MAX_WHEEL_SPEED,
          );
          wheelAngle += (previousVelocity + wheelAngularVelocity) * 0.5 * h;
        }

        cabins = cabins.map(cabin => {
          const active = activePitchClasses.has(cabin.pitchClass);
          const emphasisTarget = active ? confidence : 0;
          let emphasisVelocity = cabin.emphasisVelocity
            + ((emphasisTarget - cabin.emphasis) * 18 - cabin.emphasisVelocity * 7) * h;
          let emphasis = clamp01(cabin.emphasis + emphasisVelocity * h);
          let swingAngle = cabin.swingAngle;
          let swingVelocity = cabin.swingVelocity;
          if (reducedMotion) {
            swingAngle = 0;
            swingVelocity = 0;
            emphasis = emphasisTarget * 0.72;
            emphasisVelocity = 0;
          } else {
            const phase = cabin.id * 2.399963229728653;
            const theta = wheelAngle + cabin.id * FERRIS_TAU / FERRIS_CABIN_COUNT;
            const spring = 7.2 + 0.6 * Math.sin(phase);
            const damping = 3.5 * (1 + 0.1 * Math.cos(phase));
            const response = FERRIS_MAX_CABIN_SWING * 48 * (0.9 + 0.12 * Math.cos(phase + 0.5));
            const force = -wheelAngularAcceleration * Math.sin(theta) * response;
            swingVelocity += (-spring * swingAngle - damping * swingVelocity + force) * h;
            swingAngle += swingVelocity * h;
            if (Math.abs(swingAngle) > FERRIS_MAX_CABIN_SWING) {
              swingAngle = Math.sign(swingAngle) * FERRIS_MAX_CABIN_SWING;
              if (swingAngle * swingVelocity > 0) swingVelocity = 0;
            }
            if (Math.abs(wheelAngularAcceleration) < 1e-6
              && Math.abs(swingAngle) < 2e-5 && Math.abs(swingVelocity) < 2e-5) {
              swingAngle = 0;
              swingVelocity = 0;
            }
          }
          return {
            ...cabin, active, emphasis, emphasisVelocity,
            swingAngle, swingVelocity, worldOrientation: swingAngle,
          };
        });
      }

      const targetError = targetWheelAngle - wheelAngle;
      const settling = !reducedMotion && (
        Math.abs(targetError) > 0.002
        || Math.abs(wheelAngularVelocity) > 0.002
        || cabins.some(cabin => Math.abs(cabin.swingAngle) + Math.abs(cabin.swingVelocity) > 0.001)
      );
      state = {
        ...state,
        mode: harmonyActive && input.transportPlaying ? 'active' : settling ? 'settling' : 'resting',
        wheelAngle,
        targetWheelAngle,
        wheelAngularVelocity,
        wheelAngularAcceleration,
        wheelDrive: targetError,
        targetError,
        settling,
        chord: harmonyActive ? input.chord : null,
        rootPitchClass: harmonyActive ? input.rootPitchClass : null,
        confidence,
        tonalCenterLabel: input.tonalCenterLabel,
        tonalRootPitchClass: input.tonicPitchClass,
        tonalMode: input.tonalMode,
        tonalConfidence: clamp01(input.tonalConfidence),
        tonicCabinId,
        targetFifthsIndex,
        activeCabinIds: [...activePitchClasses].sort((a, b) => a - b),
        cabins,
        latestChordChange: input.chordChange
          ? input.chordChange.harmony?.chord ?? 'inactive'
          : state.latestChordChange,
        latestTonalCenterChange: input.tonalCenterChange
          ? input.tonalCenterChange.tonalCenter.label
          : state.latestTonalCenterChange,
      };
    },
  };
}
