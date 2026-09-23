import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeMelody } from '../src/audio/analysis/MelodyAnalysis.ts';
import { analyzePcmAudio } from '../src/audio/analysis/AudioAnalysis.ts';
import { createAudioWorld, lookupSnapshot } from '../src/audio/AudioWorld.ts';
import { toCarouselInput } from '../src/rides/carousel/adapter.ts';
import { createCarouselSimulation } from '../src/rides/carousel/simulation.ts';

const SAMPLE_RATE = 48_000;
const source = { id: 'melody-test', filename: 'melody-test.wav', mimeType: 'audio/wav' };
const tone = (frequency: number, seconds: number, gain = 0.8) => Float32Array.from(
  { length: Math.floor(SAMPLE_RATE * seconds) },
  (_, index) => gain * Math.sin(2 * Math.PI * frequency * index / SAMPLE_RATE),
);
const silence = (seconds: number) => new Float32Array(Math.floor(SAMPLE_RATE * seconds));
const concat = (...signals: readonly Float32Array[]) => {
  const result = new Float32Array(signals.reduce((sum, signal) => sum + signal.length, 0));
  let offset = 0;
  for (const signal of signals) { result.set(signal, offset); offset += signal.length; }
  return result;
};
const analyze = (mono: Float32Array) => analyzeMelody({ mono, sampleRate: SAMPLE_RATE });

function deterministicNoise(seconds: number) {
  let state = 0x12345678;
  return Float32Array.from({ length: Math.floor(SAMPLE_RATE * seconds) }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return ((state / 0xffffffff) * 2 - 1) * 0.45;
  });
}

test('pure A4 and C4 produce finite predominant pitch and standard MIDI identity', () => {
  const a4 = analyze(tone(440, 1));
  const c4 = analyze(tone(261.6256, 1));
  assert.equal(a4.available, true);
  assert.equal(a4.notes[0]?.midi, 69);
  assert.equal(a4.notes[0]?.noteName, 'A4');
  assert.ok(Math.abs((a4.notes[0]?.pitchHz ?? 0) - 440) < 2);
  assert.equal(c4.notes[0]?.midi, 60);
  assert.equal(c4.notes[0]?.noteName, 'C4');
  for (const frame of [...a4.contour, ...c4.contour]) {
    assert.ok(Number.isFinite(frame.time));
    assert.ok(frame.confidence >= 0 && frame.confidence <= 1);
    if (frame.voiced) assert.ok(frame.pitchHz! >= 80 && frame.pitchHz! <= 1400);
  }
});

test('C4 to E4 to G4 segments into a monotonic non-overlapping note timeline', () => {
  const result = analyze(concat(tone(261.6256, 0.5), tone(329.6276, 0.5), tone(391.9954, 0.5)));
  assert.deepEqual(result.notes.map(note => note.noteName), ['C4', 'E4', 'G4']);
  for (let index = 0; index < result.notes.length; index += 1) {
    const note = result.notes[index];
    assert.ok(note.end > note.start);
    if (index) assert.ok(result.notes[index - 1].end <= note.start);
  }
});

test('vibrato remains one note and preserves a varying continuous contour', () => {
  const vibrato = Float32Array.from({ length: SAMPLE_RATE }, (_, index) => {
    const time = index / SAMPLE_RATE;
    const phase = 2 * Math.PI * 440 * time + 2.2 * Math.sin(2 * Math.PI * 5 * time);
    return 0.8 * Math.sin(phase);
  });
  const result = analyze(vibrato);
  assert.equal(result.notes.length, 1);
  assert.equal(result.notes[0]?.noteName, 'A4');
  const voicedMidi = result.contour.flatMap(frame => frame.midiFloat === null ? [] : [frame.midiFloat]);
  assert.ok(Math.max(...voicedMidi) - Math.min(...voicedMidi) > 0.5);
});

test('brief same-pitch gap merges while a meaningful silence creates distinct notes', () => {
  const brief = analyze(concat(tone(440, 0.45), silence(0.04), tone(440, 0.45)));
  const separated = analyze(concat(tone(440, 0.5), silence(0.18), tone(440, 0.5)));
  assert.equal(brief.notes.length, 1);
  assert.equal(separated.notes.length, 2);
  assert.ok(separated.notes[0].end < separated.notes[1].start);
});

test('silence, deterministic noise, and insufficient audio do not fabricate melody', () => {
  for (const signal of [silence(1), deterministicNoise(1), tone(440, 0.2)]) {
    const result = analyze(signal);
    assert.equal(result.available, false);
    assert.deepEqual(result.notes, []);
  }
});

test('low but usable pitched evidence remains distinct from confidence and intensity', () => {
  const result = analyze(tone(440, 1, 0.006));
  assert.equal(result.available, true);
  assert.equal(result.notes[0]?.midi, 69);
  assert.notEqual(result.notes[0]?.intensity, result.notes[0]?.confidence);
});

test('a louder second harmonic does not erase supported fundamental identity', () => {
  const signal = Float32Array.from({ length: SAMPLE_RATE }, (_, index) => {
    const time = index / SAMPLE_RATE;
    return 0.25 * Math.sin(2 * Math.PI * 220 * time) + 0.75 * Math.sin(2 * Math.PI * 440 * time);
  });
  const first = analyze(signal);
  const second = analyze(signal);
  assert.equal(first.notes[0]?.midi, 57);
  assert.equal(first.notes[0]?.noteName, 'A3');
  assert.deepEqual(first, second);
});

test('dominant melody survives a simple low-frequency accompaniment', () => {
  const signal = Float32Array.from({ length: SAMPLE_RATE }, (_, index) => {
    const time = index / SAMPLE_RATE;
    return 0.75 * Math.sin(2 * Math.PI * 440 * time) + 0.2 * Math.sin(2 * Math.PI * 110 * time);
  });
  const result = analyze(signal);
  assert.equal(result.available, true);
  assert.equal(result.notes[0]?.midi, 69);
});

test('continuous slide keeps contour without chromatic note chatter', () => {
  let phase = 0;
  const slide = Float32Array.from({ length: SAMPLE_RATE }, (_, index) => {
    const time = index / SAMPLE_RATE;
    const frequency = 261.6256 * 2 ** time;
    phase += 2 * Math.PI * frequency / SAMPLE_RATE;
    return 0.8 * Math.sin(phase);
  });
  const result = analyze(slide);
  const voiced = result.contour.filter(frame => frame.voiced && frame.midiFloat !== null);
  assert.ok(voiced.length > 20);
  assert.ok(voiced.at(-1)!.midiFloat! - voiced[0].midiFloat! > 8);
  assert.ok(result.notes.length <= 4);
});

test('real AudioMap drives existing AudioWorld timeline and Carousel boundary', () => {
  const signal = concat(tone(261.6256, 0.65), tone(329.6276, 0.65), tone(391.9954, 0.65));
  const map = analyzePcmAudio({ sampleRate: SAMPLE_RATE, channels: [signal] }, source);
  assert.equal(map.capabilities.melody, true);
  assert.ok((map.melodyAnalysis?.notes.length ?? 0) >= 3);
  assert.equal(map.capabilities.harmony, false);
  assert.equal(map.capabilities.structure, false);
  assert.equal(map.percussion, null);

  const world = createAudioWorld(map);
  const firstTime = map.melody![0].start + 0.02;
  const first = world.synchronize(0, { time: firstTime, duration: map.duration, playing: false });
  assert.equal(first.events.length, 1);
  assert.equal(first.events[0].type, 'seek');
  assert.equal(first.snapshot.melody.noteName, 'C4');
  assert.equal(first.snapshot.melody.midi, 60);

  const carousel = createCarouselSimulation({ pitchRange: {
    min: map.melodyAnalysis!.pitchRange.minMidi!, max: map.melodyAnalysis!.pitchRange.maxMidi!,
  } });
  carousel.accept(toCarouselInput(first), 0);
  assert.equal(carousel.read().activeMidi, 60);
  assert.equal(carousel.read().activeNoteName, 'C4');
  assert.equal(carousel.read().riders.filter(rider => rider.active).length, 1);

  const crossed = world.read({ time: map.melody![1].start + 0.02, duration: map.duration, playing: true });
  assert.deepEqual(crossed.events.filter(event => event.type === 'note-off' || event.type === 'note-on')
    .map(event => event.type), ['note-off', 'note-on']);
  assert.equal(crossed.snapshot.melody.noteName, 'E4');
});

test('pause lookup freezes note progress, seek synchronizes directly, and restart returns to timeline start', () => {
  const signal = concat(tone(261.6256, 0.65), tone(329.6276, 0.65), tone(391.9954, 0.65));
  const map = analyzePcmAudio({ sampleRate: SAMPLE_RATE, channels: [signal] }, source);
  const world = createAudioWorld(map);
  const heldTime = map.melody![0].start + 0.2;
  const pausedA = lookupSnapshot(map, { time: heldTime, duration: map.duration, playing: false });
  const pausedB = lookupSnapshot(map, { time: heldTime, duration: map.duration, playing: false });
  assert.equal(pausedA.melody.noteProgress, pausedB.melody.noteProgress);
  const target = map.melody![2].start + 0.02;
  const seek = world.synchronize(heldTime, { time: target, duration: map.duration, playing: false });
  assert.deepEqual(seek.events, [{ type: 'seek', from: heldTime, to: target }]);
  assert.equal(seek.snapshot.melody.noteName, 'G4');
  const restart = world.synchronize(target, { time: 0, duration: map.duration, playing: false });
  assert.equal(restart.events[0].type, 'seek');
  assert.equal(restart.snapshot.melody.active, false);
});
