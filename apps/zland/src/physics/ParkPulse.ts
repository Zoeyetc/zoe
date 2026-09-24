import type { AudioFrame } from '../audio/types';
import type { PhysicsPulse, WorldPoint } from './types';

export const PARK_PULSE_SOURCE_ID = 'park-pulse';
export const PARK_PULSE_POSITION: WorldPoint = { x: 0.5, y: 0.54 };
export const PARK_PULSE_RADIUS = 0.78;
const ATTACK_SECONDS = 0.08;
const RELEASE_SECONDS = 0.34;
const MAX_STRENGTH = 0.032;

export type ParkPulseState = Readonly<{
  available: boolean;
  bpm: number | null;
  beatPhase: number;
  rhythmConfidence: number;
  envelope: number;
  sourceStrength: number;
  position: WorldPoint;
  radius: number;
  lastBeatTime: number | null;
  pulseCount: number;
  active: boolean;
  movementSource: 'rhythm-via-physics' | 'none';
}>;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const approach = (current: number, target: number, dt: number, seconds: number) => {
  if (dt <= 0) return current;
  return current + (target - current) * (1 - Math.exp(-dt / seconds));
};

/** Rhythm interpreter only. It publishes bounded force through PhysicsWorld. */
export function createParkPulse() {
  let previousPhase: number | null = null;
  let previousTime: number | null = null;
  let state: ParkPulseState = {
    available: false, bpm: null, beatPhase: 0, rhythmConfidence: 0,
    envelope: 0, sourceStrength: 0, position: PARK_PULSE_POSITION,
    radius: PARK_PULSE_RADIUS, lastBeatTime: null, pulseCount: 0,
    active: false, movementSource: 'none',
  };
  return {
    read: () => state,
    reset() {
      previousPhase = null;
      previousTime = null;
      state = { ...state, envelope: 0, sourceStrength: 0, lastBeatTime: null, pulseCount: 0, active: false, movementSource: 'none' };
    },
    accept(frame: AudioFrame, dt: number) {
      const rhythm = frame.snapshot.rhythm;
      const time = frame.snapshot.transport.time;
      const playing = frame.snapshot.transport.playing;
      const seek = frame.events.some(event => event.type === 'seek');
      const available = rhythm.available && rhythm.bpm !== null;
      const phase = available ? clamp01(rhythm.beatPhase) : 0;
      const confidence = available ? clamp01(rhythm.confidence) : 0;
      const crossedBeat = available && playing && !seek && previousPhase !== null && previousTime !== null
        && time > previousTime && phase < previousPhase;
      const pulseCount = state.pulseCount + (crossedBeat ? 1 : 0);
      const lastBeatTime = crossedBeat ? (rhythm.nearestBeatTime ?? time) : state.lastBeatTime;
      const target = available && playing ? Math.exp(-phase * 6) * confidence : 0;
      const envelope = seek ? target : approach(state.envelope, target, Math.min(0.1, Math.max(0, dt)), target > state.envelope ? ATTACK_SECONDS : RELEASE_SECONDS);
      const sourceStrength = envelope * MAX_STRENGTH;
      state = {
        available, bpm: rhythm.bpm, beatPhase: phase, rhythmConfidence: confidence,
        envelope, sourceStrength, position: PARK_PULSE_POSITION, radius: PARK_PULSE_RADIUS,
        lastBeatTime, pulseCount, active: available && playing && sourceStrength > 0.0001,
        movementSource: available && playing ? 'rhythm-via-physics' : 'none',
      };
      previousPhase = phase;
      previousTime = time;
    },
    toPhysicsPulse(timestamp: number): PhysicsPulse {
      return {
        sourceId: PARK_PULSE_SOURCE_ID, sourceType: 'pulse', position: state.position,
        strength: state.sourceStrength, radius: state.radius, timestamp, active: state.active,
      };
    },
  };
}
