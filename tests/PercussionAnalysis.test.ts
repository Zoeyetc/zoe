import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzePcmAudio } from '../src/audio/analysis/AudioAnalysis.ts';
import { classifyPercussion } from '../src/audio/analysis/PercussionAnalysis.ts';
import type { PercussionDescriptors, PercussionKind } from '../src/audio/types.ts';
import {
  ambiguousClap, denseHats, fourOnFloorHats, isolatedClosedHat, isolatedKick,
  isolatedOpenHat, isolatedSnare, isolatedTom, lowSine, overlappingKickSnare,
  sampleRateFixture, silence, stereoFixture, sustainedCymbal, varyingKickIntensity, whiteNoise,
} from './percussionFixtures.ts';

const source = { id: 'percussion-synthetic', filename: 'generated.wav', mimeType: 'audio/wav' };
const analyze = (pcm: ReturnType<typeof isolatedKick>) => analyzePcmAudio(pcm, source).percussionAnalysis!;
const descriptor = (overrides: Partial<PercussionDescriptors>): PercussionDescriptors => ({
  subRatio: 0.1, lowMidRatio: 0.15, midRatio: 0.25, highRatio: 0.25, airRatio: 0.25,
  centroid: 0.45, spread: 0.3, flatness: 0.35, duration: 0.1, decay: 0.8,
  onsetStrength: 0.9, highPersistence: 0.2, lowPersistence: 0.2, rms: 0.8, ...overrides,
});

const classificationCases: readonly [PercussionKind, PercussionDescriptors][] = [
  ['kick', descriptor({ subRatio: 0.72, lowMidRatio: 0.16, midRatio: 0.06, highRatio: 0.04,
    airRatio: 0.02, centroid: 0.08, flatness: 0.08, lowPersistence: 0.7 })],
  ['snare', descriptor({ subRatio: 0.03, lowMidRatio: 0.05, midRatio: 0.22, highRatio: 0.31,
    airRatio: 0.39, centroid: 0.5, flatness: 0.9, duration: 0.09 })],
  ['closed-hat', descriptor({ subRatio: 0.01, lowMidRatio: 0.01, midRatio: 0.03, highRatio: 0.66,
    airRatio: 0.29, centroid: 0.72, flatness: 0.25, duration: 0.025, highPersistence: 0.05 })],
  ['open-hat', descriptor({ subRatio: 0.01, lowMidRatio: 0.01, midRatio: 0.03, highRatio: 0.64,
    airRatio: 0.31, centroid: 0.7, flatness: 0.2, duration: 0.38, highPersistence: 0.85 })],
  ['tom', descriptor({ subRatio: 0.12, lowMidRatio: 0.62, midRatio: 0.2, highRatio: 0.04,
    airRatio: 0.02, centroid: 0.2, flatness: 0.08, duration: 0.18, lowPersistence: 0.55 })],
  ['other-percussion', descriptor({ subRatio: 0.04, lowMidRatio: 0.24, midRatio: 0.08,
    highRatio: 0.34, airRatio: 0.3, flatness: 0.82, centroid: 0.48 })],
];

for (const [role, evidence] of classificationCases) {
  test(`transparent score model classifies ${role} descriptor`, () => {
    const result = classifyPercussion(evidence);
    assert.equal(result.role, role);
    assert.ok(Number.isFinite(result.topScore) && Number.isFinite(result.secondScore));
    assert.ok(result.confidence >= 0 && result.confidence <= 1);
    assert.ok(result.margin >= 0 && result.margin <= 1);
  });
}

test('isolated generated fixtures expose their expected role without enabling track capability', () => {
  const cases: readonly [PercussionKind, ReturnType<typeof isolatedKick>][] = [
    ['kick', isolatedKick()], ['snare', isolatedSnare()], ['closed-hat', isolatedClosedHat()],
    ['open-hat', isolatedOpenHat()], ['tom', isolatedTom()], ['other-percussion', ambiguousClap()],
  ];
  for (const [role, pcm] of cases) {
    const result = analyze(pcm);
    assert.ok(result.events.some(event => event.type === role), role);
    assert.equal(result.available, false);
  }
});

test('silence creates no candidates, events, or capability', () => {
  const result = analyze(silence());
  assert.equal(result.candidateCount, 0);
  assert.deepEqual(result.events, []);
  assert.equal(result.available, false);
});

test('sustained low sine creates no percussion events', () => {
  assert.deepEqual(analyze(lowSine()).events, []);
});

test('stationary white noise does not create confident event spam', () => {
  const result = analyze(whiteNoise());
  assert.equal(result.available, false);
  assert.ok(result.events.length <= 1);
});

test('sustained cymbal has one onset cluster rather than frame-rate event spam', () => {
  const result = analyze(sustainedCymbal());
  assert.ok(result.events.some(event => event.type === 'open-hat'));
  assert.ok(result.events.length <= 2);
});

test('four-on-floor plus hats enables bounded real percussion capability', () => {
  const map = analyzePcmAudio(fourOnFloorHats(), source);
  const result = map.percussionAnalysis!;
  assert.equal(result.available, true);
  assert.equal(map.capabilities.percussion, true);
  assert.deepEqual(map.percussion, result.events);
  assert.ok(result.acceptedEventCount >= 3);
  assert.ok(result.eventDensity > 0 && result.eventDensity < 28);
});

test('dense sixteenth hats survive the short refractory policy with finite density', () => {
  const result = analyze(denseHats());
  assert.equal(result.available, true);
  assert.ok(result.events.length >= 8);
  assert.ok(Number.isFinite(result.eventDensity) && result.eventDensity < 28);
});

test('timestamps are monotonic and IDs deterministic', () => {
  const first = analyze(fourOnFloorHats());
  const second = analyze(fourOnFloorHats());
  assert.deepEqual(first.events, second.events);
  assert.ok(first.events.every((event, index) => index === 0 || event.time >= first.events[index - 1].time));
  assert.equal(new Set(first.events.map(event => event.id)).size, first.events.length);
});

test('intensity, confidence, scores, margins, and descriptors stay finite and bounded', () => {
  for (const event of analyze(denseHats()).events) {
    for (const value of [event.strength, event.confidence, event.topScore, event.secondScore, event.margin,
      event.descriptors?.subRatio, event.descriptors?.lowMidRatio, event.descriptors?.highRatio,
      event.descriptors?.centroid, event.descriptors?.spread, event.descriptors?.onsetStrength]) {
      assert.ok(value !== undefined && Number.isFinite(value) && value >= 0 && value <= 1);
    }
  }
});

test('overlapping kick/snare remains a finite non-duplicate event cluster', () => {
  const result = analyze(overlappingKickSnare());
  assert.ok(result.events.length >= 1 && result.events.length <= 2);
  assert.equal(new Set(result.events.map(event => event.id)).size, result.events.length);
});

test('varying same-class gains produce bounded non-identical physical intensity', () => {
  const strengths = analyze(varyingKickIntensity()).events.filter(event => event.type === 'kick').map(event => event.strength);
  assert.ok(strengths.length >= 2);
  assert.ok(new Set(strengths.map(value => value.toFixed(3))).size >= 2);
  assert.ok(strengths.every(value => value >= 0 && value <= 1));
});

test('frequency bands are sample-rate aware at 32 kHz and 48 kHz', () => {
  for (const sampleRate of [32_000, 48_000]) {
    const result = analyze(sampleRateFixture(sampleRate));
    assert.equal(result.metadata.bandsHz.air[1], sampleRate / 2);
    assert.ok(result.events.length >= 2);
  }
});

test('stereo fixture follows arithmetic-mean analysis and stays deterministic', () => {
  const first = analyze(stereoFixture());
  const second = analyze(stereoFixture());
  assert.deepEqual(first, second);
  assert.ok(first.events.length >= 2);
});

test('capability requires multiple events, span, confidence, and non-pathological density', () => {
  assert.equal(analyze(isolatedKick()).available, false);
  assert.equal(analyze(fourOnFloorHats()).available, true);
});

test('metadata records preprocessing, bands, classifier, thresholds, and refractory policy', () => {
  const metadata = analyze(fourOnFloorHats()).metadata;
  assert.equal(metadata.preprocessing, 'positive-spectral-difference-shared-stft');
  assert.equal(metadata.classifier, 'deterministic-rule-scores-v1');
  assert.deepEqual(metadata.bandsHz.sub, [20, 160]);
  assert.ok(metadata.onsetThreshold > 0 && metadata.confidenceThreshold > 0 && metadata.capabilityThreshold > 0);
  assert.ok(metadata.refractorySeconds['closed-hat'] < metadata.refractorySeconds.kick);
});
