import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import type { AudioMap } from '../src/audio/types.ts';
import { lookupSnapshot } from '../src/audio/AudioWorld.ts';
import { selectSignalInterpretationFields, selectSignalTelemetry, signalPhraseGroups } from '../src/signal-console/signalTelemetry.ts';
import type { SignalConsoleObservation } from '../src/signal-console/types.ts';
import { analyzePcmAudio } from '../src/audio/analysis/AudioAnalysis.ts';

function map(id = 'signal-map', rms: readonly [number, number] = [.284, .291]): AudioMap {
  return {
    version: 1, id, duration: 2,
    capabilities: { melody: true, rhythm: true, percussion: true, harmony: true,
      tonalCenter: true, structure: true, spectrum: true },
    source: { kind: 'real-audio', filename: `${id}.wav`, mimeType: 'audio/wav' },
    analysis: { version: 1, sampleRate: 24000, channelCount: 1, frameSize: 2048, hopSize: 1024,
      fftSize: 2048, analyzedDuration: 2, downmix: 'arithmetic-mean',
      bandsHz: { low: [20, 250], mid: [250, 4000], high: [4000, 12000] },
      normalization: { strategy: 'p95-reference', rmsReference: 1, bandReference: 1, textureReference: 1 } },
    amplitude: [
      { id: 'a0', start: 0, end: .1, rms, peak: [.5, .6], onsetStrength: [.2, .3] },
      { id: 'a1', start: .1, end: .2, rms: [.276, .28], peak: [.4, .5], onsetStrength: [.8, .1] },
      { id: 'a-padding', start: 1.98, end: 2, rms: [0, 0], peak: [0, 0], onsetStrength: [0, 0] },
    ],
    spectrum: [
      { id: 's0', start: 0, end: .1, low: [.1, .2], mid: [.2, .3], high: [.3, .4],
        brightness: [.4, .5], texture: [.5, .6] },
      { id: 's1', start: .1, end: .2, low: [.6, .5], mid: [.5, .4], high: [.4, .3],
        brightness: [.3, .2], texture: [.2, .1] },
      { id: 's-padding', start: 1.98, end: 2, low: [0, 0], mid: [0, 0], high: [0, 0],
        brightness: [0, 0], texture: [0, 0] },
    ],
    melody: [], melodyAnalysis: { contour: [
      { time: 0, voiced: true, pitchHz: 487.26, midiFloat: 71.8, confidence: .12, salience: .19 },
      { time: .1, voiced: true, pitchHz: 489.02, midiFloat: 71.86, confidence: .09, salience: .16 },
      { time: 2, voiced: false, pitchHz: null, midiFloat: null, confidence: 0, salience: 0 },
    ], metadata: { analysisSampleRate: 12000, frameSize: 2048, hopSize: 192 } },
    percussion: [], percussionAnalysis: null,
    rhythm: [{ id: 'rhythm', start: 0, end: 2, bpm: 120, beatsPerBar: 4, groove: .31, swing: .17 }],
    rhythmAnalysis: { bpm: 120, confidence: .42, groove: .31, swing: .17, beats: [] },
    harmony: [], harmonyAnalysis: { frames: [
      { time: 0, chroma: [.5, 0, 0, 0, .3, 0, 0, .2, 0, 0, 0, 0], energy: .4,
        confidence: .18, chord: null, topCandidate: null, secondCandidate: null, scoreMargin: .03 },
      { time: .2, chroma: [0, .4, 0, 0, 0, .3, 0, 0, .3, 0, 0, 0], energy: .5,
        confidence: .2, chord: null, topCandidate: null, secondCandidate: null, scoreMargin: .04 },
      { time: 1.98, chroma: Array(12).fill(0), energy: 0,
        confidence: 0, chord: null, topCandidate: null, secondCandidate: null, scoreMargin: 0 },
    ], metadata: { analysisSampleRate: 12000, frameSize: 4096, hopSize: 1024 } },
    tonalCenterAnalysis: { frames: [
      { time: 0, rootPitchClass: 0, mode: 'major', label: 'C major', confidence: .61,
        topCandidate: { label: 'C major', rootPitchClass: 0, mode: 'major', score: .64,
          profileScore: .7, tonicSupport: .6, chordSupport: .6 },
        secondCandidate: null, topScore: .64, secondScore: .2, margin: .44, usableCoverage: .8 },
      { time: .3, rootPitchClass: 7, mode: 'major', label: 'G major', confidence: .71,
        topCandidate: { label: 'G major', rootPitchClass: 7, mode: 'major', score: .76,
          profileScore: .8, tonicSupport: .7, chordSupport: .75 },
        secondCandidate: null, topScore: .76, secondScore: .22, margin: .54, usableCoverage: .9 },
    ] },
    structure: null, structureAnalysis: { frames: [
      { id: 'st0', start: 0, end: 1, vector: [], energy: .25, onsetDensity: .2 },
      { id: 'st1', start: 1, end: 2, vector: [], energy: .75, onsetDensity: .6 },
    ], novelty: [.1, .8], noveltyScales: { short: [.11, .7], medium: [.12, .6], long: [.13, .5] } },
    drops: null,
  } as unknown as AudioMap;
}

const observation = (audioMap: AudioMap, time: number, revision = 0, playing = true): SignalConsoleObservation => ({
  audioMap, mapRevision: revision, transport: { time, duration: audioMap.duration, playing },
});
const field = (telemetry: ReturnType<typeof selectSignalTelemetry>, domain: string, label: string) =>
  telemetry.domains.find(item => item.id === domain)?.fields.find(item => item.label === label)?.value;
const interpretationField = (audioMap: AudioMap, time: number, ended: boolean) => {
  const snapshot = lookupSnapshot(audioMap, { time, duration: audioMap.duration, playing: false });
  const fields = selectSignalInterpretationFields({ snapshot, events: [] }, ended);
  return (label: string) => fields.find(item => item.label === label)?.value;
};

test('retained frames jump exactly without interpolation or smoothing', () => {
  const audioMap = map();
  const before = selectSignalTelemetry(observation(audioMap, .09));
  const after = selectSignalTelemetry(observation(audioMap, .1));
  assert.equal(field(before, 'LEVEL', 'RMS'), '0.284');
  assert.equal(field(after, 'LEVEL', 'RMS'), '0.276');
  assert.equal(before.indexes.amplitude, 0);
  assert.equal(after.indexes.amplitude, 1);
});

test('low-confidence retained pitch remains visible as analysis evidence', () => {
  const telemetry = selectSignalTelemetry(observation(map(), .01));
  assert.equal(field(telemetry, 'PITCH', 'PITCH HZ'), '487.26');
  assert.equal(field(telemetry, 'PITCH', 'FRAME CONF'), '0.120');
  assert.equal(field(telemetry, 'PITCH', 'SALIENCE'), '0.190');
});

test('paused seek resolves destination frames instead of suppressing synchronization', () => {
  const audioMap = map();
  const paused = selectSignalTelemetry(observation(audioMap, .02, 0, false));
  const sought = selectSignalTelemetry(observation(audioMap, .12, 0, false));
  assert.notEqual(sought.signature, paused.signature);
  assert.equal(sought.indexes.amplitude, 1);
  assert.equal(field(sought, 'TRANSIENT', 'ONSET'), '0.800');
});

test('AudioMap replacement refreshes equal indexes through explicit revision identity', () => {
  const first = selectSignalTelemetry(observation(map('same-id', [.1, .2]), .01, 4, false));
  const replacement = selectSignalTelemetry(observation(map('same-id', [.9, .8]), .01, 5, false));
  assert.deepEqual(replacement.indexes, first.indexes);
  assert.notEqual(replacement.signature, first.signature);
  assert.equal(field(first, 'LEVEL', 'RMS'), '0.100');
  assert.equal(field(replacement, 'LEVEL', 'RMS'), '0.900');
});

test('domains retain independent temporal cadence', () => {
  const audioMap = map();
  const first = selectSignalTelemetry(observation(audioMap, .02));
  const second = selectSignalTelemetry(observation(audioMap, .12));
  assert.equal(first.indexes.structure, second.indexes.structure);
  assert.notEqual(first.indexes.amplitude, second.indexes.amplitude);
  assert.equal(field(first, 'STRUCTURE', 'ENERGY'), field(second, 'STRUCTURE', 'ENERGY'));
  assert.notEqual(field(first, 'LEVEL', 'RMS'), field(second, 'LEVEL', 'RMS'));
});

test('pause before end preserves destination retained frames and beat phase', () => {
  const audioMap = map();
  const paused = selectSignalTelemetry(observation(audioMap, .408, 0, false));
  const interpretation = interpretationField(audioMap, .408, paused.ended);
  assert.equal(paused.ended, false);
  assert.equal(paused.indexes.amplitude, 1);
  assert.equal(field(paused, 'LEVEL', 'RMS'), '0.276');
  assert.equal(interpretation('BEAT PHASE'), '0.816');
});

test('exact end resolves every retained domain to its own last valid frame', () => {
  const audioMap = map();
  const ended = selectSignalTelemetry(observation(audioMap, audioMap.duration, 0, false));
  assert.equal(ended.ended, true);
  assert.deepEqual(ended.indexes, {
    amplitude: 1, spectrum: 1, pitch: 1, chroma: 1, tonal: 1, structure: 1, melodyEvidence: -1,
  });
  assert.equal(field(ended, 'LEVEL', 'RMS'), '0.276');
  assert.equal(field(ended, 'TRANSIENT', 'ONSET'), '0.800');
  assert.equal(field(ended, 'SPECTRUM', 'LOW'), '0.600');
  assert.equal(field(ended, 'PITCH', 'PITCH HZ'), '489.02');
  assert.equal(field(ended, 'TONAL', 'ENERGY'), '0.500');
  assert.equal(field(ended, 'TONAL', 'KEY CANDIDATE'), 'G major 0.760');
  assert.equal(field(ended, 'STRUCTURE', 'ENERGY'), '0.750');
});

test('exact end makes temporal interpretation unavailable while retained global evidence remains', () => {
  const audioMap = map();
  const ended = selectSignalTelemetry(observation(audioMap, audioMap.duration, 0, false));
  const interpretation = interpretationField(audioMap, audioMap.duration, ended.ended);
  assert.equal(interpretation('BEAT PHASE'), '—');
  assert.equal(interpretation('NOTE CONF'), '—');
  assert.equal(interpretation('CHORD CONF'), '—');
  assert.equal(interpretation('PROGRESS'), '—');
  assert.equal(field(ended, 'TONAL', 'KEY CONF'), '0.710');
});

test('end policy never replaces available last retained evidence with zero fallback', () => {
  const ended = selectSignalTelemetry(observation(map(), 2, 0, false));
  for (const [domain, label] of [
    ['LEVEL', 'RMS'], ['TRANSIENT', 'ONSET'], ['SPECTRUM', 'LOW'], ['SPECTRUM', 'BRIGHTNESS'],
    ['PITCH', 'FRAME CONF'], ['TONAL', 'ENERGY'], ['TONAL', 'KEY CONF'], ['STRUCTURE', 'NOVELTY'],
  ] as const) assert.notEqual(field(ended, domain, label), '0.000');
});

test('restart resolves actual time-zero retained analysis instead of clearing fields', () => {
  const audioMap = map();
  const restarted = selectSignalTelemetry(observation(audioMap, 0, 0, false));
  const interpretation = interpretationField(audioMap, 0, restarted.ended);
  assert.equal(restarted.ended, false);
  assert.deepEqual(restarted.indexes, {
    amplitude: 0, spectrum: 0, pitch: 0, chroma: 0, tonal: 0, structure: 0, melodyEvidence: -1,
  });
  assert.equal(field(restarted, 'LEVEL', 'RMS'), '0.284');
  assert.equal(field(restarted, 'SPECTRUM', 'LOW'), '0.100');
  assert.equal(field(restarted, 'PITCH', 'PITCH HZ'), '487.26');
  assert.equal(interpretation('BEAT PHASE'), '0.000');
});

test('seek to exactly duration uses the same ended projection as natural completion', () => {
  const audioMap = map();
  const natural = selectSignalTelemetry(observation(audioMap, audioMap.duration, 0, false));
  const sought = selectSignalTelemetry(observation(audioMap, audioMap.duration, 0, false));
  assert.equal(sought.ended, true);
  assert.deepEqual(sought.indexes, natural.indexes);
  assert.deepEqual(sought.domains, natural.domains);
  assert.equal(interpretationField(audioMap, audioMap.duration, sought.ended)('BEAT PHASE'), '—');
});

test('seek backward from ended immediately restores destination evidence and beat phase', () => {
  const audioMap = map();
  const ended = selectSignalTelemetry(observation(audioMap, audioMap.duration, 0, false));
  const sought = selectSignalTelemetry(observation(audioMap, .408, 0, false));
  assert.equal(sought.ended, false);
  assert.notEqual(sought.signature, ended.signature);
  assert.equal(field(sought, 'LEVEL', 'RMS'), '0.276');
  assert.equal(interpretationField(audioMap, .408, sought.ended)('BEAT PHASE'), '0.816');
});

test('typographic signal roles preserve stable phrase-group assignment across value changes', () => {
  const before = selectSignalTelemetry(observation(map(), .09));
  const after = selectSignalTelemetry(observation(map(), .1));
  const groups = (telemetry: typeof before, domain: string) => signalPhraseGroups(
    telemetry.domains.find(item => item.id === domain)?.fields ?? [],
  ).map(group => group.map(item => `${item.label}:${item.role}:${item.width ?? 'standard'}`));
  assert.deepEqual(groups(before, 'LEVEL'), groups(after, 'LEVEL'));
  assert.deepEqual(groups(before, 'SPECTRUM'), groups(after, 'SPECTRUM'));
  assert.deepEqual(groups(before, 'TONAL'), groups(after, 'TONAL'));
  assert.deepEqual(groups(before, 'LEVEL'), [['RMS:signal:standard', 'PEAK:signal:standard']]);
  assert.deepEqual(groups(before, 'SPECTRUM').map(group => group.map(item => item.split(':')[0])),
    [['LOW', 'MID', 'HIGH'], ['BRIGHTNESS', 'TEXTURE']]);
  assert.deepEqual(groups(before, 'STRUCTURE').map(group => group.map(item => item.split(':')[0])),
    [['ENERGY', 'ONSET DENSITY', 'NOVELTY'], ['SHORT', 'MEDIUM', 'LONG']]);
  assert.equal(before.domains.find(item => item.id === 'RHYTHM')?.fields.find(item => item.label === 'BPM')?.role, 'anchor');
  assert.equal(before.domains.find(item => item.id === 'TONAL')?.fields.find(item => item.label === 'KEY CANDIDATE')?.role, 'signal');
  assert.equal(before.domains.find(item => item.id === 'TONAL')?.fields.find(item => item.label === 'CHROMA')?.width, 'wide');
});

test('HEARING states are deterministic summaries of accepted capability and retained evidence', () => {
  const accepted = selectSignalTelemetry(observation(map(), 0));
  assert.deepEqual(accepted.hearing.map(item => `${item.id}:${item.status}`), [
    'RHYTHM:STABLE', 'MELODY:STABLE', 'HARMONY:STABLE', 'KEY:STABLE', 'STRUCTURE:STABLE',
  ]);
  const searchingMap = map();
  const rejected = selectSignalTelemetry(observation({ ...searchingMap, capabilities: {
    ...searchingMap.capabilities, harmony: false, tonalCenter: false, structure: false,
  } }, 0));
  assert.equal(rejected.hearing.find(item => item.id === 'STRUCTURE')?.status, 'SEARCHING');
  assert.equal(rejected.hearing.find(item => item.id === 'HARMONY')?.status, 'UNAVAILABLE');
  assert.equal(rejected.hearing.find(item => item.id === 'KEY')?.status, 'UNCERTAIN');
});

test('Melody Inspect retains rejected evidence and five stable candidate lines without accepting a note', () => {
  const sampleRate = 48_000;
  let state = 0x12345678;
  const noise = Float32Array.from({ length: sampleRate }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return ((state / 0xffffffff) * 2 - 1) * 0.45;
  });
  const rejectedMap = analyzePcmAudio({ sampleRate, channels: [noise] }, {
    id: 'rejected-melody', filename: 'noise.wav', mimeType: 'audio/wav',
  });
  const telemetry = selectSignalTelemetry(observation(rejectedMap, 0.3));
  assert.equal(rejectedMap.capabilities.melody, false);
  assert.equal(rejectedMap.melody, null);
  assert.equal(telemetry.hearing.find(item => item.id === 'MELODY')?.status, 'UNCERTAIN');
  assert.equal(telemetry.melodyInspect.candidates.length, 5);
  assert.notEqual(telemetry.melodyInspect.generation.find(item => item.label === 'OUTCOME')?.value, '—');
  assert.notEqual(telemetry.melodyInspect.generation.find(item => item.label === 'SEARCH')?.value, '—');
  assert.match(telemetry.melodyInspect.decision.find(item => item.label === 'RESULT')?.value ?? '', /REJECTED/);
  assert.notEqual(telemetry.melodyInspect.decision.find(item => item.label === 'REASON')?.value, '—');

  const silentMap = analyzePcmAudio({ sampleRate, channels: [new Float32Array(sampleRate)] }, {
    id: 'silent-melody', filename: 'silence.wav', mimeType: 'audio/wav',
  });
  const silent = selectSignalTelemetry(observation(silentMap, 0.3));
  assert.equal(silent.melodyInspect.candidates.length, telemetry.melodyInspect.candidates.length);
  assert.equal(silent.hearing.find(item => item.id === 'MELODY')?.status, 'UNAVAILABLE');
  assert.equal(silent.melodyInspect.generation.find(item => item.label === 'ATTEMPTED')?.value, 'NO');
  assert.equal(silent.melodyInspect.generation.find(item => item.label === 'OUTCOME')?.value,
    'NOT_ATTEMPTED_RMS_GATE');
  assert.equal(silent.melodyInspect.generation.find(item => item.label === 'RMS GATE')?.value, '0.0025');
});

test('Melody Inspect renders explicit below/above provenance separately from usable Candidate 1–5', () => {
  const sampleRate = 48_000;
  const tone = (frequency: number) => Float32Array.from({ length: sampleRate }, (_, index) =>
    0.8 * Math.sin(2 * Math.PI * frequency * index / sampleRate));
  const belowMap = analyzePcmAudio({ sampleRate, channels: [tone(75)] }, {
    id: 'below-range', filename: 'below.wav', mimeType: 'audio/wav',
  });
  const aboveMap = analyzePcmAudio({ sampleRate, channels: [tone(1400)] }, {
    id: 'above-range', filename: 'above.wav', mimeType: 'audio/wav',
  });
  const below = selectSignalTelemetry(observation(belowMap, .4, 8, false));
  const above = selectSignalTelemetry(observation(aboveMap, .4, 9, false));
  assert.equal(below.melodyInspect.rejectedSummary.find(item => item.label === 'TOTAL')?.value, '1');
  assert.equal(below.melodyInspect.generation.find(item => item.label === 'OUTCOME')?.value,
    'RAW_CANDIDATES_ALL_RANGE_REJECTED');
  assert.match(below.melodyInspect.rejectedCandidates[0].fields[0].value, /BELOW_PITCH_RANGE/);
  assert.equal(below.melodyInspect.candidates[0].fields[0].value, '—');
  assert.match(above.melodyInspect.rejectedCandidates[0].fields[0].value, /ABOVE_PITCH_RANGE/);
  assert.notEqual(above.melodyInspect.candidates[0].fields[0].value, '—');
  assert.equal(below.indexes.melodyEvidence, above.indexes.melodyEvidence);
  assert.notEqual(below.signature, above.signature);
});

test('SignalConsole acceptance uses continuous proportional phrases inside fixed group boundaries', () => {
  const component = readFileSync(new URL('../src/signal-console/SignalConsole.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/signal-console/signalConsole.css', import.meta.url), 'utf8');
  assert.match(component, /data-signal-group=/);
  assert.match(component, /data-signal-role=\{item\.role\}/);
  assert.match(component, /signal-separator/);
  assert.match(styles, /\.signal-phrase-layout \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.signal-phrase-group \{[^}]*white-space: nowrap/);
  assert.match(styles, /\[data-signal-role='signal'\] \.signal-value \{[^}]*proportional-nums/);
  assert.match(styles, /\[data-signal-role='anchor'\] \.signal-value \{[^}]*tabular-nums/);
  assert.doesNotMatch(styles, /\.signal-token\[data-signal-role='signal'\][^}]*transition/);
  assert.doesNotMatch(component + styles, /signal-console-grid|signal-field-row|signal-field-group/);
  assert.doesNotMatch(component, /RETAINED PRE-GATE EVIDENCE|ACCEPTED MUSICAL TRUTH|EVENT-DRIVEN|Retained analysis frames/);
  assert.match(component, /<details className="signal-inspect"/);
  assert.doesNotMatch(component, /<details[^>]*open/);
  assert.match(component, /MELODY \/ INSPECT/);
  assert.match(component, /<HearingSummary/);
  assert.match(component, /label="Rejected pre-filter"/);
  assert.match(component, /label="Generation"/);
  assert.match(component, /inspect\.rejectedCandidates\.map/);
  assert.match(readFileSync(new URL('../src/signal-console/signalTelemetry.ts', import.meta.url), 'utf8'),
    /candidate\.reason/);
});

test('validated numeric baseline keeps proportional signals and stable anchors', () => {
  const component = readFileSync(new URL('../src/signal-console/SignalConsole.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/signal-console/signalConsole.css', import.meta.url), 'utf8');
  assert.doesNotMatch(component, /NumericMode|Development numeric mode|signal-number-mode/);
  assert.match(styles, /data-signal-role='signal'[^}]*proportional-nums/);
  assert.match(styles, /data-signal-role='anchor'[^}]*tabular-nums/);
  assert.match(styles, /data-signal-metric='state'[^}]*inline-size: 7ch/);
  assert.match(styles, /data-signal-metric='tonal-center'[^}]*inline-size: 12ch/);
  assert.match(styles, /data-signal-metric='section'[^}]*inline-size: 8ch/);
  assert.match(styles, /data-signal-metric='bpm'[^}]*inline-size: 8ch/);
  assert.doesNotMatch(styles, /transition\s*:|animation\s*:|@keyframes/);
});

test('visual theme tokens do not alter typographic geometry or numeric mode', () => {
  const styles = readFileSync(new URL('../src/signal-console/signalConsole.css', import.meta.url), 'utf8');
  assert.match(styles, /--signal-evidence-strong: var\(--signal-theme-console-signal, #473b5b\)/);
  assert.match(styles, /--signal-anchor: var\(--signal-theme-console-anchor, #242321\)/);
  assert.match(styles, /--signal-interpretation: var\(--signal-theme-console-interpretation, #473b5b\)/);
  assert.match(styles, /data-signal-role='signal'[^}]*proportional-nums/);
  assert.doesNotMatch(styles, /data-signal-visual-mode/);
});

test('Melody evidence hierarchy derives visual weight from existing evidence without layout motion', () => {
  const component = readFileSync(new URL('../src/signal-console/SignalConsole.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/signal-console/signalConsole.css', import.meta.url), 'utf8');
  for (const state of ['accepted', 'active', 'candidate', 'rejected', 'empty']) {
    assert.match(styles, new RegExp(`data-melody-evidence-state='${state}'`));
  }
  assert.match(component, /acceptedNote !== '—' \? 'accepted' : 'empty'/);
  assert.match(component, /candidate\.fields\.some\(item => item\.value !== '—'\) \? 'rejected' : 'empty'/);
  assert.match(component, /candidate\.fields\.some\(item => item\.value !== '—'\) \? 'candidate' : 'empty'/);
  assert.match(styles, /--signal-inspect-accepted: var\(--signal-structure-primary\)/);
  assert.match(styles, /data-melody-evidence-state='accepted'[^}]*font-weight: 800/s);
  assert.match(styles, /data-melody-evidence-state='empty'[^}]*font-weight: 400/s);
  assert.match(styles, /\.signal-telemetry-line \{[^}]*min-height: 1\.15rem/);
  assert.doesNotMatch(styles, /transition\s*:|animation\s*:|@keyframes/);
  assert.doesNotMatch(styles, /data-melody-evidence-state[^}]*display:\s*none/);
});

test('SignalConsole uses one presentation loop and contains no ride or PhysicsWorld dependency', () => {
  const component = readFileSync(new URL('../src/signal-console/SignalConsole.tsx', import.meta.url), 'utf8');
  const selector = readFileSync(new URL('../src/signal-console/signalTelemetry.ts', import.meta.url), 'utf8');
  assert.equal((component.match(/requestAnimationFrame/g) ?? []).length, 2);
  assert.doesNotMatch(component + selector, /setInterval|Carousel|FerrisWheel|PirateShip|BumperCars|DropTower|RollerCoaster|FreeBodies|PhysicsWorld|\.\.\/rides|\.\.\/physics/);
  assert.match(component, /data-signal-layer="interpretation"/);
  assert.match(component, /layer=\{domain\.layer\}/);
  assert.match(component, /data-signal-layer=\{layer\}/);
});

test('experience exposes only a typed read-only observation seam for SignalConsole', () => {
  const source = readFileSync(new URL('../src/experience/createExperience.ts', import.meta.url), 'utf8');
  const types = readFileSync(new URL('../src/signal-console/types.ts', import.meta.url), 'utf8');
  assert.match(types, /type SignalConsoleObservation = Readonly<\{/);
  assert.match(source, /observeSignalConsole: \(\): SignalConsoleObservation/);
  assert.match(source, /const transport = clock\.read\(\)/);
  assert.match(source, /melodyEvidence: selectMelodyEvidenceForTransport\(activeMap\.melodyEvidence, transport\)/);
  assert.match(source, /audioMap: activeMap/);
});
