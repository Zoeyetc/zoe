import assert from 'node:assert/strict';
import test from 'node:test';
import type { ChordSegment, ChromaFrame, HarmonyAnalysis, TonalMode } from '../src/listening-engine/index.ts';
import { analyzePcmListening } from '../src/listening-engine/index.ts';
import {
  analyzeTonalCenter,
  circleOfFifthsDistance,
  circleOfFifthsIndex,
  MAJOR_KEY_PROFILE,
  MINOR_KEY_PROFILE,
} from '../src/listening-engine/index.ts';

const rotateProfile = (profile: readonly number[], root: number) => {
  const rotated = Array.from({ length: 12 }, (_, pitchClass) => profile[(pitchClass - root + 12) % 12] ?? 0);
  const total = rotated.reduce((sum, value) => sum + value, 0);
  return rotated.map(value => value / total);
};
const chordPitchClasses = (root: number, mode: TonalMode) => [root, (root + (mode === 'major' ? 4 : 3)) % 12, (root + 7) % 12];
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const chordSegment = (id: string, start: number, end: number, root: number, mode: TonalMode): ChordSegment => ({
  id, start, end, rootPitchClass: root, quality: mode, chord: `${['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][root]} ${mode}`,
  pitchClasses: chordPitchClasses(root, mode), confidence: 0.94,
});
const frame = (time: number, chroma: readonly number[], confidence = 0.92): ChromaFrame => ({
  time, chroma, energy: 0.4, confidence, chord: null, topCandidate: null, secondCandidate: null, scoreMargin: 0,
});
const harmony = (
  duration: number,
  chromaAt: (time: number) => readonly number[],
  segments: readonly ChordSegment[],
  available = true,
): HarmonyAnalysis => ({
  version: 1, available, confidence: available ? 0.9 : 0, noChordRatio: available ? 0 : 1,
  averageSegmentDuration: segments.length ? duration / segments.length : 0,
  frames: Array.from({ length: Math.floor(duration * 2) + 1 }, (_, index) => frame(index / 2, chromaAt(index / 2))),
  segments,
  metadata: {
    analysisSampleRate: 12000, frameSize: 4096, hopSize: 1024, frequencyRange: [80, 5000],
    chordVocabulary: '12-major-12-minor-triads', normalization: 'log-compressed-peak-weighted-l1-chroma',
    smoothing: 'three-frame-island-removal-and-minimum-segment', minimumSegmentDuration: 0.24,
    frameConfidenceThreshold: 0.52, availabilityThreshold: 0.6,
  },
});
const clearKey = (root: number, mode: TonalMode, duration = 12) => harmony(
  duration,
  () => rotateProfile(mode === 'major' ? MAJOR_KEY_PROFILE : MINOR_KEY_PROFILE, root),
  [chordSegment('tonic', 0, duration, root, mode)],
);

test('clear C major, A minor, G major, and E minor evidence resolves distinct tonal centers', () => {
  for (const expected of [
    { root: 0, mode: 'major' as const, label: 'C major' },
    { root: 9, mode: 'minor' as const, label: 'A minor' },
    { root: 7, mode: 'major' as const, label: 'G major' },
    { root: 4, mode: 'minor' as const, label: 'E minor' },
  ]) {
    const result = analyzeTonalCenter(clearKey(expected.root, expected.mode), 12);
    assert.equal(result.available, true);
    assert.equal(result.segments[0]?.label, expected.label);
    assert.equal(result.globalTonalCenter?.label, expected.label);
  }
});

test('C-Am-F-G chord changes remain one C-major tonal-center segment', () => {
  const segments = [
    chordSegment('c', 0, 4, 0, 'major'), chordSegment('am', 4, 8, 9, 'minor'),
    chordSegment('f', 8, 12, 5, 'major'), chordSegment('g', 12, 16, 7, 'major'),
  ];
  const result = analyzeTonalCenter(harmony(16, () => rotateProfile(MAJOR_KEY_PROFILE, 0), segments), 16);
  assert.equal(result.available, true);
  assert.deepEqual(result.segments.map(segment => segment.label), ['C major']);
});

test('A-minor-compatible chord changes remain one A-minor tonal-center segment', () => {
  const segments = [
    chordSegment('am', 0, 4, 9, 'minor'), chordSegment('dm', 4, 8, 2, 'minor'),
    chordSegment('em', 8, 12, 4, 'minor'), chordSegment('am2', 12, 16, 9, 'minor'),
  ];
  const result = analyzeTonalCenter(harmony(16, () => rotateProfile(MINOR_KEY_PROFILE, 9), segments), 16);
  assert.deepEqual(result.segments.map(segment => segment.label), ['A minor']);
});

test('sustained C-major to G-major evidence creates one stable modulation boundary', () => {
  const result = analyzeTonalCenter(harmony(24,
    time => rotateProfile(MAJOR_KEY_PROFILE, time < 12 ? 0 : 7),
    [chordSegment('c', 0, 12, 0, 'major'), chordSegment('g', 12, 24, 7, 'major')]), 24);
  assert.deepEqual(result.segments.map(segment => segment.label), ['C major', 'G major']);
  assert.ok((result.segments[1]?.start ?? 0) >= 8 && (result.segments[1]?.start ?? 99) <= 16);
  assert.equal(result.segments[1]?.distanceFromPrevious, 1);
});

test('a short secondary-dominant-like excursion does not become a modulation segment', () => {
  const result = analyzeTonalCenter(harmony(20,
    time => rotateProfile(MAJOR_KEY_PROFILE, time >= 9 && time < 11 ? 7 : 0),
    [chordSegment('c1', 0, 9, 0, 'major'), chordSegment('d', 9, 11, 2, 'major'),
      chordSegment('c2', 11, 20, 0, 'major')]), 20);
  assert.deepEqual(result.segments.map(segment => segment.label), ['C major']);
});

test('segment times are ordered, non-overlapping, positive, and confidence is bounded', () => {
  const result = analyzeTonalCenter(harmony(24,
    time => rotateProfile(MAJOR_KEY_PROFILE, time < 12 ? 0 : 1),
    [chordSegment('c', 0, 12, 0, 'major'), chordSegment('cs', 12, 24, 1, 'major')]), 24);
  assert.deepEqual(result.segments.map(segment => segment.label), ['C major', 'C# major']);
  for (let index = 0; index < result.segments.length; index += 1) {
    const segment = result.segments[index];
    assert.ok(segment.end > segment.start);
    assert.ok(Number.isFinite(segment.confidence) && segment.confidence >= 0 && segment.confidence <= 1);
    if (index) assert.ok(segment.start >= result.segments[index - 1].end);
  }
  for (const item of result.frames) {
    assert.ok(Number.isFinite(item.confidence) && item.confidence >= 0 && item.confidence <= 1);
    assert.ok(Number.isFinite(item.topScore) && item.topScore >= 0 && item.topScore <= 1);
  }
});

test('relative-major/minor ambiguity lowers confidence', () => {
  const cMajor = rotateProfile(MAJOR_KEY_PROFILE, 0);
  const aMinor = rotateProfile(MINOR_KEY_PROFILE, 9);
  const ambiguous = cMajor.map((value, index) => (value + (aMinor[index] ?? 0)) / 2);
  const clear = analyzeTonalCenter(clearKey(0, 'major'), 12);
  const uncertain = analyzeTonalCenter(harmony(12, () => ambiguous, []), 12);
  assert.ok(uncertain.confidence < clear.confidence);
});

test('silence, unavailable noise, chromatic ambiguity, and a short file do not fabricate capability', () => {
  const uniform = Array(12).fill(1 / 12) as number[];
  const zero = Array(12).fill(0) as number[];
  const cases = [
    harmony(8, () => zero, [], false),
    harmony(8, () => uniform, [], false),
    harmony(8, () => uniform, [], true),
    clearKey(0, 'major', 1),
  ];
  for (const source of cases) {
    const result = analyzeTonalCenter(source, source.frames.at(-1)?.time ?? 0);
    assert.equal(result.available, false);
    assert.equal(result.segments.length, 0);
    assert.equal(result.globalTonalCenter, null);
  }
});

test('circle-of-fifths indices and wrapped distances preserve canonical pitch-class identity', () => {
  assert.deepEqual([0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5].map(circleOfFifthsIndex),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(circleOfFifthsDistance(0, 7), 1);
  assert.equal(circleOfFifthsDistance(0, 5), 1);
  assert.equal(circleOfFifthsDistance(6, 0), 6);
});

test('same harmonic evidence produces the same deterministic timeline', () => {
  const source = clearKey(7, 'major');
  assert.deepEqual(analyzeTonalCenter(source, 12), analyzeTonalCenter(source, 12));
});

test('real PCM analysis derives C-major tonal evidence at two sample rates without a second FFT pipeline', () => {
  for (const sampleRate of [12_000, 48_000]) {
    const roots = [60, 57, 65, 67];
    const secondsPerChord = 2;
    const signal = Float32Array.from({ length: sampleRate * secondsPerChord * roots.length }, (_, index) => {
      const chordIndex = Math.min(roots.length - 1, Math.floor(index / (sampleRate * secondsPerChord)));
      const root = roots[chordIndex];
      const minor = chordIndex === 1;
      const notes = [root, root + (minor ? 3 : 4), root + 7];
      const time = index / sampleRate;
      return notes.reduce((sum, midi, voice) => sum
        + (0.18 + voice * 0.02) * Math.sin(2 * Math.PI * hz(midi) * time + voice * 0.23), 0);
    });
    const map = analyzePcmListening({ sampleRate, channels: [signal] },
      { id: `tonal-${sampleRate}`, filename: 'tonal.wav', mimeType: 'audio/wav' });
    assert.equal(map.capabilities.tonalCenter, true);
    assert.equal(map.tonalCenterAnalysis?.segments[0]?.label, 'C major');
    assert.equal(map.harmonyAnalysis?.metadata.analysisSampleRate, 12000);
    assert.equal(map.tonalCenterAnalysis?.metadata.sourceChroma, 'harmony-analysis-normalized-chroma');
  }
});
