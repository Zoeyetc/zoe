import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzePcmAudio } from '../src/audio/analysis/AudioAnalysis.ts';
import { analyzeRhythm, type RhythmEnvelopeFrame } from '@computational-listening/engine';
import { createPreviewAudioClock } from '../src/audio/AudioClock.ts';
import { createAudioWorld, lookupSnapshot } from '../src/audio/AudioWorld.ts';
import { toBumperCarsInput } from '../src/rides/bumper-cars/adapter.ts';
import { toPirateShipInput } from '../src/rides/pirate-ship/adapter.ts';
import { createPirateShipSimulation } from '../src/rides/pirate-ship/simulation.ts';

const hop = 0.02;
const envelope = (
  bpm: number,
  duration = 8,
  options: { jitter?: number; subdivision?: number | null } = {},
): RhythmEnvelopeFrame[] => {
  const values = Array.from({ length: Math.ceil(duration / hop) }, (_, index) => ({
    time: index * hop, onsetStrength: 0,
  }));
  const interval = 60 / bpm;
  let beatIndex = 0;
  for (let time = 0.2; time < duration; time += interval, beatIndex += 1) {
    const jitter = options.jitter ? ((beatIndex % 3) - 1) * options.jitter : 0;
    const frame = Math.round((time + jitter) / hop);
    if (values[frame]) values[frame] = { ...values[frame], onsetStrength: 1 };
    if (options.subdivision !== null && options.subdivision !== undefined) {
      const offbeat = Math.round((time + interval * options.subdivision) / hop);
      if (values[offbeat]) values[offbeat] = { ...values[offbeat], onsetStrength: 0.62 };
    }
  }
  return values;
};

const pcmClicks = (sampleRate: number, duration: number, bpm: number) => {
  const samples = new Float32Array(Math.floor(sampleRate * duration));
  const interval = 60 / bpm;
  for (let time = 0.2; time < duration; time += interval) {
    const start = Math.round(time * sampleRate);
    for (let index = 0; index < Math.floor(sampleRate * 0.018) && start + index < samples.length; index += 1) {
      const window = 0.5 - 0.5 * Math.cos(2 * Math.PI * index / Math.floor(sampleRate * 0.018));
      samples[start + index] += window * Math.sin(2 * Math.PI * 1_200 * index / sampleRate) * 0.9;
    }
  }
  return samples;
};

test('synthetic 120 and 90 BPM envelopes produce confident matching tempo and monotonic beats', () => {
  for (const bpm of [120, 90]) {
    const result = analyzeRhythm(envelope(bpm), 8, hop);
    assert.equal(result.available, true);
    assert.ok(Math.abs((result.bpm ?? 0) - bpm) <= 1);
    assert.ok(result.confidence >= 0.62);
    assert.ok(result.beats.length >= 8);
    assert.ok(result.beats.every((beat, index, beats) => index === 0 || beat.time > beats[index - 1].time));
    const spacings = result.beats.slice(1).map((beat, index) => beat.time - result.beats[index].time);
    assert.ok(spacings.every(spacing => Math.abs(spacing - 60 / bpm) < 0.08));
  }
});

test('slight deterministic timing jitter remains trackable and deterministic', () => {
  const input = envelope(120, 8, { jitter: 0.015 });
  const first = analyzeRhythm(input, 8, hop);
  const second = analyzeRhythm(input, 8, hop);
  assert.deepEqual(first, second);
  assert.equal(first.available, true);
  assert.ok(Math.abs((first.bpm ?? 0) - 120) <= 2);
  assert.ok(first.groove > 0);
});

test('grounded subdivision timing distinguishes straight and swung evidence', () => {
  const straight = analyzeRhythm(envelope(120, 8, { subdivision: 0.5 }), 8, hop);
  const swung = analyzeRhythm(envelope(120, 8, { subdivision: 2 / 3 }), 8, hop);
  assert.equal(straight.available, true);
  assert.equal(swung.available, true);
  assert.ok(straight.swing < 0.1);
  assert.ok(swung.swing > straight.swing + 0.25);
  assert.ok(swung.swingConfidence > 0.5);
});

test('silence, deterministic noise, and insufficient duration do not fabricate rhythm', () => {
  const silence = Array.from({ length: 400 }, (_, index) => ({ time: index * hop, onsetStrength: 0 }));
  let seed = 12345;
  const noise = Array.from({ length: 400 }, (_, index) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return { time: index * hop, onsetStrength: seed / 0xffffffff };
  });
  assert.equal(analyzeRhythm(silence, 8, hop).available, false);
  assert.equal(analyzeRhythm(noise, 8, hop).available, false);
  assert.equal(analyzeRhythm(envelope(120, 2), 2, hop).available, false);
});

test('half/double-time ambiguity uses direct recurring onset support', () => {
  const result = analyzeRhythm(envelope(120, 10), 10, hop);
  assert.equal(result.bpm, 120);
  assert.ok(result.tempoCandidates.some(candidate => Math.abs(candidate.bpm - 60) <= 1));
});

test('PCM analysis reuses the 9A onset pipeline and enables only spectrum plus confident rhythm', () => {
  const sampleRate = 48_000;
  const map = analyzePcmAudio({ sampleRate, channels: [pcmClicks(sampleRate, 8, 120)] }, {
    id: 'rhythm-pcm', filename: 'rhythm.wav', mimeType: 'audio/wav',
  });
  assert.equal(map.capabilities.spectrum, true);
  assert.equal(map.capabilities.rhythm, true);
  assert.equal(map.capabilities.melody, false);
  assert.equal(map.capabilities.harmony, false);
  assert.equal(map.capabilities.structure, false);
  assert.equal(map.percussion, null);
  assert.ok(Math.abs((map.rhythmAnalysis?.bpm ?? 0) - 120) <= 2);
});

test('AudioWorld derives phase from beat timestamps across pause, seek, restart, and end', () => {
  const sampleRate = 48_000;
  const map = analyzePcmAudio({ sampleRate, channels: [pcmClicks(sampleRate, 8, 120)] }, {
    id: 'rhythm-world', filename: 'rhythm.wav', mimeType: 'audio/wav',
  });
  let now = 0;
  const clock = createPreviewAudioClock(map.duration, () => now);
  const world = createAudioWorld(map);
  clock.seek(1.35);
  const paused = world.synchronize(0, clock.read()).snapshot.rhythm;
  now = 4;
  assert.equal(world.read(clock.read()).snapshot.rhythm.beatPhase, paused.beatPhase);
  clock.play(); now = 4.2;
  const resumed = world.read(clock.read()).snapshot.rhythm;
  assert.ok(resumed.beatPhase >= 0 && resumed.beatPhase < 1);
  assert.notEqual(resumed.beatPhase, paused.beatPhase);
  clock.seek(2.6);
  const sought = world.synchronize(1.55, clock.read()).snapshot.rhythm;
  assert.ok(sought.beatPhase >= 0 && sought.beatPhase < 1);
  clock.restart();
  const restarted = world.synchronize(2.6, clock.read()).snapshot.rhythm;
  assert.ok(restarted.beatPhase >= 0 && restarted.beatPhase < 1);
  clock.seek(map.duration);
  assert.equal(world.synchronize(0, clock.read()).snapshot.rhythm.available, true);
});

test('real rhythm wakes PirateShip through AudioWorld while beat events cannot wake BumperCars', () => {
  const sampleRate = 48_000;
  const map = analyzePcmAudio({ sampleRate, channels: [pcmClicks(sampleRate, 8, 120)] }, {
    id: 'rhythm-actors', filename: 'rhythm.wav', mimeType: 'audio/wav',
  });
  const world = createAudioWorld(map);
  world.read({ time: 0, duration: map.duration, playing: true });
  const frame = world.read({ time: 1.4, duration: map.duration, playing: true });
  assert.ok(frame.events.some(event => event.type === 'beat'));
  const pirateInput = toPirateShipInput(frame);
  assert.equal(pirateInput.rhythmAvailable, true);
  const pirate = createPirateShipSimulation();
  pirate.accept(pirateInput, 0.1);
  assert.equal(pirate.read().mode, 'active');
  const bumperInput = toBumperCarsInput(frame);
  assert.equal(bumperInput.percussionAvailable, false);
  assert.deepEqual(bumperInput.events, []);
});

test('AudioWorld reads the correct phase region directly after a seek', () => {
  const sampleRate = 48_000;
  const map = analyzePcmAudio({ sampleRate, channels: [pcmClicks(sampleRate, 8, 90)] }, {
    id: 'rhythm-seek', filename: 'rhythm.wav', mimeType: 'audio/wav',
  });
  const atA = lookupSnapshot(map, { time: 1.1, duration: map.duration, playing: false }).rhythm;
  const atB = lookupSnapshot(map, { time: 1.4, duration: map.duration, playing: false }).rhythm;
  assert.notEqual(atA.beatPhase, atB.beatPhase);
  assert.ok(atA.beatPhase >= 0 && atA.beatPhase < 1);
  assert.ok(atB.beatPhase >= 0 && atB.beatPhase < 1);
});


const multiBandEnvelope = (bpm: number, duration = 12, options: { highSubdivision?: number; energyPulse?: boolean } = {}) => {
  const values: RhythmEnvelopeFrame[] = Array.from({ length: Math.ceil(duration / hop) }, (_, index) => ({
    time: index * hop, onsetStrength: 0, fullBandOnset: 0, lowBandOnset: 0, highBandOnset: 0,
    energy: options.energyPulse ? 0.25 + 0.12 * Math.cos(2 * Math.PI * index * hop / (60 / bpm)) : 0,
  }));
  const interval = 60 / bpm;
  for (let time = 0.2; time < duration; time += interval) {
    const frame = Math.round(time / hop);
    if (values[frame]) values[frame] = { ...values[frame], onsetStrength: 0.86, fullBandOnset: 0.86, lowBandOnset: 1 };
    const subdivisions = options.highSubdivision ?? 0;
    for (let subdivision = 1; subdivision < subdivisions; subdivision += 1) {
      const highFrame = Math.round((time + interval * subdivision / subdivisions) / hop);
      if (values[highFrame]) values[highFrame] = { ...values[highFrame],
        onsetStrength: Math.max(values[highFrame].onsetStrength, 0.72),
        fullBandOnset: Math.max(values[highFrame].fullBandOnset ?? 0, 0.72), highBandOnset: 1 };
    }
  }
  return values;
};

test('multi-band evidence keeps a 120 BPM low/full pulse primary over 240-equivalent high subdivisions', () => {
  const result = analyzeRhythm(multiBandEnvelope(120, 12, { highSubdivision: 2, energyPulse: true }), 12, hop);
  assert.equal(result.available, true);
  assert.ok(Math.abs((result.bpm ?? 0) - 120) <= 1);
  assert.ok(result.evidence.lowBandSupport > 0.5);
  assert.ok(result.evidence.subdivisionSupport > 0.4);
  assert.ok(result.evidence.energyPulseSupport > 0.4);
});

test('tempo-family handling resolves a 70/140 family from main-grid coverage', () => {
  const result = analyzeRhythm(multiBandEnvelope(140, 12, { highSubdivision: 2 }), 12, hop);
  assert.equal(result.available, true);
  assert.ok(Math.abs((result.bpm ?? 0) - 140) <= 2);
  assert.ok(result.tempoCandidates.some(candidate => Math.abs(candidate.bpm - 70) <= 1));
  assert.ok(result.tempoCandidates.some(candidate => Math.abs(candidate.bpm - 140) <= 2));
});

test('energy pumping supports but cannot create rhythm without onset anchors', () => {
  const pulse = 60 / 120;
  const energyOnly: RhythmEnvelopeFrame[] = Array.from({ length: 600 }, (_, index) => ({
    time: index * hop, onsetStrength: 0, fullBandOnset: 0, lowBandOnset: 0, highBandOnset: 0,
    energy: 0.4 + 0.25 * Math.cos(2 * Math.PI * index * hop / pulse),
  }));
  assert.equal(analyzeRhythm(energyOnly, 12, hop).available, false);
});

test('multi-band rhythm diagnostics and tempo scores stay finite and bounded', () => {
  const result = analyzeRhythm(multiBandEnvelope(120, 12, { highSubdivision: 4, energyPulse: true }), 12, hop);
  assert.ok(Object.values(result.evidence).every(value => Number.isFinite(value) && value >= 0));
  assert.ok(result.tempoCandidates.every(candidate => [candidate.score, candidate.fullBandPeriodicity,
    candidate.lowBandPeriodicity, candidate.subdivisionSupport, candidate.energyPulseSupport,
    candidate.gridSupport, candidate.ambiguityPenalty].every(value => Number.isFinite(value) && value >= 0 && value <= 1)));
  assert.ok(result.beats.every((beat, index, beats) => index === 0 || beat.time > beats[index - 1].time));
});
