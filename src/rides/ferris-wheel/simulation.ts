import type { FerrisWheelInput } from './adapter';

export type FerrisCabinState = Readonly<{
  id: number;
  pitchClass: number;
  active: boolean;
  emphasis: number;
  emphasisVelocity: number;
  swingAngle: number;
  swingVelocity: number;
  /** Cabin renderer orientation relative to gravity; wheel angle is intentionally excluded. */
  worldOrientation: number;
}>;

export type FerrisWheelState = Readonly<{
  status: 'milestone-four-a';
  mode: 'resting' | 'active' | 'settling';
  reducedMotion: boolean;
  wheelAngle: number;
  wheelAngularVelocity: number;
  wheelDrive: number;
  chord: string | null;
  rootPitchClass: number | null;
  confidence: number;
  activeCabinIds: readonly number[];
  cabins: readonly FerrisCabinState[];
  latestChordChange: string | null;
}>;

export type FerrisWheelOptions = Readonly<{
  reducedMotion?: boolean;
  initialAngle?: number;
}>;

const TAU = Math.PI * 2;
const CABIN_COUNT = 12;
export const FERRIS_INITIAL_ANGLE = -Math.PI / 2 + Math.PI / 12;
export const FERRIS_MAX_WHEEL_SPEED = 0.14;
export const FERRIS_MAX_CABIN_SWING = 4 * Math.PI / 180;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => clamp(value, 0, 1);
const wrapAngle = (value: number) => ((value % TAU) + TAU) % TAU;
const makeCabins = (): FerrisCabinState[] => Array.from({ length: CABIN_COUNT }, (_, id) => ({
  id, pitchClass: id, active: false, emphasis: 0, emphasisVelocity: 0,
  swingAngle: 0, swingVelocity: 0, worldOrientation: 0,
}));

/** Legacy-derived wheel inertia and acceleration-driven independent suspended-cabin springs. */
export function createFerrisWheelSimulation(options: FerrisWheelOptions = {}) {
  const reducedMotion = options.reducedMotion ?? false;
  const initialAngle = options.initialAngle ?? FERRIS_INITIAL_ANGLE;
  let state: FerrisWheelState;

  const reset = () => {
    state = {
      status: 'milestone-four-a', mode: 'resting', reducedMotion,
      wheelAngle: initialAngle, wheelAngularVelocity: 0, wheelDrive: 0,
      chord: null, rootPitchClass: null, confidence: 0,
      activeCabinIds: [], cabins: makeCabins(), latestChordChange: null,
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
      const rootPitchClass = harmonyActive ? input.rootPitchClass : null;
      const driveTarget = harmonyActive && input.transportPlaying && !reducedMotion
        ? clamp(0.085 + confidence * 0.025 + (rootPitchClass ?? 0) / 11 * 0.012, 0, FERRIS_MAX_WHEEL_SPEED)
        : 0;
      const boundedDt = Math.min(0.1, Math.max(0, dt));
      const steps = Math.max(1, Math.ceil(boundedDt * 120));
      const h = boundedDt / steps;
      let wheelAngle = state.wheelAngle;
      let wheelAngularVelocity = state.wheelAngularVelocity;
      let cabins = state.cabins.map(cabin => ({ ...cabin }));

      if (input.seek) {
        cabins = cabins.map(cabin => ({
          ...cabin,
          active: activePitchClasses.has(cabin.pitchClass),
          emphasis: activePitchClasses.has(cabin.pitchClass) ? confidence : 0,
          emphasisVelocity: 0,
        }));
      }

      for (let step = 0; step < steps; step += 1) {
        const previousVelocity = wheelAngularVelocity;
        wheelAngularVelocity += (driveTarget - wheelAngularVelocity) * (1 - Math.exp(-1.45 * h));
        wheelAngularVelocity = clamp(wheelAngularVelocity, 0, FERRIS_MAX_WHEEL_SPEED);
        const wheelAcceleration = h > 0 ? (wheelAngularVelocity - previousVelocity) / h : 0;
        const angleDelta = (previousVelocity + wheelAngularVelocity) * 0.5 * h;
        if (angleDelta !== 0) wheelAngle = wrapAngle(wheelAngle + angleDelta);
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
            const theta = wheelAngle + cabin.id * TAU / CABIN_COUNT;
            const spring = 7.2 + 0.6 * Math.sin(phase);
            const damping = 3.5 * (1 + 0.1 * Math.cos(phase));
            const response = FERRIS_MAX_CABIN_SWING * 48 * (0.9 + 0.12 * Math.cos(phase + 0.5));
            const force = -wheelAcceleration * Math.sin(theta) * response;
            swingVelocity += (-spring * swingAngle - damping * swingVelocity + force) * h;
            swingAngle += swingVelocity * h;
            if (Math.abs(swingAngle) > FERRIS_MAX_CABIN_SWING) {
              swingAngle = Math.sign(swingAngle) * FERRIS_MAX_CABIN_SWING;
              if (swingAngle * swingVelocity > 0) swingVelocity = 0;
            }
            if (Math.abs(wheelAcceleration) < 1e-6
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

      const moving = wheelAngularVelocity > 0.001
        || cabins.some(cabin => Math.abs(cabin.swingAngle) + Math.abs(cabin.swingVelocity) > 0.001);
      state = {
        ...state,
        mode: harmonyActive && input.transportPlaying ? 'active' : moving ? 'settling' : 'resting',
        wheelAngle,
        wheelAngularVelocity,
        wheelDrive: driveTarget,
        chord: harmonyActive ? input.chord : null,
        rootPitchClass,
        confidence,
        activeCabinIds: cabins.filter(cabin => cabin.active).map(cabin => cabin.id),
        cabins,
        latestChordChange: input.chordChange
          ? input.chordChange.harmony?.chord ?? 'inactive'
          : state.latestChordChange,
      };
    },
  };
}
