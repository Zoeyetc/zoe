import type { ZlandAudioMap } from './types';

/** Authored deterministic fixture for the first complete musical path. */
export const milestoneOneZlandAudioMap: ZlandAudioMap = {
  version: 1,
  id: 'milestone-one-melody',
  duration: 12,
  capabilities: { melody: true, rhythm: false, percussion: false, harmony: false, tonalCenter: false, structure: false, spectrum: false },
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
  harmony: null,
  structure: null,
  drops: null,
  spectrum: null,
};

/** Authored deterministic fixture for melody plus discrete percussion events. */
export const milestoneTwoZlandAudioMap: ZlandAudioMap = {
  ...milestoneOneZlandAudioMap,
  id: 'milestone-two-percussion',
  duration: 16,
  capabilities: { ...milestoneOneZlandAudioMap.capabilities, rhythm: true, percussion: true },
  percussion: [
    { id: 'kick-isolated', time: 0.8, type: 'kick', strength: 0.82 },
    { id: 'snare-isolated', time: 2.2, type: 'snare', strength: 0.72 },
    { id: 'hat-light', time: 3.35, type: 'closed-hat', strength: 0.38 },
    { id: 'kick-close', time: 4.2, type: 'kick', strength: 0.9 },
    { id: 'hat-close', time: 4.32, type: 'open-hat', strength: 0.44 },
    { id: 'snare-close', time: 4.46, type: 'snare', strength: 0.78 },
    { id: 'tom-authored', time: 5.3, type: 'tom', strength: 0.68 },
    { id: 'other-authored', time: 6, type: 'other-percussion', strength: 0.58 },
    { id: 'kick-return', time: 7.4, type: 'kick', strength: 0.7 },
    { id: 'hat-return', time: 7.62, type: 'closed-hat', strength: 0.34 },
    { id: 'snare-return', time: 9.1, type: 'snare', strength: 0.84 },
    { id: 'kick-final', time: 11.4, type: 'kick', strength: 1 },
  ],
  rhythm: null,
};

/** Same-tempo authored sections make groove and swing independently observable. */
export const milestoneTwoBZlandAudioMap: ZlandAudioMap = {
  ...milestoneTwoZlandAudioMap,
  id: 'milestone-two-b-groove',
  duration: 20,
  capabilities: { ...milestoneTwoZlandAudioMap.capabilities, harmony: true, structure: true },
  rhythm: [
    { id: 'straight', start: 0, end: 4, bpm: 120, beatsPerBar: 4, groove: 0.18, swing: 0.04 },
    { id: 'transition', start: 4, end: 8, bpm: 120, beatsPerBar: 4, groove: 0.48, swing: 0.28 },
    { id: 'swung', start: 8, end: 14, bpm: 120, beatsPerBar: 4, groove: 0.82, swing: 0.68 },
  ],
  harmony: [
    { id: 'c-major', start: 0, end: 4, chord: 'C major', rootPitchClass: 0, pitchClasses: [0, 4, 7], confidence: 0.98 },
    { id: 'a-minor', start: 4, end: 8, chord: 'A minor', rootPitchClass: 9, pitchClasses: [9, 0, 4], confidence: 0.94 },
    { id: 'f-major', start: 8, end: 12, chord: 'F major', rootPitchClass: 5, pitchClasses: [5, 9, 0], confidence: 0.96 },
    { id: 'g-major', start: 12, end: 16, chord: 'G major', rootPitchClass: 7, pitchClasses: [7, 11, 2], confidence: 0.95 },
  ],
  structure: [
    { id: 'rest', start: 0, end: 4, section: 'rest', energy: [0.08, 0.16], tension: [0.04, 0.12], build: [0, 0], phraseProgress: [0, 0.2] },
    { id: 'build', start: 4, end: 10, section: 'build', energy: [0.2, 0.76], tension: [0.16, 0.9], build: [0.08, 1], phraseProgress: [0.2, 0.5] },
    { id: 'tension', start: 10, end: 12, section: 'tension', energy: [0.76, 0.68], tension: [0.9, 1], build: [1, 1], phraseProgress: [0.5, 0.6] },
    { id: 'hold', start: 12, end: 13, section: 'hold', energy: [0.42, 0.34], tension: [1, 1], build: [1, 1], phraseProgress: [0.6, 0.65] },
    { id: 'release', start: 13, end: 16, section: 'release', energy: [1, 0.7], tension: [0.18, 0.08], build: [0, 0], phraseProgress: [0.65, 0.8] },
    { id: 'settle', start: 16, end: 20, section: 'settle', energy: [0.7, 0.08], tension: [0.08, 0], build: [0, 0], phraseProgress: [0.8, 1] },
  ],
  drops: [{ id: 'major-drop', time: 13, strength: 1 }],
};

/** Long-form phrase contour for RollerCoaster; intentionally distinct from the DropTower build/drop fixture. */
export const milestoneSixAZlandAudioMap: ZlandAudioMap = {
  ...milestoneTwoBZlandAudioMap,
  id: 'milestone-six-a-phrase',
  duration: 24,
  structure: [
    { id: 'phrase-station', start: 0, end: 4, section: 'station', energy: [0.08, 0.2], tension: [0.04, 0.1], build: [0, 0.1], phraseProgress: [0, 0.16] },
    { id: 'phrase-development', start: 4, end: 8, section: 'development', energy: [0.2, 0.58], tension: [0.1, 0.42], build: [0.1, 0.5], phraseProgress: [0.16, 0.34] },
    { id: 'phrase-tension', start: 8, end: 12, section: 'tension-rise', energy: [0.58, 0.72], tension: [0.42, 0.82], build: [0.5, 0.82], phraseProgress: [0.34, 0.52] },
    { id: 'phrase-crest', start: 12, end: 15, section: 'crest', energy: [0.72, 0.62], tension: [0.82, 1], build: [0.82, 1], phraseProgress: [0.52, 0.65] },
    { id: 'phrase-release', start: 15, end: 19, section: 'phrase-release', energy: [0.92, 1], tension: [0.3, 0.12], build: [0.2, 0], phraseProgress: [0.65, 0.82] },
    { id: 'phrase-momentum', start: 19, end: 22, section: 'momentum', energy: [0.9, 0.62], tension: [0.14, 0.08], build: [0, 0], phraseProgress: [0.82, 0.94] },
    { id: 'phrase-return', start: 22, end: 24, section: 'return', energy: [0.42, 0.08], tension: [0.08, 0.02], build: [0, 0], phraseProgress: [0.94, 1] },
  ],
  drops: [{ id: 'phrase-major-drop', time: 15, strength: 0.92 }],
};

/** Authored spectrum/texture evidence for Free Bodies; no FFT or analysis is performed. */
export const milestoneSevenZlandAudioMap: ZlandAudioMap = {
  ...milestoneSixAZlandAudioMap,
  id: 'milestone-seven-a-atmosphere',
  capabilities: { ...milestoneSixAZlandAudioMap.capabilities, spectrum: true },
  spectrum: [
    { id: 'atmosphere-calm', start: 0, end: 4, low: [0.24, 0.2], mid: [0.12, 0.14], high: [0.05, 0.08], brightness: [0.08, 0.12], texture: [0.05, 0.08] },
    { id: 'atmosphere-brightening', start: 4, end: 8, low: [0.2, 0.16], mid: [0.16, 0.34], high: [0.1, 0.62], brightness: [0.14, 0.78], texture: [0.1, 0.2] },
    { id: 'atmosphere-texture', start: 8, end: 12, low: [0.18, 0.34], mid: [0.38, 0.72], high: [0.56, 0.5], brightness: [0.72, 0.62], texture: [0.24, 0.88] },
    { id: 'atmosphere-active', start: 12, end: 16, low: [0.32, 0.42], mid: [0.7, 0.82], high: [0.66, 0.9], brightness: [0.7, 0.94], texture: [0.72, 0.96] },
    { id: 'atmosphere-reduced', start: 16, end: 20, low: [0.34, 0.18], mid: [0.48, 0.2], high: [0.42, 0.16], brightness: [0.52, 0.24], texture: [0.48, 0.18] },
    { id: 'atmosphere-settling', start: 20, end: 24, low: [0.16, 0.04], mid: [0.14, 0.02], high: [0.1, 0.01], brightness: [0.18, 0.02], texture: [0.14, 0.01] },
  ],
};

/** Explicit partial-domain fixture used to verify graceful rest behavior. */
export const unavailableMelodyZlandAudioMap: ZlandAudioMap = {
  version: 1,
  id: 'melody-unavailable',
  duration: 12,
  capabilities: { melody: false, rhythm: false, percussion: false, harmony: false, tonalCenter: false, structure: false, spectrum: false },
  melody: null,
  percussion: null,
  rhythm: null,
  harmony: null,
  structure: null,
  drops: null,
  spectrum: null,
};
