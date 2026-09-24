import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  analyzeMelody, analyzeMelodyWithDpDiagnostics, analyzeMelodyWithEvidence, MELODY_ANALYSIS,
} from '../src/audio/analysis/MelodyAnalysis.ts';
import {
  selectMelodyEvidence, selectMelodyEvidenceForTransport, selectObservedPitchEvidence,
} from '../src/audio/melody-evidence/selectMelodyEvidence.ts';
import type { MelodyEvidenceCandidate, MelodyRejectedCandidate } from '../src/audio/melody-evidence/types.ts';
import type { AudioMap } from '../src/audio/types.ts';
import { selectSignalTelemetry } from '../packages/listening-instrument-ui/src/signal-console/signalTelemetry.ts';

const SAMPLE_RATE = 48_000;
const tone = (frequency: number, seconds = 1, gain = .8) => Float32Array.from(
  { length: Math.floor(SAMPLE_RATE * seconds) },
  (_, index) => gain * Math.sin(2 * Math.PI * frequency * index / SAMPLE_RATE),
);
const analyze = (signal: Float32Array) => analyzeMelodyWithEvidence({ mono: signal, sampleRate: SAMPLE_RATE });
const frameAt = (signal: Float32Array, time = .4) => {
  const result = analyze(signal);
  return { ...result, frame: selectMelodyEvidence(result.evidence, time)! };
};

const candidate = (pitchHz: number, score: number): MelodyEvidenceCandidate => ({
  rank: 1, pitchHz, midiFloat: 69 + 12 * Math.log2(pitchHz / 440), noteName: 'A4',
  periodicity: .8, salience: .7, score,
});
const rejected = (frequencyHz: number, score: number,
  reason: MelodyRejectedCandidate['reason']): MelodyRejectedCandidate => ({
  rank: 1, frequencyHz, periodicity: .8, salience: .7, score, reason,
});

function mapWithEvidence(id: string, signal: Float32Array): AudioMap {
  const result = analyze(signal);
  return {
    version: 1, id, duration: signal.length / SAMPLE_RATE,
    capabilities: { melody: result.analysis.available, rhythm: false, percussion: false, harmony: false,
      tonalCenter: false, structure: false, spectrum: false },
    source: { kind: 'real-audio', filename: `${id}.wav`, mimeType: 'audio/wav' },
    analysis: null, amplitude: [], spectrum: [], melody: result.analysis.notes,
    melodyAnalysis: result.analysis, melodyEvidence: result.evidence,
    percussion: [], percussionAnalysis: null, rhythm: [], rhythmAnalysis: null,
    harmony: [], harmonyAnalysis: null, tonalCenterAnalysis: null,
    structure: null, structureAnalysis: null, drops: null,
  } as unknown as AudioMap;
}

const field = (telemetry: ReturnType<typeof selectSignalTelemetry>, domain: string, label: string) =>
  telemetry.domains.find(item => item.id === domain)?.fields.find(item => item.label === label)?.value;

test('below-range 75 Hz evidence remains heard without entering Melody', () => {
  const signal = tone(75);
  const ordinary = analyzeMelody({ mono: signal, sampleRate: SAMPLE_RATE });
  const { analysis, frame } = frameAt(signal);
  assert.deepEqual(analysis, ordinary);
  assert.equal(frame.candidates.length, 0);
  assert.equal(frame.reason, 'NO_USABLE_CANDIDATE');
  assert.equal(frame.observedPitch.source, 'RANGE_REJECTED');
  assert.equal(frame.observedPitch.melodyRangeStatus, 'BELOW_MELODY_RANGE');
  assert.equal(frame.observedPitch.rangeReason, 'BELOW_PITCH_RANGE');
  assert.ok(frame.observedPitch.frequencyHz! < MELODY_ANALYSIS.minimumHz);
  assert.equal(frame.observedPitch.noteName, 'D#2');
  assert.equal(analysis.available, false);
  assert.deepEqual(analysis.notes, []);
});

test('110 Hz and accepted 138 Hz expose independent in-range pitch evidence', () => {
  const low = frameAt(tone(110));
  assert.equal(low.frame.observedPitch.source, 'USABLE_CANDIDATE');
  assert.equal(low.frame.observedPitch.melodyRangeStatus, 'IN_RANGE');
  assert.equal(low.frame.observedPitch.noteName, 'A2');
  assert.equal(low.analysis.available, true);

  const accepted = frameAt(tone(138));
  assert.equal(accepted.frame.observedPitch.source, 'USABLE_CANDIDATE');
  assert.equal(accepted.frame.observedPitch.melodyRangeStatus, 'IN_RANGE');
  assert.equal(accepted.frame.observedPitch.noteName, 'C#3');
  assert.equal(accepted.frame.reason, 'VOICED');
  assert.equal(accepted.analysis.available, true);
  assert.equal(accepted.analysis.notes[0]?.noteName, 'C#3');
});

test('above-range evidence is visible without becoming an above-range Melody candidate', () => {
  const { analysis, frame } = frameAt(tone(1400));
  assert.equal(frame.observedPitch.source, 'RANGE_REJECTED');
  assert.equal(frame.observedPitch.melodyRangeStatus, 'ABOVE_MELODY_RANGE');
  assert.equal(frame.observedPitch.rangeReason, 'ABOVE_PITCH_RANGE');
  assert.ok(frame.observedPitch.frequencyHz! > MELODY_ANALYSIS.maximumHz);
  assert.equal(frame.candidates.some(item => item.pitchHz > MELODY_ANALYSIS.maximumHz), false);
  assert.equal(analysis.notes.some(item => (item.pitchHz ?? 0) > MELODY_ANALYSIS.maximumHz), false);
});

test('strongest hypothesis compares usable and range-rejected raw scores without range preference', () => {
  const usable = candidate(440, .7);
  const below = rejected(75, .8, 'BELOW_PITCH_RANGE');
  assert.equal(selectObservedPitchEvidence({ candidates: [usable], rejectedCandidates: [below] }).source,
    'RANGE_REJECTED');
  assert.equal(selectObservedPitchEvidence({ candidates: [{ ...usable, score: .9 }], rejectedCandidates: [below] }).source,
    'USABLE_CANDIDATE');
  assert.equal(selectObservedPitchEvidence({ candidates: [usable], rejectedCandidates: [{ ...below, score: .7 }] }).source,
    'USABLE_CANDIDATE');
});

test('absence and note conversion are explicit and never fabricate zero Hz', () => {
  const absent = selectObservedPitchEvidence({ candidates: [], rejectedCandidates: [] });
  assert.deepEqual(absent, { frequencyHz: null, midi: null, noteName: null, score: null,
    source: 'NONE', melodyRangeStatus: 'UNAVAILABLE', rangeReason: null });
  const quiet = frameAt(tone(440, 1, MELODY_ANALYSIS.minimumRms * .5)).frame;
  assert.equal(quiet.generation.attempted, false);
  assert.equal(quiet.observedPitch.frequencyHz, null);
  assert.equal(quiet.observedPitch.source, 'NONE');
  assert.equal(quiet.observedPitch.melodyRangeStatus, 'UNAVAILABLE');
});

test('Observed Pitch coexists independently with null-path and low-confidence decisions', () => {
  let state = 0x12345678;
  const noise = Float32Array.from({ length: SAMPLE_RATE }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return ((state / 0xffffffff) * 2 - 1) * .45;
  });
  const nullPathResult = analyze(noise);
  const nullPath = Array.from({ length: nullPathResult.evidence.frameCount }, (_, index) =>
    selectMelodyEvidence(nullPathResult.evidence, index * .016)!)
    .find(frame => frame.reason === 'PATH_SELECTED_NULL' && frame.observedPitch.source !== 'NONE');
  assert.ok(nullPath);
  assert.equal(nullPath.selectedCandidateIndex, null);

  state = 1;
  const ambiguous = Float32Array.from({ length: SAMPLE_RATE }, (_, index) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return .01 * Math.sin(2 * Math.PI * 440 * index / SAMPLE_RATE)
      + .01 * ((state / 0xffffffff) * 2 - 1);
  });
  const uncertainResult = analyze(ambiguous);
  const uncertain = Array.from({ length: uncertainResult.evidence.frameCount }, (_, index) =>
    selectMelodyEvidence(uncertainResult.evidence, index * .016)!)
    .find(frame => frame.reason === 'LOW_CONFIDENCE' && frame.observedPitch.source !== 'NONE');
  assert.ok(uncertain);
  assert.equal(uncertain.voiced, false);
});

test('transport selection keeps Observed Pitch on the same pause, seek, restart, and ended frame', () => {
  const result = analyze(tone(75));
  const paused = selectMelodyEvidenceForTransport(result.evidence, { time: .3, duration: 1, playing: false })!;
  const sought = selectMelodyEvidenceForTransport(result.evidence, { time: .75, duration: 1, playing: false })!;
  const restarted = selectMelodyEvidenceForTransport(result.evidence, { time: 0, duration: 1, playing: false })!;
  const ended = selectMelodyEvidenceForTransport(result.evidence, { time: 1, duration: 1, playing: false })!;
  assert.notEqual(paused.frameIndex, sought.frameIndex);
  assert.equal(restarted.frameIndex, 0);
  assert.equal(ended.frameIndex, result.evidence.frameCount - 1);
  for (const frame of [paused, sought, restarted, ended]) {
    assert.equal(frame.observedPitch.source, 'RANGE_REJECTED');
    assert.equal(frame.observedPitch.melodyRangeStatus, 'BELOW_MELODY_RANGE');
    assert.equal(frame.rejectedCandidates[0]?.frequencyHz, frame.observedPitch.frequencyHz);
  }
});

test('AudioMap replacement and SignalConsole expose Observed Pitch without changing HEARING', () => {
  const belowMap = mapWithEvidence('same-map', tone(75));
  const inRangeMap = mapWithEvidence('same-map', tone(110));
  const below = selectSignalTelemetry({ audioMap: belowMap, mapRevision: 1,
    transport: { time: .4, duration: 1, playing: false } });
  const replacement = selectSignalTelemetry({ audioMap: inRangeMap, mapRevision: 2,
    transport: { time: .4, duration: 1, playing: false } });
  assert.notEqual(replacement.signature, below.signature);
  assert.equal(field(below, 'PITCH', 'OBSERVED'), '79.73');
  assert.equal(field(below, 'PITCH', 'NOTE'), 'D#2');
  assert.equal(field(below, 'PITCH', 'MELODY RANGE STATUS'), 'BELOW MELODY RANGE');
  assert.equal(field(replacement, 'PITCH', 'OBSERVED'), '110.00');
  assert.equal(field(replacement, 'PITCH', 'MELODY RANGE STATUS'), 'IN RANGE');
  assert.equal(below.hearing.find(item => item.id === 'MELODY')?.status, 'UNAVAILABLE');
  assert.equal(replacement.hearing.find(item => item.id === 'MELODY')?.status, 'STABLE');
  assert.equal(below.melodyInspect.rejectedCandidates[0]?.fields[0]?.value.includes('BELOW_PITCH_RANGE'), true);
});

test('Observed Pitch presentation remains proportional evidence with secondary stable range language', () => {
  const component = readFileSync(new URL('../packages/listening-instrument-ui/src/signal-console/SignalConsole.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../packages/listening-instrument-ui/src/signal-console/signalConsole.css', import.meta.url), 'utf8');
  assert.match(component, /item\.label === 'PITCH HZ' \|\| item\.label === 'OBSERVED'/);
  assert.match(component, /<PrimaryDomain name="OBSERVED PITCH">/);
  assert.match(component, /label="RANGE" value=\{primary\.observedPitch\.rangeStatus\}/);
  assert.match(styles, /\.signal-primary-value \{[^}]*proportional-nums/s);
  assert.match(styles, /data-primary-domain='observed-pitch'[^}]*font-size: 1\.35rem/s);
  assert.doesNotMatch(styles, /data-primary-domain='observed-pitch'[^}]*color:\s*(red|#f00|#ff0000)/i);
  assert.doesNotMatch(styles, /transition\s*:|animation\s*:|@keyframes/);
});

test('read-only observation leaves every production and diagnostic Melody analysis equivalent', () => {
  const signal = Float32Array.from({ length: SAMPLE_RATE }, (_, index) =>
    .75 * Math.sin(2 * Math.PI * 440 * index / SAMPLE_RATE)
      + .2 * Math.sin(2 * Math.PI * 110 * index / SAMPLE_RATE));
  const input = { mono: signal, sampleRate: SAMPLE_RATE };
  const baseline = analyzeMelody(input);
  assert.deepEqual(analyzeMelodyWithEvidence(input).analysis, baseline);
  assert.deepEqual(analyzeMelodyWithDpDiagnostics(input).analysis, baseline);
});
