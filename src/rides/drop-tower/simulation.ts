import type { DropTowerInput } from './adapter';

export type DropTowerPhase = 'IDLE' | 'LIFTING' | 'HOLDING' | 'DROPPING' | 'REBOUND' | 'SETTLING';

export type DropTowerState = Readonly<{
  status: 'milestone-five-a';
  mode: 'resting' | 'active' | 'settling';
  phase: DropTowerPhase;
  phaseElapsed: number;
  reducedMotion: boolean;
  position: number; // 0 = top, 1 = resting platform
  velocity: number;
  liftTarget: number;
  dropStrength: number;
  structureAvailable: boolean;
  section: string | null;
  sectionProgress: number;
  build: number;
  tension: number;
  energy: number;
  latestDropEvent: string | null;
}>;

export type DropTowerOptions = Readonly<{ reducedMotion?: boolean }>;

export const DROP_TOWER_TOP = 0.08;
export const DROP_TOWER_REDUCED_TOP = 0.78;
export const DROP_TOWER_MAX_VELOCITY = 2.4;
const MAX_COMPRESSION = 1.08;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clamp01 = (value: number) => clamp(value, 0, 1);

/** Legacy-derived actor-local lift, hold, gravity drop, braking, rebound, and settle state machine. */
export function createDropTowerSimulation(options: DropTowerOptions = {}) {
  const reducedMotion = options.reducedMotion ?? false;
  const topPosition = reducedMotion ? DROP_TOWER_REDUCED_TOP : DROP_TOWER_TOP;
  let state: DropTowerState;

  const reset = () => {
    state = {
      status: 'milestone-five-a', mode: 'resting', phase: 'IDLE', phaseElapsed: 0,
      reducedMotion, position: 1, velocity: 0, liftTarget: 1, dropStrength: 0,
      structureAvailable: false, section: null, sectionProgress: 0,
      build: 0, tension: 0, energy: 0, latestDropEvent: null,
    };
  };
  reset();

  const reconcile = (input: DropTowerInput) => {
    const build = clamp01(input.build);
    if (input.section === 'rest' || input.section === 'station' || input.section === null) {
      state = { ...state, phase: 'IDLE', phaseElapsed: 0, position: 1, velocity: 0, liftTarget: 1 };
      return;
    }
    if (input.section === 'build' || input.section === 'development' || input.section === 'tension-rise') {
      const liftTarget = 1 - (1 - topPosition) * build;
      state = { ...state, phase: 'LIFTING', phaseElapsed: 0,
        position: liftTarget, velocity: 0, liftTarget };
      return;
    }
    if (input.section === 'tension' || input.section === 'hold' || input.section === 'crest') {
      state = { ...state, phase: 'HOLDING', phaseElapsed: 0,
        position: topPosition, velocity: 0, liftTarget: topPosition };
      return;
    }
    // Post-drop seeks synchronize to a stable recovery state; they never replay freefall.
    state = { ...state, phase: input.section === 'release' || input.section === 'phrase-release'
      ? 'SETTLING' : 'IDLE',
      phaseElapsed: 0, position: 1, velocity: 0, liftTarget: 1 };
  };

  return {
    read: (): DropTowerState => state,
    reset,
    accept(input: DropTowerInput, dt: number) {
      if (input.restart) reset();
      if (!input.structureAvailable) {
        reset();
        return;
      }

      state = {
        ...state,
        structureAvailable: true,
        section: input.section,
        sectionProgress: clamp01(input.sectionProgress),
        build: clamp01(input.build),
        tension: clamp01(input.tension),
        energy: clamp01(input.energy),
      };
      if (input.seek) {
        reconcile(input);
        return;
      }

      let phase = state.phase;
      let phaseElapsed = state.phaseElapsed;
      let position = state.position;
      let velocity = state.velocity;
      let liftTarget = 1 - (1 - topPosition) * clamp01(input.build);
      let dropStrength = state.dropStrength;
      let latestDropEvent = state.latestDropEvent;

      if (input.drop && (phase === 'HOLDING' || phase === 'LIFTING')) {
        phase = 'DROPPING';
        phaseElapsed = 0;
        velocity = Math.max(0, velocity);
        dropStrength = clamp(input.drop.strength * (0.82 + input.energy * 0.18), 0.4, 1);
        latestDropEvent = input.drop.id;
      } else if (phase === 'IDLE' && input.transportPlaying && input.build > 0.04) {
        phase = 'LIFTING';
        phaseElapsed = 0;
      } else if (phase === 'LIFTING'
        && input.build > 0.9 && input.tension > 0.86) {
        phase = 'HOLDING';
        phaseElapsed = 0;
        liftTarget = topPosition;
      }

      const boundedDt = Math.min(0.1, Math.max(0, dt));
      const steps = Math.max(1, Math.ceil(boundedDt * 120));
      const h = boundedDt / steps;
      for (let step = 0; step < steps; step += 1) {
        phaseElapsed += h;
        switch (phase) {
          case 'IDLE':
            position = 1;
            velocity = 0;
            liftTarget = 1;
            break;
          case 'LIFTING': {
            const acceleration = input.transportPlaying
              ? (liftTarget - position) * 10 - velocity * 6.5
              : -velocity * 9;
            velocity = clamp(velocity + acceleration * h, -0.48, 0.48);
            position += velocity * h;
            break;
          }
          case 'HOLDING': {
            liftTarget = topPosition;
            const acceleration = (topPosition - position) * 28 - velocity * 11;
            velocity = clamp(velocity + acceleration * h, -0.38, 0.38);
            position += velocity * h;
            if (Math.abs(position - topPosition) < 0.001 && Math.abs(velocity) < 0.005) {
              position = topPosition;
              velocity = 0;
            }
            break;
          }
          case 'DROPPING': {
            const gravity = (reducedMotion ? 0.75 : 4.8) * (0.75 + dropStrength * 0.25);
            position += velocity * h + 0.5 * gravity * h * h;
            velocity = clamp(velocity + gravity * h, -DROP_TOWER_MAX_VELOCITY, DROP_TOWER_MAX_VELOCITY);
            if (position >= 1) {
              position = 1;
              velocity = Math.min(velocity * 0.32, reducedMotion ? 0.12 : 0.72)
                * (reducedMotion ? 0.35 : 0.58);
              phase = 'REBOUND';
              phaseElapsed = 0;
            }
            break;
          }
          case 'REBOUND': {
            const spring = reducedMotion ? 95 : 210;
            const drag = 2 * Math.sqrt(spring) * 0.78;
            velocity += (-spring * (position - 1) - drag * velocity) * h;
            position += velocity * h;
            if (phaseElapsed > 0.55 || (Math.abs(position - 1) < 0.003 && Math.abs(velocity) < 0.02)) {
              phase = 'SETTLING';
              phaseElapsed = 0;
            }
            break;
          }
          case 'SETTLING': {
            velocity += ((1 - position) * 70 - velocity * 14) * h;
            position += velocity * h;
            if (Math.abs(position - 1) < 0.0005 && Math.abs(velocity) < 0.003) {
              position = 1;
              velocity = 0;
              phase = 'IDLE';
              phaseElapsed = 0;
              dropStrength = 0;
            }
            break;
          }
        }
        position = clamp(position, topPosition, MAX_COMPRESSION);
        velocity = clamp(velocity, -DROP_TOWER_MAX_VELOCITY, DROP_TOWER_MAX_VELOCITY);
      }

      const mode = phase === 'IDLE' ? 'resting'
        : phase === 'REBOUND' || phase === 'SETTLING' ? 'settling' : 'active';
      state = {
        ...state, mode, phase, phaseElapsed, position, velocity, liftTarget,
        dropStrength, latestDropEvent,
      };
    },
  };
}
