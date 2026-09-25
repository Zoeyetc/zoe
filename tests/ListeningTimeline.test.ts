import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createListeningTimeline, lookupListeningSnapshot,
  type ListeningMap,
} from '../src/listening-engine/index.ts';

const genericMap = {
  version: 1, duration: 4,
  capabilities: { melody: true, rhythm: true, percussion: true, harmony: true,
    tonalCenter: true, structure: true, spectrum: false },
  melody: [{ id: 'note', start: 1, end: 2, midi: 60, intensity: 0.7 }],
  percussion: [{ id: 'kick', time: 1.5, type: 'kick', strength: 0.8 }],
  percussionAnalysis: { available: true, events: [], confidence: 0.8 },
  rhythm: [{ id: 'rhythm', start: 0, end: 4, bpm: 120, beatsPerBar: 4, groove: 0.2, swing: 0 }],
  rhythmAnalysis: { available: true, bpm: 120, confidence: 0.9, beatInterval: 0.5,
    beats: [{ id: 'beat-1', time: 1, index: 2, strength: 0.9 }], groove: 0.2, swing: 0,
    swingConfidence: 0 },
  harmony: [
    { id: 'c', start: 0, end: 2, chord: 'C major', rootPitchClass: 0, pitchClasses: [0, 4, 7], confidence: 0.9 },
    { id: 'g', start: 2, end: 4, chord: 'G major', rootPitchClass: 7, pitchClasses: [7, 11, 2], confidence: 0.9 },
  ],
  tonalCenterAnalysis: { available: true, confidence: 0.9, candidates: [], frames: [],
    segments: [
      { id: 'key-c', start: 0, end: 2, rootPitchClass: 0, mode: 'major', label: 'C major', confidence: 0.9, circleOfFifthsIndex: 0, distanceFromPrevious: null },
      { id: 'key-g', start: 2, end: 4, rootPitchClass: 7, mode: 'major', label: 'G major', confidence: 0.9, circleOfFifthsIndex: 1, distanceFromPrevious: 1 },
    ] },
  structureAnalysis: { available: true, confidence: 0.9, frames: [], boundaries: [], novelty: [], arrangementChanges: [],
    segments: [
      { id: 'a', start: 0, end: 2, label: 'A', recurrenceGroup: 'A', confidence: 0.9, energy: 0.3, contrast: 0.2, importance: 0.4 },
      { id: 'b', start: 2, end: 4, label: 'B', recurrenceGroup: 'B', confidence: 0.9, energy: 0.7, contrast: 0.8, importance: 0.9 },
    ] },
  spectrum: null,
} as unknown as ListeningMap;

test('generic timeline preserves exact forward boundaries, ordering, and duplicate suppression', () => {
  const timeline = createListeningTimeline(genericMap, 'map-a');
  assert.deepEqual(timeline.read(0).events, []);
  assert.deepEqual(timeline.read(2).events.map(event => event.type), [
    'note-on', 'beat', 'kick', 'note-off', 'chord-change', 'tonal-center-change', 'section-change',
  ]);
  assert.deepEqual(timeline.read(2).events, []);
  assert.deepEqual(timeline.read(1).events, []);
  assert.deepEqual(timeline.read(2).events.map(event => event.type), [
    'kick', 'note-off', 'chord-change', 'tonal-center-change', 'section-change',
  ]);
});

test('synchronize, restart, ended, and map replacement reset crossing without replay', () => {
  const timeline = createListeningTimeline(genericMap, 'map-a');
  timeline.read(0);
  assert.deepEqual(timeline.synchronize(3).events, []);
  assert.deepEqual(timeline.read(3).events, []);
  timeline.synchronize(0);
  assert.deepEqual(timeline.read(1).events.map(event => event.type), ['note-on', 'beat']);
  assert.deepEqual(timeline.read(4).events.at(-1)?.type, 'chord-change');
  assert.deepEqual(timeline.replaceMap(genericMap, 'map-b', 1).events, []);
  assert.equal(timeline.identity, 'map-b');
  assert.deepEqual(timeline.read(1).events, []);
});
