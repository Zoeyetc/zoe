import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeMelody, analyzeMelodyWithEvidence, MELODY_ANALYSIS,
} from '@computational-listening/engine';
import {
  melodyEvidenceIndexAt, selectMelodyEvidence,
} from '@computational-listening/engine';
import {
  createCompactMelodyEvidenceTimeline, retainMelodyRejectedCandidate,
} from '@computational-listening/engine';
import { MELODY_REJECTED_CANDIDATE_CAP } from '@computational-listening/engine';

const SAMPLE_RATE = 48_000;
const tone = (frequency: number, seconds: number, gain = 0.8) => Float32Array.from(
  { length: Math.floor(SAMPLE_RATE * seconds) },
  (_, index) => gain * Math.sin(2 * Math.PI * frequency * index / SAMPLE_RATE),
);
const analyze = (mono: Float32Array) => analyzeMelodyWithEvidence({ mono, sampleRate: SAMPLE_RATE });

function deterministicNoise(seconds: number, gain = 0.45) {
  let state = 0x12345678;
  return Float32Array.from({ length: Math.floor(SAMPLE_RATE * seconds) }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return ((state / 0xffffffff) * 2 - 1) * gain;
  });
}

test('collecting compact evidence leaves the ordinary MelodyAnalysis output identical', () => {
  const signal = Float32Array.from({ length: SAMPLE_RATE }, (_, index) => {
    const time = index / SAMPLE_RATE;
    return 0.75 * Math.sin(2 * Math.PI * 440 * time) + 0.2 * Math.sin(2 * Math.PI * 110 * time);
  });
  const ordinary = analyzeMelody({ mono: signal, sampleRate: SAMPLE_RATE });
  const observed = analyze(signal);
  assert.deepEqual(observed.analysis, ordinary);
  assert.equal(observed.analysis.notes[0]?.noteName, 'A4');
  assert.equal(observed.evidence.frameCount, observed.analysis.contour.length);
  assert.ok(observed.evidence.byteLength > 0);
  assert.deepEqual(observed.evidence.thresholds, {
    minimumRms: 0.0025, minimumHz: 80, maximumHz: 1400, voicingConfidence: 0.56,
    trackConfidence: 0.58, minimumUsableDuration: 0.5, minimumVoicedFrameRatio: 0.12,
    minimumNoteDuration: 0.08,
  });
});

test('A4 evidence exposes ordered real candidates, selected path, confidence, and voiced contour truth', () => {
  const { analysis, evidence } = analyze(tone(440, 1));
  const frame = selectMelodyEvidence(evidence, 0.5)!;
  assert.ok(frame.candidates.length > 0);
  assert.equal(frame.candidates[0].noteName, 'A4');
  assert.ok(frame.candidates.every((candidate, index) => index === 0
    || frame.candidates[index - 1].score >= candidate.score));
  assert.notEqual(frame.selectedCandidateIndex, null);
  assert.equal(frame.reason, 'VOICED');
  assert.equal(frame.voiced, true);
  assert.ok(Math.abs(frame.finalConfidence - analysis.contour[frame.frameIndex].confidence) < 1e-6);
  assert.ok(Math.abs(frame.finalPitchHz! - analysis.contour[frame.frameIndex].pitchHz!) < 1e-3);
});

test('frame provenance follows the actual LOW_RMS, empty-candidate, null-path, and low-confidence branches', () => {
  const silence = analyze(new Float32Array(SAMPLE_RATE));
  for (let index = 0; index < silence.evidence.frameCount; index += 1) {
    const frame = selectMelodyEvidence(silence.evidence, index * 0.016)!;
    assert.equal(frame.reason, 'LOW_RMS');
    assert.ok(frame.rms < MELODY_ANALYSIS.minimumRms);
    assert.equal(frame.candidates.length, 0);
    assert.deepEqual(frame.generation, {
      attempted: false,
      outcome: 'NOT_ATTEMPTED_RMS_GATE',
      searchMode: 'NOT_RUN',
      localMinimumCount: 0,
      rawCandidateCount: 0,
      inRangeCandidateCountBeforeDeduplication: 0,
      duplicateCandidateRemovalCount: 0,
    });
  }

  const noise = analyze(deterministicNoise(1));
  const noiseFrames = Array.from({ length: noise.evidence.frameCount }, (_, index) =>
    selectMelodyEvidence(noise.evidence, index * 0.016)!);
  assert.ok(noiseFrames.some(frame => frame.reason === 'NO_USABLE_CANDIDATE'));
  assert.ok(noiseFrames.some(frame => frame.reason === 'PATH_SELECTED_NULL'));
  noiseFrames.filter(frame => frame.reason === 'NO_USABLE_CANDIDATE').forEach(frame => {
    assert.ok(frame.rms >= MELODY_ANALYSIS.minimumRms);
    assert.equal(frame.candidates.length, 0);
  });
  noiseFrames.filter(frame => frame.reason === 'PATH_SELECTED_NULL').forEach(frame => {
    assert.ok(frame.candidates.length > 0);
    assert.equal(frame.selectedCandidateIndex, null);
  });

  let state = 1;
  const ambiguous = Float32Array.from({ length: SAMPLE_RATE }, (_, index) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return 0.01 * Math.sin(2 * Math.PI * 440 * index / SAMPLE_RATE)
      + 0.01 * ((state / 0xffffffff) * 2 - 1);
  });
  const uncertain = analyze(ambiguous);
  const rejected = Array.from({ length: uncertain.evidence.frameCount }, (_, index) =>
    selectMelodyEvidence(uncertain.evidence, index * 0.016)!).find(frame => frame.reason === 'LOW_CONFIDENCE');
  assert.ok(rejected);
  assert.notEqual(rejected.selectedCandidateIndex, null);
  assert.ok(rejected.finalConfidence < MELODY_ANALYSIS.voicingThreshold);
  assert.equal(rejected.voiced, false);
});

test('attempted generation records the existing local-minimum or global-fallback search path', () => {
  const tonal = analyze(tone(440, 1));
  const observations = Array.from({ length: tonal.evidence.frameCount }, (_, index) =>
    selectMelodyEvidence(tonal.evidence, index * 0.016)!);
  observations.forEach(frame => {
    assert.equal(frame.generation.attempted, true);
    assert.equal(frame.generation.outcome, 'USABLE_CANDIDATES_SURVIVED');
    assert.ok(frame.generation.rawCandidateCount > 0);
    assert.equal(frame.generation.rawCandidateCount,
      frame.generation.inRangeCandidateCountBeforeDeduplication + frame.outOfRangeCandidateCount);
    assert.notEqual(frame.generation.searchMode, 'NOT_RUN');
    if (frame.generation.searchMode === 'LOCAL_MINIMA') assert.ok(frame.generation.localMinimumCount > 0);
    if (frame.generation.searchMode === 'GLOBAL_MINIMUM_FALLBACK') {
      assert.equal(frame.generation.localMinimumCount, 0);
      assert.equal(frame.generation.rawCandidateCount, 1);
    }
  });
});

test('empty local-minimum search records the existing global-minimum fallback', () => {
  const dc = Float32Array.from({ length: SAMPLE_RATE }, () => 0.01);
  const frame = selectMelodyEvidence(analyze(dc).evidence, 0.5)!;
  assert.equal(frame.generation.attempted, true);
  assert.equal(frame.generation.searchMode, 'GLOBAL_MINIMUM_FALLBACK');
  assert.equal(frame.generation.localMinimumCount, 0);
  assert.equal(frame.generation.rawCandidateCount, 1);
  assert.equal(frame.generation.outcome, 'RAW_CANDIDATES_ALL_RANGE_REJECTED');
  assert.equal(frame.outOfRangeCandidateCount, 1);
});

test('the current fallback makes attempted generation with zero raw candidates unreachable', () => {
  const inputs = [tone(440, 1), tone(75, 1), deterministicNoise(1),
    Float32Array.from({ length: SAMPLE_RATE }, () => 0.01)];
  inputs.forEach(signal => {
    const { evidence } = analyze(signal);
    for (let index = 0; index < evidence.frameCount; index += 1) {
      const frame = selectMelodyEvidence(evidence, index * 0.016)!;
      assert.notEqual(frame.generation.outcome, 'ATTEMPTED_NO_RAW_CANDIDATE');
      if (frame.rms >= MELODY_ANALYSIS.minimumRms) {
        assert.equal(frame.generation.attempted, true);
        assert.ok(frame.generation.rawCandidateCount > 0);
        assert.ok(frame.candidates.length > 0 || frame.outOfRangeCandidateCount > 0);
      }
    }
  });
});

test('below-range raw candidate retains explicit provenance without entering usable melody', () => {
  const signal = tone(75, 1);
  const ordinary = analyzeMelody({ mono: signal, sampleRate: SAMPLE_RATE });
  const { analysis, evidence } = analyze(signal);
  const frame = selectMelodyEvidence(evidence, 0.4)!;
  assert.deepEqual(analysis, ordinary);
  assert.ok(frame.outOfRangeCandidateCount > 0);
  assert.equal(frame.rejectedCandidates[0]?.reason, 'BELOW_PITCH_RANGE');
  assert.ok(frame.rejectedCandidates[0]!.frequencyHz < MELODY_ANALYSIS.minimumHz);
  assert.equal(frame.candidates.some(candidate => candidate.pitchHz < MELODY_ANALYSIS.minimumHz), false);
  assert.equal(analysis.notes.some(note => (note.pitchHz ?? 0) < MELODY_ANALYSIS.minimumHz), false);
  assert.equal(frame.generation.attempted, true);
  assert.equal(frame.generation.outcome, 'RAW_CANDIDATES_ALL_RANGE_REJECTED');
  assert.ok(frame.generation.rawCandidateCount > 0);
  assert.equal(frame.generation.rawCandidateCount, frame.outOfRangeCandidateCount);
});

test('above-range raw candidate remains separate while mixed usable candidates stay unchanged', () => {
  const signal = tone(1400, 1);
  const ordinary = analyzeMelody({ mono: signal, sampleRate: SAMPLE_RATE });
  const { analysis, evidence } = analyze(signal);
  const frame = selectMelodyEvidence(evidence, 0.4)!;
  assert.deepEqual(analysis, ordinary);
  assert.equal(frame.rejectedCandidates[0]?.reason, 'ABOVE_PITCH_RANGE');
  assert.ok(frame.rejectedCandidates[0]!.frequencyHz > MELODY_ANALYSIS.maximumHz);
  assert.ok(frame.candidates.length > 0);
  assert.equal(frame.candidates.some(candidate => candidate.pitchHz > MELODY_ANALYSIS.maximumHz), false);
  assert.equal(analysis.notes.some(note => (note.pitchHz ?? 0) > MELODY_ANALYSIS.maximumHz), false);
});

test('ordinary in-range melody fabricates no rejected pre-filter provenance', () => {
  const { evidence } = analyze(tone(440, 1));
  for (let index = 0; index < evidence.frameCount; index += 1) {
    const frame = selectMelodyEvidence(evidence, index * 0.016)!;
    assert.equal(frame.outOfRangeCandidateCount, 0);
    assert.deepEqual(frame.rejectedCandidates, []);
  }
});

test('rejected-candidate cap keeps the strongest deterministic subset without replacing total count', () => {
  const raw = [
    { frequencyHz: 42, periodicity: .4, salience: .2, score: .4, reason: 'BELOW_PITCH_RANGE' as const },
    { frequencyHz: 39, periodicity: .5, salience: .3, score: .7, reason: 'BELOW_PITCH_RANGE' as const },
    { frequencyHz: 1700, periodicity: .6, salience: .4, score: .9, reason: 'ABOVE_PITCH_RANGE' as const },
    { frequencyHz: 1500, periodicity: .7, salience: .5, score: .8, reason: 'ABOVE_PITCH_RANGE' as const },
    { frequencyHz: 35, periodicity: .3, salience: .1, score: .2, reason: 'BELOW_PITCH_RANGE' as const },
  ];
  const retained = raw.reduce((current, candidate) => retainMelodyRejectedCandidate(current, candidate), []);
  assert.equal(retained.length, MELODY_REJECTED_CANDIDATE_CAP);
  assert.deepEqual(retained.map(candidate => candidate.frequencyHz), [1700, 1500, 39]);
  const timeline = createCompactMelodyEvidenceTimeline([{
    time: 0, rms: .2, candidates: [], outOfRangeCandidateCount: raw.length,
    generation: { attempted: true, outcome: 'RAW_CANDIDATES_ALL_RANGE_REJECTED',
      searchMode: 'LOCAL_MINIMA', localMinimumCount: 5, rawCandidateCount: 5,
      inRangeCandidateCountBeforeDeduplication: 0, duplicateCandidateRemovalCount: 0 },
    rejectedCandidates: retained, selectedCandidateIndex: null, finalPitchHz: null,
    finalConfidence: 0, finalSalience: 0, voiced: false, reason: 'NO_USABLE_CANDIDATE',
  }], {
    minimumRms: .0025, minimumHz: 80, maximumHz: 1400, voicingConfidence: .56,
    trackConfidence: .58, minimumUsableDuration: .5, minimumVoicedFrameRatio: .12,
    minimumNoteDuration: .08,
  }, {
    available: false, confidence: 0, voicedFrameRatio: 0, usableDuration: 0,
    noteCountBeforeTrackGate: 0, acceptedNoteCount: 0, rejectedShortNoteCount: 0,
    noteReasons: [], reasons: ['TRACK_NO_NOTES'],
  });
  const selected = selectMelodyEvidence(timeline, 0)!;
  assert.equal(selected.outOfRangeCandidateCount, 5);
  assert.equal(selected.rejectedCandidates.length, 3);
  assert.deepEqual(selected.rejectedCandidates.map(candidate => candidate.frequencyHz), [1700, 1500, 39]);
});

test('healthy general audio can still miss the Melody RMS gate without fabricating a generation rejection', () => {
  const quiet = analyze(tone(440, 1, MELODY_ANALYSIS.minimumRms * 0.5));
  const frame = selectMelodyEvidence(quiet.evidence, 0.5)!;
  assert.ok(frame.rms < MELODY_ANALYSIS.minimumRms);
  assert.equal(frame.candidates.length, 0);
  assert.equal(frame.outOfRangeCandidateCount, 0);
  assert.equal(frame.generation.attempted, false);
  assert.equal(frame.generation.outcome, 'NOT_ATTEMPTED_RMS_GATE');
  assert.equal(frame.generation.searchMode, 'NOT_RUN');
  assert.equal(frame.generation.rawCandidateCount, 0);
});

test('non-finite input follows the existing RMS gate branch without inventing a finite-value guard', () => {
  const signal = tone(440, 1);
  signal.fill(Number.NaN, 12_000, 18_000);
  const { evidence } = analyze(signal);
  const frame = Array.from({ length: evidence.frameCount }, (_, index) =>
    selectMelodyEvidence(evidence, index * 0.016)!).find(item => !Number.isFinite(item.rms));
  assert.ok(frame);
  assert.equal(frame.generation.attempted, false);
  assert.equal(frame.generation.outcome, 'NOT_ATTEMPTED_RMS_GATE');
  assert.equal(frame.generation.searchMode, 'NOT_RUN');
  assert.equal(frame.generation.rawCandidateCount, 0);
});

test('transport lookup is direct, stable, restartable, and clamps ENDED to final retained evidence', () => {
  const { evidence } = analyze(tone(440, 1));
  const pausedA = selectMelodyEvidence(evidence, 0.4);
  const pausedB = selectMelodyEvidence(evidence, 0.4);
  assert.deepEqual(pausedB, pausedA);
  assert.notEqual(melodyEvidenceIndexAt(evidence, 0.75), pausedA?.frameIndex);
  assert.equal(selectMelodyEvidence(evidence, 0)?.frameIndex, 0);
  assert.equal(selectMelodyEvidence(evidence, 1, true)?.frameIndex, evidence.frameCount - 1);
  assert.equal(selectMelodyEvidence(evidence, 0.2)?.frameIndex, melodyEvidenceIndexAt(evidence, 0.2));
});

test('rejected provenance follows pause, seek, restart, and ENDED frame lookup', () => {
  const { evidence } = analyze(tone(75, 1));
  const pausedA = selectMelodyEvidence(evidence, 0.3)!;
  const pausedB = selectMelodyEvidence(evidence, 0.3)!;
  assert.deepEqual(pausedB.rejectedCandidates, pausedA.rejectedCandidates);
  const sought = selectMelodyEvidence(evidence, 0.75)!;
  assert.notEqual(sought.frameIndex, pausedA.frameIndex);
  assert.equal(sought.rejectedCandidates[0]?.reason, 'BELOW_PITCH_RANGE');
  assert.equal(selectMelodyEvidence(evidence, 0)?.frameIndex, 0);
  assert.equal(selectMelodyEvidence(evidence, 1, true)?.frameIndex, evidence.frameCount - 1);
});

test('the product boundary exposes frozen observations without exposing compact storage', () => {
  const { evidence } = analyze(tone(440, 1));
  const before = selectMelodyEvidence(evidence, 0.25)!;
  assert.equal(Object.isFrozen(evidence), true);
  assert.equal(Object.isFrozen(evidence.thresholds), true);
  assert.equal(Object.isFrozen(before), true);
  assert.equal(Object.isFrozen(before.candidates), true);
  assert.equal(Object.isFrozen(before.generation), true);
  assert.equal(Object.isFrozen(before.rejectedCandidates), true);
  assert.deepEqual(selectMelodyEvidence(evidence, 0.25), before);
  assert.equal('frameTimes' in evidence, false);
  assert.equal('candidatePitchHz' in evidence, false);
  assert.deepEqual(selectMelodyEvidence(structuredClone(evidence), 0.25), before);
});
