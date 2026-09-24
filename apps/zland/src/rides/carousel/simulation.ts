import type { CarouselInput } from './adapter';

export type CarouselRiderState = Readonly<{
  index: number;
  degree: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
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
  activeNoteName: string | null;
  activeRider: number | null;
  activeDegree: number | null;
  displayDegree: string | null;
  chromaticMarker: Readonly<{ visible: boolean; noteName: string | null; midi: number | null; offset: number | null }>;
  noteProgress: number;
  riders: readonly CarouselRiderState[];
  lastEvent: string | null;
  presentationEnvelope: number;
  presentationActive: boolean;
  mechanicalIdleActive: boolean;
  movementSource: 'melody-evidence' | 'mechanical-idle' | 'settling' | 'none';
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
export const CAROUSEL_PRESENTATION_ATTACK_SECONDS = 0.15;
export const CAROUSEL_PRESENTATION_RELEASE_SECONDS = 0.45;
const DEFAULT_PITCH_RANGE = { min: 60, max: 69 } as const;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
const noteNameForMidi = (midi: number) => `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const wrapAngle = (angle: number) => angle % (Math.PI * 2);
const describeEvent = (event: CarouselInput['events'][number]) =>
  event.type === 'seek'
    ? `seek@${event.to.toFixed(2)}`
    : `${event.type}@${event.time.toFixed(2)}`;

const createRiders = (): CarouselRiderState[] => Array.from(
  { length: RIDER_COUNT },
  (_, index) => ({ index, degree: (index + 1) as CarouselRiderState['degree'], position: 0, velocity: 0, target: 0, active: false }),
);

const stepPresentation = (current: number, target: number, dt: number) => {
  if (dt <= 0) return current;
  const seconds = target > current ? CAROUSEL_PRESENTATION_ATTACK_SECONDS : CAROUSEL_PRESENTATION_RELEASE_SECONDS;
  return current + (target - current) * (1 - Math.exp(-dt / seconds));
};

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
  let pitchRange = options.pitchRange ?? DEFAULT_PITCH_RANGE;
  let state: CarouselState = {
    status: 'milestone-one-b', mode: 'resting', awake: false, reducedMotion,
    baseAngle: 0, baseAngularVelocity: 0,
    activeMidi: null, activeNoteName: null, activeRider: null, activeDegree: null, displayDegree: null,
    chromaticMarker: { visible: false, noteName: null, midi: null, offset: null }, noteProgress: 0,
    riders: createRiders(), lastEvent: null,
    presentationEnvelope: 0, presentationActive: false, mechanicalIdleActive: false, movementSource: 'none',
  };

  return {
    read: (): CarouselState => state,
    setPitchRange(range: Readonly<{ min: number; max: number }>): void {
      if (Number.isFinite(range.min) && Number.isFinite(range.max) && range.max >= range.min) pitchRange = range;
    },
    accept(input: CarouselInput, dt: number): void {
      const boundedDt = Math.min(0.1, Math.max(0, dt));
      const seek = input.events.some(event => event.type === 'seek');
      const latestEvent = input.events.at(-1) ?? null;

      const note = input.melodyAvailable ? input.activeNote : null;
      const degree = note && input.scaleDegree.available ? input.scaleDegree.degree : null;
      const activeRider = degree === null ? null : degree - 1;
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
      const fallbackVisible = note !== null && degree === null;
      const presentationEnvelope = seek
        ? (musicallyActive ? 1 : 0)
        : stepPresentation(state.presentationEnvelope, musicallyActive ? 1 : 0, boundedDt);
      const mechanicalIdleActive = input.transportPlaying && !musicallyActive;
      const movementSource = musicallyActive ? 'melody-evidence'
        : mechanicalIdleActive ? 'mechanical-idle'
          : baseMoving || riderMoving ? 'settling' : 'none';

      state = {
        ...state,
        mode: musicallyActive ? 'active' : input.melodyAvailable && (baseMoving || riderMoving) ? 'settling' : 'resting',
        awake: musicallyActive || baseMoving || riderMoving,
        baseAngle: seek ? state.baseAngle : base.angle,
        baseAngularVelocity: base.velocity,
        activeMidi: note?.midi ?? null,
        activeNoteName: note ? note.noteName ?? noteNameForMidi(note.midi) : null,
        activeRider,
        activeDegree: degree,
        displayDegree: input.scaleDegree.displayDegree,
        chromaticMarker: { visible: fallbackVisible, noteName: note ? note.noteName ?? noteNameForMidi(note.midi) : null,
          midi: note?.midi ?? null, offset: input.scaleDegree.chromaticOffset },
        noteProgress: input.noteProgress,
        riders,
        lastEvent: latestEvent ? describeEvent(latestEvent) : state.lastEvent,
        presentationEnvelope,
        presentationActive: presentationEnvelope > 0.01,
        mechanicalIdleActive,
        movementSource,
      };
    },
  };
}
