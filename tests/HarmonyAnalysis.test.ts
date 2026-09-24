import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeHarmony } from '@computational-listening/engine';
import { analyzePcmListening } from '@computational-listening/engine';
import { createAudioWorld, lookupSnapshot } from '../apps/zland/src/audio/AudioWorld.ts';
import { toFerrisWheelInput } from '../apps/zland/src/rides/ferris-wheel/adapter.ts';
import { createFerrisWheelSimulation } from '../apps/zland/src/rides/ferris-wheel/simulation.ts';

const SAMPLE_RATE = 12_000;
const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const chordMidi = (root: number, quality: 'major' | 'minor', octaveRoot = 60 + root) =>
  [octaveRoot, octaveRoot + (quality === 'major' ? 4 : 3), octaveRoot + 7];
const chord = (root: number, quality: 'major' | 'minor', seconds = 1.5, melodyMidi?: number) => {
  const notes = chordMidi(root, quality);
  const length = Math.floor(SAMPLE_RATE * seconds);
  return Float32Array.from({ length }, (_, index) => {
    const time = index / SAMPLE_RATE;
    const harmony = notes.reduce((sum, midi, voice) => sum
      + (0.22 + voice * 0.015) * Math.sin(2 * Math.PI * hz(midi) * time + voice * 0.37), 0);
    const melody = melodyMidi === undefined ? 0 : 0.12 * Math.sin(2 * Math.PI * hz(melodyMidi) * time);
    return harmony + melody;
  });
};
const concatenate = (...signals: readonly Float32Array[]) => {
  const output = new Float32Array(signals.reduce((sum, signal) => sum + signal.length, 0));
  let offset = 0;
  for (const signal of signals) { output.set(signal, offset); offset += signal.length; }
  return output;
};
const analyze = (mono: Float32Array, sampleRate = SAMPLE_RATE) => analyzeHarmony({ mono, sampleRate });

test('major and minor triads expose exact deterministic pitch-class membership', () => {
  const cases = [
    { root: 0, quality: 'major' as const, label: 'C major', pitchClasses: [0, 4, 7] },
    { root: 0, quality: 'minor' as const, label: 'C minor', pitchClasses: [0, 3, 7] },
    { root: 9, quality: 'minor' as const, label: 'A minor', pitchClasses: [9, 0, 4] },
    { root: 7, quality: 'major' as const, label: 'G major', pitchClasses: [7, 11, 2] },
  ];
  for (const expected of cases) {
    const result = analyze(chord(expected.root, expected.quality));
    assert.equal(result.available, true);
    assert.equal(result.segments[0]?.chord, expected.label);
    assert.equal(result.segments[0]?.rootPitchClass, expected.root);
    assert.deepEqual(result.segments[0]?.pitchClasses, expected.pitchClasses);
  }
});

test('C to Am to F to G produces an ordered monotonic chord timeline', () => {
  const result = analyze(concatenate(chord(0, 'major'), chord(9, 'minor'), chord(5, 'major'), chord(7, 'major')));
  assert.deepEqual(result.segments.map(segment => segment.chord), ['C major', 'A minor', 'F major', 'G major']);
  for (let index = 0; index < result.segments.length; index += 1) {
    const segment = result.segments[index];
    assert.ok(segment.end > segment.start);
    if (index) assert.ok(segment.start >= result.segments[index - 1].end);
  }
});

test('inverted voicing preserves root and quality', () => {
  const midis = [64, 67, 72];
  const signal = Float32Array.from({ length: SAMPLE_RATE * 2 }, (_, index) =>
    midis.reduce((sum, midi, voice) => sum + 0.24 * Math.sin(2 * Math.PI * hz(midi) * index / SAMPLE_RATE + voice), 0));
  const result = analyze(signal);
  assert.equal(result.segments[0]?.chord, 'C major');
  assert.deepEqual(result.segments[0]?.pitchClasses, [0, 4, 7]);
});

test('a melody note over a sustained chord does not replace the chord', () => {
  const result = analyze(chord(0, 'major', 2, 74));
  assert.equal(result.available, true);
  assert.equal(result.segments[0]?.chord, 'C major');
});

test('supported chord fundamentals survive stronger low-order harmonics', () => {
  const notes = chordMidi(0, 'major');
  const signal = Float32Array.from({ length: SAMPLE_RATE * 2 }, (_, index) => {
    const time = index / SAMPLE_RATE;
    return notes.reduce((sum, midi) => sum
      + 0.08 * Math.sin(2 * Math.PI * hz(midi) * time)
      + 0.22 * Math.sin(2 * Math.PI * hz(midi) * 2 * time)
      + 0.14 * Math.sin(2 * Math.PI * hz(midi) * 3 * time), 0);
  });
  assert.equal(analyze(signal).segments[0]?.chord, 'C major');
});

test('silence, deterministic noise, ambiguous dyad, and a very short chord remain unavailable', () => {
  let seed = 7123;
  const noise = Float32Array.from({ length: SAMPLE_RATE * 2 }, () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return ((seed / 0xffffffff) * 2 - 1) * 0.25;
  });
  const dyad = Float32Array.from({ length: SAMPLE_RATE * 2 }, (_, index) =>
    0.3 * Math.sin(2 * Math.PI * hz(60) * index / SAMPLE_RATE)
    + 0.3 * Math.sin(2 * Math.PI * hz(67) * index / SAMPLE_RATE));
  for (const signal of [new Float32Array(SAMPLE_RATE * 2), noise, dyad, chord(0, 'major', 0.2)]) {
    const result = analyze(signal);
    assert.equal(result.available, false);
    assert.equal(result.segments.length, 0);
  }
});

test('one-frame transition overlap does not create chord chatter', () => {
  const first = chord(0, 'major', 1.2);
  const overlap = chord(9, 'minor', 0.09);
  const last = chord(0, 'major', 1.2);
  const result = analyze(concatenate(first, overlap, last));
  assert.deepEqual(result.segments.map(segment => segment.chord), ['C major']);
});

test('chroma values and confidence are finite, bounded, and deterministic', () => {
  const signal = chord(5, 'major', 1.5);
  const first = analyze(signal);
  const second = analyze(signal);
  assert.deepEqual(first, second);
  for (const frame of first.frames) {
    assert.equal(frame.chroma.length, 12);
    for (const value of frame.chroma) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
    assert.ok(Number.isFinite(frame.confidence) && frame.confidence >= 0 && frame.confidence <= 1);
  }
});

test('frequency mapping is sample-rate aware and stereo downmix retains tonal evidence', () => {
  for (const sampleRate of [32_000, 48_000]) {
    const seconds = 1.5;
    const midis = chordMidi(7, 'major');
    const signal = Float32Array.from({ length: Math.floor(sampleRate * seconds) }, (_, index) =>
      midis.reduce((sum, midi) => sum + 0.22 * Math.sin(2 * Math.PI * hz(midi) * index / sampleRate), 0));
    assert.equal(analyze(signal, sampleRate).segments[0]?.chord, 'G major');
    const map = analyzePcmListening({ sampleRate, channels: [signal, signal] },
      { id: `stereo-${sampleRate}`, filename: 'stereo.wav', mimeType: 'audio/wav' });
    assert.equal(map.harmonyAnalysis?.segments[0]?.chord, 'G major');
  }
});

test('ZlandAudioMap, AudioWorld, and FerrisWheel share one exact chord timeline', () => {
  const signal = concatenate(chord(0, 'major'), chord(9, 'minor'));
  const map = analyzePcmListening({ sampleRate: SAMPLE_RATE, channels: [signal] },
    { id: 'harmony-chain', filename: 'harmony.wav', mimeType: 'audio/wav' });
  assert.equal(map.capabilities.harmony, true);
  const world = createAudioWorld(map);
  const initial = world.read({ time: 0, duration: map.duration, playing: false });
  assert.deepEqual(initial.snapshot.harmony.pitchClasses, [0, 4, 7]);
  const crossed = world.read({ time: 1.7, duration: map.duration, playing: true });
  assert.equal(crossed.snapshot.harmony.chord, 'A minor');
  assert.ok(crossed.events.some(event => event.type === 'chord-change' && event.harmony?.chord === 'A minor'));
  const wheel = createFerrisWheelSimulation();
  wheel.accept(toFerrisWheelInput(crossed), 0);
  assert.deepEqual(wheel.read().activeCabinIds, [...crossed.snapshot.harmony.pitchClasses].sort((a, b) => a - b));
});

test('seek resolves target harmony without replaying skipped chord changes', () => {
  const signal = concatenate(chord(0, 'major'), chord(9, 'minor'), chord(5, 'major'), chord(7, 'major'));
  const map = analyzePcmListening({ sampleRate: SAMPLE_RATE, channels: [signal] },
    { id: 'harmony-seek', filename: 'harmony.wav', mimeType: 'audio/wav' });
  const world = createAudioWorld(map);
  world.read({ time: 0, duration: map.duration, playing: false });
  const sought = world.synchronize(0, { time: 4.8, duration: map.duration, playing: false });
  assert.deepEqual(sought.events, [{ type: 'seek', from: 0, to: 4.8 }]);
  assert.equal(sought.snapshot.harmony.chord, 'G major');
  const wheel = createFerrisWheelSimulation();
  wheel.accept(toFerrisWheelInput(sought), 0);
  assert.deepEqual(wheel.read().activeCabinIds, [...sought.snapshot.harmony.pitchClasses].sort((a, b) => a - b));
});

test('real harmony coexists with melody, rhythm, and spectrum without fabricating other domains', () => {
  const pulseChord = chord(0, 'major', 4);
  for (let beat = 0; beat < 8; beat += 1) {
    const start = Math.floor(beat * 0.5 * SAMPLE_RATE);
    for (let index = 0; index < 240 && start + index < pulseChord.length; index += 1) {
      pulseChord[start + index] += 0.35 * (1 - index / 240);
    }
  }
  const map = analyzePcmListening({ sampleRate: SAMPLE_RATE, channels: [pulseChord] },
    { id: 'coexistence', filename: 'coexistence.wav', mimeType: 'audio/wav' });
  assert.equal(map.capabilities.harmony, true);
  assert.equal(map.capabilities.spectrum, true);
  assert.equal(map.capabilities.structure, false);
  assert.equal(map.percussion, null);
  assert.equal('structure' in map, false);
});

test('authored harmony lookup remains unchanged', async () => {
  const { milestoneSevenZlandAudioMap } = await import('../apps/zland/src/audio/ZlandAudioMaps.ts');
  const harmony = lookupSnapshot(milestoneSevenZlandAudioMap,
    { time: 2, duration: milestoneSevenZlandAudioMap.duration, playing: false }).harmony;
  assert.equal(harmony.chord, 'C major');
  assert.deepEqual(harmony.pitchClasses, [0, 4, 7]);
});
