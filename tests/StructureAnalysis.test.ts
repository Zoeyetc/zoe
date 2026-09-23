import assert from 'node:assert/strict';
import test from 'node:test';
import { milestoneOneAudioMap } from '../src/audio/AudioMap.ts';
import { createAudioWorld, lookupSnapshot } from '../src/audio/AudioWorld.ts';
import { analyzeStructure, type StructureSourceFrame } from '../src/audio/analysis/StructureAnalysis.ts';
import { analyzePcmAudio } from '../src/audio/analysis/AudioAnalysis.ts';
import { toDropTowerInput } from '../src/rides/drop-tower/adapter.ts';
import { toRollerCoasterInput } from '../src/rides/roller-coaster/adapter.ts';
import type { AudioMap, BeatMarker } from '../src/audio/types.ts';

type SectionName = 'A' | 'B' | 'C' | 'Aprime';
const SECTION = {
  A: { root: 0, bands: [0.62, 0.28, 0.1], brightness: 0.18, texture: 0.18 },
  Aprime: { root: 0, bands: [0.48, 0.34, 0.18], brightness: 0.27, texture: 0.28 },
  B: { root: 5, bands: [0.18, 0.64, 0.18], brightness: 0.42, texture: 0.38 },
  C: { root: 9, bands: [0.1, 0.28, 0.62], brightness: 0.72, texture: 0.58 },
} as const;

function fixture(sequence: readonly SectionName[], options: { energy?: readonly number[]; beats?: boolean } = {}) {
  const frames: StructureSourceFrame[] = [];
  let time = 0;
  sequence.forEach((name, sectionIndex) => {
    const section = SECTION[name];
    for (let local = 0; local < 12; local += 1, time += 1) {
      const chroma = Array(12).fill(0);
      chroma[section.root] = 1; chroma[(section.root + 4) % 12] = 0.65; chroma[(section.root + 7) % 12] = 0.75;
      if (name === 'Aprime') chroma[2] = 0.72;
      frames.push({ time, chroma, low: section.bands[0], mid: section.bands[1], high: section.bands[2],
        brightness: section.brightness, texture: section.texture,
        rms: options.energy?.[sectionIndex] ?? 0.52, onsetStrength: 0.24 });
    }
  });
  const beats: BeatMarker[] | null = options.beats === false ? null : frames.map((_, index) => ({
    id: `beat-${index}`, index, time: index, strength: 1,
  }));
  return { frames, duration: time, beats };
}

const analyzeFixture = (sequence: readonly SectionName[], options?: { energy?: readonly number[]; beats?: boolean }) => {
  const value = fixture(sequence, options);
  return analyzeStructure(value.frames, value.duration, value.beats);
};

test('A to B produces one internal boundary and two valid monotonic sections', () => {
  const result = analyzeFixture(['A', 'B']);
  assert.equal(result.available, true);
  assert.equal(result.boundaries.length, 1);
  assert.equal(result.segments.length, 2);
  assert.ok(Math.abs(result.boundaries[0].time - 12) <= 1);
  assert.ok(result.segments.every((segment, index) => segment.end > segment.start
    && (index === 0 || segment.start >= result.segments[index - 1].end)));
});

test('A to B to A recurs as the same family and A-prime remains a variation', () => {
  const exact = analyzeFixture(['A', 'B', 'A']);
  assert.equal(exact.segments.length, 3);
  assert.equal(exact.segments[0].recurrenceGroup, exact.segments[2].recurrenceGroup);
  assert.equal(exact.segments[2].label, 'A');
  const varied = analyzeFixture(['A', 'B', 'Aprime']);
  assert.equal(varied.segments.length, 3);
  assert.equal(varied.segments[0].recurrenceGroup, varied.segments[2].recurrenceGroup);
  assert.equal(varied.segments[2].label, 'A′');
});

test('A to B to C creates three distinct recurrence groups', () => {
  const result = analyzeFixture(['A', 'B', 'C']);
  assert.deepEqual(result.segments.map(segment => segment.recurrenceGroup), ['A', 'B', 'C']);
});

test('unchanged repeated material does not fabricate a boundary', () => {
  const result = analyzeFixture(['A', 'A']);
  assert.equal(result.boundaries.length, 0);
  assert.equal(result.available, false);
});

test('energy-only change does not imply structure while harmonic contrast does', () => {
  const energyOnly = analyzeFixture(['A', 'A'], { energy: [0.15, 0.9] });
  const harmonic = analyzeFixture(['A', 'B'], { energy: [0.5, 0.5] });
  assert.equal(energyOnly.boundaries.length, 0);
  assert.equal(harmonic.boundaries.length, 1);
  assert.ok(Math.max(...harmonic.novelty) > Math.max(...energyOnly.novelty));
});

test('slow and abrupt transition fixtures produce finite deterministic novelty evidence', () => {
  const abruptFixture = fixture(['A', 'B']);
  const slowFrames = Array.from({ length: 24 }, (_, time): StructureSourceFrame => {
    const mix = Math.max(0, Math.min(1, (time - 8) / 8));
    const chromaA = Array(12).fill(0); chromaA[0] = 1; chromaA[4] = 0.65; chromaA[7] = 0.75;
    const chromaB = Array(12).fill(0); chromaB[5] = 1; chromaB[9] = 0.65; chromaB[0] = 0.75;
    return { time, chroma: chromaA.map((value, index) => value * (1 - mix) + chromaB[index] * mix),
      low: 0.62 * (1 - mix) + 0.18 * mix, mid: 0.28 * (1 - mix) + 0.64 * mix,
      high: 0.1 * (1 - mix) + 0.18 * mix, brightness: 0.18 * (1 - mix) + 0.42 * mix,
      texture: 0.18 * (1 - mix) + 0.38 * mix, rms: 0.52, onsetStrength: 0.24 };
  });
  const abrupt = analyzeStructure(abruptFixture.frames, abruptFixture.duration, null);
  const slow = analyzeStructure(slowFrames, 24, null);
  assert.ok([...abrupt.novelty, ...slow.novelty].every(value => Number.isFinite(value) && value >= 0 && value <= 1));
  assert.deepEqual(slow, analyzeStructure(slowFrames, 24, null));
});

test('different loudness preserves recurrence family', () => {
  const result = analyzeFixture(['A', 'B', 'A'], { energy: [0.2, 0.5, 0.9] });
  assert.equal(result.segments[0].recurrenceGroup, result.segments[2].recurrenceGroup);
});

test('all structural metrics are finite and bounded and minimum duration is enforced', () => {
  const result = analyzeFixture(['A', 'B', 'C']);
  assert.ok(result.boundaries.every(boundary => Number.isFinite(boundary.confidence)
    && boundary.confidence >= 0 && boundary.confidence <= 1));
  assert.ok(result.segments.every(segment => segment.end - segment.start >= 4
    && [segment.confidence, segment.energy, segment.contrast, segment.importance]
      .every(value => Number.isFinite(value) && value >= 0 && value <= 1)));
});

test('silence, short input, and incoherent deterministic noise remain unavailable', () => {
  const silence = Array.from({ length: 24 }, (_, time): StructureSourceFrame => ({ time, chroma: Array(12).fill(0),
    low: 0, mid: 0, high: 0, brightness: 0, texture: 0, rms: 0, onsetStrength: 0 }));
  const short = fixture(['A']).frames.slice(0, 2);
  let seed = 17;
  const noise = Array.from({ length: 30 }, (_, time): StructureSourceFrame => {
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff);
    return { time, chroma: Array.from({ length: 12 }, random), low: random(), mid: random(), high: random(),
      brightness: random(), texture: random(), rms: 0.5, onsetStrength: random() };
  });
  assert.equal(analyzeStructure(silence, 24, null).available, false);
  assert.equal(analyzeStructure(short, 2, null).available, false);
  assert.equal(analyzeStructure(noise, 30, null).available, false);
});

test('analysis is deterministic and uses beat or fallback aggregation explicitly', () => {
  const value = fixture(['A', 'B', 'A']);
  const first = analyzeStructure(value.frames, value.duration, value.beats);
  assert.deepEqual(first, analyzeStructure(value.frames, value.duration, value.beats));
  assert.equal(first.aggregationMode, 'beat-synchronous');
  const fallback = analyzeStructure(value.frames, value.duration, null);
  assert.equal(fallback.aggregationMode, 'time-fallback');
  assert.equal(fallback.available, true);
});

test('AudioWorld resolves current analyzed section and crosses section-change only during forward playback', () => {
  const structureAnalysis = analyzeFixture(['A', 'B', 'A']);
  const map: AudioMap = { ...milestoneOneAudioMap, id: 'structure-world', duration: 36,
    capabilities: { ...milestoneOneAudioMap.capabilities, structure: true },
    melody: null, structure: null, structureAnalysis };
  const middle = lookupSnapshot(map, { time: 15, duration: 36, playing: true }).structure;
  assert.equal(middle.source, 'analysis');
  assert.equal(middle.label, 'B');
  assert.ok(middle.sectionProgress > 0 && middle.sectionProgress < 1);
  const world = createAudioWorld(map);
  world.read({ time: 0, duration: 36, playing: true });
  assert.deepEqual(world.read({ time: 25, duration: 36, playing: true }).events
    .filter(event => event.type === 'section-change').map(event => event.structure.label), ['B', 'A']);
  const seek = world.synchronize(25, { time: 15, duration: 36, playing: false });
  assert.deepEqual(seek.events, [{ type: 'seek', from: 25, to: 15 }]);
  assert.equal(seek.snapshot.structure.label, 'B');
});

test('real analyzed structure remains isolated from authored-only base adapters', () => {
  const structureAnalysis = analyzeFixture(['A', 'B']);
  const map: AudioMap = { ...milestoneOneAudioMap, id: 'structure-actor-isolation', duration: 24,
    capabilities: { ...milestoneOneAudioMap.capabilities, structure: true },
    melody: null, structure: null, structureAnalysis };
  const frame = { snapshot: lookupSnapshot(map, { time: 14, duration: 24, playing: true }), events: [] };
  assert.equal(frame.snapshot.structure.available, true);
  assert.equal(toDropTowerInput(frame).structureAvailable, false);
  assert.equal(toRollerCoasterInput(frame).structureAvailable, false);
});

test('full PCM pipeline derives beat-synchronous A-B-A structure without copyrighted audio', () => {
  const sampleRate = 12_000;
  const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
  const notes = { A: [60, 64, 67], B: [66, 70, 73] } as const;
  const signal = new Float32Array(sampleRate * 24);
  (['A', 'B', 'A'] as const).forEach((name, sectionIndex) => {
    for (let index = 0; index < sampleRate * 8; index += 1) {
      const time = index / sampleRate;
      const pulse = index % (sampleRate / 2);
      signal[sectionIndex * sampleRate * 8 + index] = notes[name].reduce((sum, midi, voice) =>
        sum + 0.16 * Math.sin(2 * Math.PI * hz(midi) * time + voice * 0.31), 0)
        + (pulse < 180 ? 0.35 * (1 - pulse / 180) : 0);
    }
  });
  const map = analyzePcmAudio({ sampleRate, channels: [signal] },
    { id: 'generated-aba', filename: 'generated-aba.wav', mimeType: 'audio/wav' });
  assert.equal(map.capabilities.structure, true);
  assert.equal(map.structureAnalysis?.aggregationMode, 'beat-synchronous');
  assert.deepEqual(map.structureAnalysis?.segments.map(segment => segment.recurrenceGroup), ['A', 'B', 'A']);
  assert.equal(map.structure, null);
  assert.equal(map.drops, null);
});

function repetitiveFixture(duration = 96, mutate?: (frame: StructureSourceFrame, time: number) => StructureSourceFrame) {
  const frames = Array.from({ length: duration }, (_, time): StructureSourceFrame => {
    const chroma = Array(12).fill(0); chroma[0] = 1; chroma[4] = 0.65; chroma[7] = 0.75;
    const frame = { time, chroma, low: 0.58, mid: 0.3, high: 0.12,
      brightness: 0.2, texture: 0.18, rms: 0.5, onsetStrength: 0.24 };
    return mutate?.(frame, time) ?? frame;
  });
  const beats: BeatMarker[] = frames.map((_, index) => ({ id: `repeat-beat-${index}`, index, time: index, strength: 1 }));
  return { frames, beats, duration };
}

test('unchanged long repeated loop stays free of macro-section spam', () => {
  const input = repetitiveFixture(128);
  const result = analyzeStructure(input.frames, input.duration, input.beats);
  assert.equal(result.boundaries.length, 0);
  assert.equal(result.segments.length, 0);
  assert.equal(result.available, false);
});

test('high-band and brightness layer changes remain arrangement evidence instead of A/B/C/D sections', () => {
  const input = repetitiveFixture(96, (frame, time) => {
    const layer = Math.floor(time / 12) % 2;
    return layer ? { ...frame, high: 0.42, brightness: 0.66, texture: 0.46, onsetStrength: 0.62 } : frame;
  });
  const result = analyzeStructure(input.frames, input.duration, input.beats);
  assert.ok(result.arrangementChanges.length >= 2);
  assert.ok(result.boundaries.length <= 2);
  assert.ok(result.arrangementChanges.length > result.boundaries.length);
});

test('filter-only and local texture changes prefer arrangement changes', () => {
  for (const key of ['brightness', 'texture'] as const) {
    const input = repetitiveFixture(48, (frame, time) => time >= 16 && time < 24 ? { ...frame, [key]: 0.88 } : frame);
    const result = analyzeStructure(input.frames, input.duration, input.beats);
    assert.ok(result.arrangementChanges.length >= 1);
    assert.equal(result.boundaries.length, 0);
  }
});

test('multiple local arrangement changes inside A do not create section-label spam', () => {
  const input = repetitiveFixture(80, (frame, time) => {
    const local = Math.floor(time / 8) % 2;
    return local ? { ...frame, brightness: 0.58, texture: 0.42 } : frame;
  });
  const result = analyzeStructure(input.frames, input.duration, input.beats);
  assert.ok(result.arrangementChanges.length >= 4);
  assert.ok(result.boundaries.length <= 1);
});

test('a gradual energy build can remain inside one structural section', () => {
  const input = repetitiveFixture(64, (frame, time) => ({ ...frame, rms: 0.18 + time / 64 * 0.7 }));
  const result = analyzeStructure(input.frames, input.duration, input.beats);
  assert.equal(result.boundaries.length, 0);
});

test('major macro contrast creates a section while short novelty alone does not', () => {
  const local = repetitiveFixture(48, (frame, time) => time >= 20 && time < 24
    ? { ...frame, brightness: 0.9, texture: 0.8 } : frame);
  const localResult = analyzeStructure(local.frames, local.duration, local.beats);
  const macro = fixture(['A', 'B']);
  const macroResult = analyzeStructure(macro.frames, macro.duration, macro.beats);
  assert.ok(Math.max(...localResult.noveltyScales.short) > 0.5);
  assert.equal(localResult.boundaries.length, 0);
  assert.equal(macroResult.boundaries.length, 1);
  assert.ok(macroResult.boundaries[0].longNovelty >= macroResult.boundaries[0].shortNovelty * 0.5);
});

test('arrangement spacing, structural duration, snapping, and grid bonus stay bounded', () => {
  const input = fixture(['A', 'B', 'A']);
  const result = analyzeStructure(input.frames, input.duration, input.beats);
  assert.ok(result.arrangementChanges.every((change, index, values) => index === 0
    || change.time - values[index - 1].time >= result.metadata.minimumArrangementSpacing));
  assert.ok(result.segments.every(segment => segment.end - segment.start >= result.metadata.minimumSectionDuration
    || segment.startBoundaryConfidence >= 0.86));
  assert.ok(result.boundaries.every(boundary => boundary.gridAlignmentBonus >= 0 && boundary.gridAlignmentBonus <= 0.1));
  assert.equal(result.metadata.boundarySnapMaximumBins, 1);
});

test('arrangement evidence is analysis-only and does not add AudioWorld section events', () => {
  const input = repetitiveFixture(48, (frame, time) => time >= 16 && time < 24 ? { ...frame, brightness: 0.9 } : frame);
  const structureAnalysis = analyzeStructure(input.frames, input.duration, input.beats);
  assert.ok(structureAnalysis.arrangementChanges.length > 0);
  const map: AudioMap = { ...milestoneOneAudioMap, id: 'arrangement-world', duration: 48,
    capabilities: { ...milestoneOneAudioMap.capabilities, structure: structureAnalysis.available },
    melody: null, structure: null, structureAnalysis };
  const world = createAudioWorld(map);
  world.read({ time: 0, duration: 48, playing: true });
  assert.equal(world.read({ time: 32, duration: 48, playing: true }).events
    .filter(event => event.type === 'section-change').length, structureAnalysis.boundaries.length);
});

test('multi-scale structure values and arrangement contributions remain finite and bounded', () => {
  const input = repetitiveFixture(64, (frame, time) => time >= 24
    ? { ...frame, brightness: 0.7, texture: 0.55, high: 0.4 } : frame);
  const result = analyzeStructure(input.frames, input.duration, null);
  assert.ok([...result.noveltyScales.short, ...result.noveltyScales.medium, ...result.noveltyScales.long]
    .every(value => Number.isFinite(value) && value >= 0 && value <= 1));
  assert.ok(result.arrangementChanges.every(change => [change.confidence, change.magnitude,
    ...Object.values(change.featureContributions)].every(value => Number.isFinite(value) && value >= 0 && value <= 1)));
  assert.equal(result.aggregationMode, 'time-fallback');
});
