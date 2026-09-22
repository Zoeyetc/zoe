import type { CarouselInput } from './adapter';

export type CarouselRiderState = Readonly<{
  index: number;
  position: number;
  velocity: number;
  target: number;
  active: boolean;
}>;

export type CarouselState = Readonly<{
  status: 'milestone-one-b';
  mode: 'resting' | 'active' | 'settling';
  awake: boolean;
  reducedMotion: boolean;
  baseAngle: number;
  baseAngularVelocity: number;
  activeMidi: number | null;
  activeRider: number | null;
  noteProgress: number;
  riders: readonly CarouselRiderState[];
  lastEvent: string | null;
}>;

export type CarouselSimulationOptions = Readonly<{
  reducedMotion?: boolean;
  pitchRange?: Readonly<{ min: number; max: number }>;
}>;

const RIDER_COUNT = 8;
const BASE_TARGET_VELOCITY = 0.38;
const BASE_ACCELERATION = 2.8;
const BASE_DRAG = 2.4;
const RIDER_SPRING = 42;
const RIDER_DAMPING = 10;
const DEFAULT_PITCH_RANGE = { min: 60, max: 69 } as const;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const wrapAngle = (angle: number) => angle % (Math.PI * 2);
const describeEvent = (event: CarouselInput['events'][number]) =>
  event.type === 'seek'
    ? `seek@${event.to.toFixed(2)}`
    : `${event.type}@${event.time.toFixed(2)}`;

const createRiders = (): CarouselRiderState[] => Array.from(
  { length: RIDER_COUNT },
  (_, index) => ({ index, position: 0, velocity: 0, target: 0, active: false }),
);

function pitchTarget(midi: number, intensity: number, min: number, max: number) {
  const normalizedPitch = max === min ? 0.5 : clamp01((midi - min) / (max - min));
  const restrainedIntensity = 0.72 + clamp01(intensity) * 0.28;
  return clamp01((0.22 + normalizedPitch * 0.78) * restrainedIntensity);
}

function stepBase(angle: number, velocity: number, playing: boolean, reducedMotion: boolean, dt: number) {
  if (reducedMotion) return { angle, velocity: 0 };
  const target = playing ? BASE_TARGET_VELOCITY : 0;
  const acceleration = target > velocity
    ? Math.min(BASE_ACCELERATION * dt, target - velocity)
    : -Math.min(BASE_DRAG * dt, velocity - target);
  const nextVelocity = Math.max(0, velocity + acceleration);
  return { angle: wrapAngle(angle + nextVelocity * dt), velocity: nextVelocity };
}

function stepRider(rider: CarouselRiderState, target: number, active: boolean, dt: number, reducedMotion: boolean) {
  if (reducedMotion) {
    const position = active ? target * 0.28 : 0;
    return { ...rider, position, velocity: 0, target: position, active };
  }
  const acceleration = (target - rider.position) * RIDER_SPRING - rider.velocity * RIDER_DAMPING;
  const velocity = rider.velocity + acceleration * dt;
  const position = clamp01(rider.position + velocity * dt);
  return { ...rider, position, velocity, target, active };
}

/** Actor-local mechanics. Audio input selects rider targets; it never sets base angle. */
export function createCarouselSimulation(options: CarouselSimulationOptions = {}) {
  const reducedMotion = options.reducedMotion ?? false;
  const pitchRange = options.pitchRange ?? DEFAULT_PITCH_RANGE;
  let state: CarouselState = {
    status: 'milestone-one-b', mode: 'resting', awake: false, reducedMotion,
    baseAngle: 0, baseAngularVelocity: 0,
    activeMidi: null, activeRider: null, noteProgress: 0,
    riders: createRiders(), lastEvent: null,
  };

  return {
    read: (): CarouselState => state,
    accept(input: CarouselInput, dt: number): void {
      const boundedDt = Math.min(0.1, Math.max(0, dt));
      const seek = input.events.some(event => event.type === 'seek');
      const latestEvent = input.events.at(-1) ?? null;

      if (!input.melodyAvailable) {
        state = { ...state, mode: 'resting', awake: false,
          baseAngularVelocity: 0, activeMidi: null, activeRider: null,
          noteProgress: 0, riders: createRiders(),
          lastEvent: latestEvent?.type ?? state.lastEvent };
        return;
      }

      const note = input.activeNote;
      const activeRider = note ? note.midi % RIDER_COUNT : null;
      const requestedTarget = note
        ? pitchTarget(note.midi, note.intensity, pitchRange.min, pitchRange.max)
        : 0;
      const expressionTarget = input.transportPlaying ? requestedTarget : 0;
      const base = stepBase(state.baseAngle, state.baseAngularVelocity,
        input.transportPlaying, reducedMotion, boundedDt);

      const riders = state.riders.map(rider => {
        const active = rider.index === activeRider;
        const target = active ? expressionTarget : 0;
        if (seek) {
          const position = reducedMotion ? target * 0.28 : target;
          return { ...rider, position, velocity: 0, target: position, active };
        }
        return stepRider(rider, target, active, boundedDt, reducedMotion);
      });
      const riderMoving = riders.some(rider => Math.abs(rider.velocity) > 0.01 || rider.position > 0.01);
      const baseMoving = base.velocity > 0.01;
      const musicallyActive = note !== null && input.transportPlaying;

      state = {
        ...state,
        mode: musicallyActive ? 'active' : baseMoving || riderMoving ? 'settling' : 'resting',
        awake: musicallyActive || baseMoving || riderMoving,
        baseAngle: seek ? state.baseAngle : base.angle,
        baseAngularVelocity: base.velocity,
        activeMidi: note?.midi ?? null,
        activeRider,
        noteProgress: input.noteProgress,
        riders,
        lastEvent: latestEvent ? describeEvent(latestEvent) : state.lastEvent,
      };
    },
  };
}
