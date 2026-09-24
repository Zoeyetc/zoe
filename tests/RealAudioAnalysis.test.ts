import assert from 'node:assert/strict';
import test from 'node:test';
import { downmixToMono } from '@computational-listening/engine';
import { analyzeZlandPcmAudio } from '../apps/zland/src/audio/analyzeZlandAudio.ts';
import { lookupSnapshot } from '../apps/zland/src/audio/AudioWorld.ts';
import { toFreeBodiesInput } from '../apps/zland/src/free-bodies/adapter.ts';

const source = { id: 'synthetic', filename: 'synthetic.wav', mimeType: 'audio/wav' };
const sine = (sampleRate: number, seconds: number, frequency: number, gain = 0.8) =>
  Float32Array.from({ length: Math.floor(sampleRate * seconds) }, (_, index) =>
    gain * Math.sin(2 * Math.PI * frequency * index / sampleRate));
const analyze = (channels: readonly Float32Array[], sampleRate = 48_000) =>
  analyzeZlandPcmAudio({ sampleRate, channels }, source);
const snapshot = (map: ReturnType<typeof analyze>, time = map.duration / 2) =>
  lookupSnapshot(map, { time, duration: map.duration, playing: false });

test('real analysis advertises only the spectrum domain', () => {
  const map = analyze([sine(48_000, 0.2, 440)]);
  assert.deepEqual(map.capabilities, {
    melody: false, rhythm: false, percussion: false, harmony: false, tonalCenter: false, structure: false, spectrum: true,
  });
  assert.equal(map.melody, null);
  assert.equal(map.rhythm, null);
  assert.equal(map.harmony, null);
  assert.equal(map.structure, null);
  assert.equal(map.source?.kind, 'real-audio');
});

test('silence produces finite stable zero evidence', () => {
  const map = analyze([new Float32Array(4_800)]);
  for (const region of map.spectrum ?? []) {
    for (const range of [region.low, region.mid, region.high, region.brightness, region.texture]) {
      for (const value of range) assert.ok(Number.isFinite(value) && value === 0);
    }
  }
  for (const region of map.amplitude ?? []) {
    for (const range of [region.rms, region.peak, region.onsetStrength]) {
      for (const value of range) assert.ok(Number.isFinite(value) && value === 0);
    }
  }
});

test('near-silence does not get amplified into false spectral activity', () => {
  const map = analyze([sine(48_000, 0.1, 440, 1e-7)]);
  const evidence = snapshot(map).spectrum;
  assert.deepEqual(
    [evidence.rms, evidence.peak, evidence.low, evidence.mid, evidence.high, evidence.brightness, evidence.texture],
    [0, 0, 0, 0, 0, 0, 0],
  );
  assert.ok((map.analysis?.normalization.rmsReference ?? 0) > 0);
});

test('fixed bands and brightness distinguish low and high sine tones', () => {
  const low = snapshot(analyze([sine(48_000, 0.5, 100)])).spectrum;
  const high = snapshot(analyze([sine(48_000, 0.5, 8_000)])).spectrum;
  assert.ok(low.low > low.high * 10);
  assert.ok(high.high > high.low * 10);
  assert.ok(high.brightness > low.brightness);
});

test('analysis is deterministic and every actor-facing value is bounded', () => {
  const signal = sine(48_000, 0.25, 2_000);
  const first = analyze([signal]);
  const second = analyze([signal]);
  assert.deepEqual(first, second);
  for (const region of first.spectrum ?? []) {
    for (const range of [region.low, region.mid, region.high, region.brightness, region.texture]) {
      for (const value of range) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
    }
  }
});

test('frequency-bin mapping derives from the actual sample rate', () => {
  for (const sampleRate of [32_000, 48_000]) {
    const low = snapshot(analyze([sine(sampleRate, 0.4, 100)], sampleRate)).spectrum;
    const high = snapshot(analyze([sine(sampleRate, 0.4, 6_000)], sampleRate)).spectrum;
    assert.ok(low.low > low.high);
    assert.ok(high.high > high.low);
    assert.equal(analyze([sine(sampleRate, 0.1, 440)], sampleRate).analysis?.sampleRate, sampleRate);
  }
});

test('multichannel analysis uses an arithmetic-mean downmix while playback data stays separate', () => {
  const left = sine(48_000, 0.1, 440);
  const right = Float32Array.from(left, value => -value);
  assert.ok(downmixToMono([left, right]).every(value => Math.abs(value) < 1e-7));
  const result = snapshot(analyze([left, right])).spectrum;
  assert.equal(result.rms, 0);
  assert.equal(result.low + result.mid + result.high, 0);
});

test('generated maps interpolate by analyzed time and feed the existing Free Bodies boundary', () => {
  const sampleRate = 48_000;
  const stepped = new Float32Array(sampleRate);
  stepped.set(sine(sampleRate, 0.5, 100, 0.05), 0);
  stepped.set(sine(sampleRate, 0.5, 8_000, 0.8), sampleRate / 2);
  const map = analyze([stepped], sampleRate);
  const early = lookupSnapshot(map, { time: 0.2, duration: map.duration, playing: false });
  const late = lookupSnapshot(map, { time: 0.8, duration: map.duration, playing: false });
  assert.ok(early.spectrum.low > early.spectrum.high);
  assert.ok(late.spectrum.high > late.spectrum.low);
  assert.ok(late.spectrum.rms > early.spectrum.rms);
  const input = toFreeBodiesInput({ snapshot: late, events: [] });
  assert.equal(input.spectrumAvailable, true);
  assert.equal(input.brightness, late.spectrum.brightness);
  assert.equal(input.texture, late.spectrum.texture);
  assert.equal(early.melody.available, map.capabilities.melody);
  assert.equal(late.harmony.active, false);
  assert.equal(late.rhythm.bpm, null);
  assert.equal(late.structure.section, null);
});
