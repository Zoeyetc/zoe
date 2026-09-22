import type { AudioMap } from './types';

/** Authored deterministic fixture for the first complete musical path. */
export const milestoneOneAudioMap: AudioMap = {
  version: 1,
  id: 'milestone-one-melody',
  duration: 12,
  capabilities: { melody: true, rhythm: false, harmony: false, structure: false, spectrum: false },
  melody: [
    { id: 'c4-1', start: 1, end: 2.1, midi: 60, intensity: 0.68 },
    { id: 'e4-1', start: 2.35, end: 3.3, midi: 64, intensity: 0.78 },
    { id: 'g4-1', start: 3.55, end: 4.8, midi: 67, intensity: 0.9 },
    { id: 'a4-1', start: 5.1, end: 5.9, midi: 69, intensity: 0.82 },
    { id: 'g4-2', start: 6.15, end: 7.2, midi: 67, intensity: 0.74 },
    { id: 'e4-2', start: 7.55, end: 8.5, midi: 64, intensity: 0.7 },
    { id: 'd4-1', start: 8.8, end: 9.65, midi: 62, intensity: 0.66 },
    { id: 'c4-2', start: 9.9, end: 11, midi: 60, intensity: 0.76 },
  ],
  percussion: null,
  rhythm: null,
};

/** Authored deterministic fixture for melody plus discrete percussion events. */
export const milestoneTwoAudioMap: AudioMap = {
  ...milestoneOneAudioMap,
  id: 'milestone-two-percussion',
  duration: 16,
  capabilities: { ...milestoneOneAudioMap.capabilities, rhythm: true },
  percussion: [
    { id: 'kick-isolated', time: 0.8, type: 'kick', strength: 0.82 },
    { id: 'snare-isolated', time: 2.2, type: 'snare', strength: 0.72 },
    { id: 'hat-light', time: 3.35, type: 'hat', strength: 0.38 },
    { id: 'kick-close', time: 4.2, type: 'kick', strength: 0.9 },
    { id: 'hat-close', time: 4.32, type: 'hat', strength: 0.44 },
    { id: 'snare-close', time: 4.46, type: 'snare', strength: 0.78 },
    { id: 'kick-return', time: 7.4, type: 'kick', strength: 0.7 },
    { id: 'hat-return', time: 7.62, type: 'hat', strength: 0.34 },
    { id: 'snare-return', time: 9.1, type: 'snare', strength: 0.84 },
    { id: 'kick-final', time: 11.4, type: 'kick', strength: 1 },
  ],
  rhythm: null,
};

/** Same-tempo authored sections make groove and swing independently observable. */
export const milestoneTwoBAudioMap: AudioMap = {
  ...milestoneTwoAudioMap,
  id: 'milestone-two-b-groove',
  duration: 20,
  rhythm: [
    { id: 'straight', start: 0, end: 4, bpm: 120, beatsPerBar: 4, groove: 0.18, swing: 0.04 },
    { id: 'transition', start: 4, end: 8, bpm: 120, beatsPerBar: 4, groove: 0.48, swing: 0.28 },
    { id: 'swung', start: 8, end: 14, bpm: 120, beatsPerBar: 4, groove: 0.82, swing: 0.68 },
  ],
};

/** Explicit partial-domain fixture used to verify graceful rest behavior. */
export const unavailableMelodyAudioMap: AudioMap = {
  version: 1,
  id: 'melody-unavailable',
  duration: 12,
  capabilities: { melody: false, rhythm: false, harmony: false, structure: false, spectrum: false },
  melody: null,
  percussion: null,
  rhythm: null,
};
