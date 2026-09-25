import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { selectSignalInterpretationFields, selectSignalTelemetry, signalPhraseGroups,
  TEMPORAL_RESIDUE_POLICY } from '../src/instrument-ui/signal-console/signalTelemetry.ts';
import { listeningFieldBeatEmphasis, selectPrimaryListeningView } from '../src/instrument-ui/signal-console/primaryListening.ts';
import type { SignalConsoleObservation } from '../src/instrument-ui/signal-console/types.ts';
import { analyzePcmListening, lookupListeningSnapshot } from '@computational-listening/engine';
import type { InstrumentListeningMap, BrowserTransportState } from '../src/instrument-ui/contracts.ts';
import { selectMelodyEvidenceForTransport } from '@computational-listening/engine';

function map(id = 'signal-map', rms: readonly [number, number] = [.284, .291]): InstrumentListeningMap {
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
    structureAnalysis: { frames: [
      { id: 'st0', start: 0, end: 1, vector: [], energy: .25, onsetDensity: .2 },
      { id: 'st1', start: 1, end: 2, vector: [], energy: .75, onsetDensity: .6 },
    ], novelty: [.1, .8], noveltyScales: { short: [.11, .7], medium: [.12, .6], long: [.13, .5] } },
  } as unknown as InstrumentListeningMap;
}

const lookupSnapshot = (audioMap: InstrumentListeningMap, transport: BrowserTransportState) => ({
  ...lookupListeningSnapshot(audioMap, transport.time), mapId: audioMap.id, transport,
});

const observation = (audioMap: InstrumentListeningMap, time: number, revision = 0, playing = true): SignalConsoleObservation => ({
  audioMap, mapRevision: revision, transport: { time, duration: audioMap.duration, playing },
});
const field = (telemetry: ReturnType<typeof selectSignalTelemetry>, domain: string, label: string) =>
  telemetry.domains.find(item => item.id === domain)?.fields.find(item => item.label === label)?.value;
const interpretationField = (audioMap: InstrumentListeningMap, time: number, ended: boolean) => {
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

test('low-confidence retained Melody frame remains visible as interpretation evidence', () => {
  const telemetry = selectSignalTelemetry(observation(map(), .01));
  assert.equal(field(telemetry, 'MELODY FRAME', 'PITCH HZ'), '487.26');
  assert.equal(field(telemetry, 'MELODY FRAME', 'FRAME CONF'), '0.120');
  assert.equal(field(telemetry, 'MELODY FRAME', 'SALIENCE'), '0.190');
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
  assert.equal(field(ended, 'MELODY FRAME', 'PITCH HZ'), '489.02');
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
    ['MELODY FRAME', 'FRAME CONF'], ['TONAL', 'ENERGY'], ['TONAL', 'KEY CONF'], ['STRUCTURE', 'NOVELTY'],
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
  assert.equal(field(restarted, 'MELODY FRAME', 'PITCH HZ'), '487.26');
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
  const rejectedMap = analyzePcmListening({ sampleRate, channels: [noise] }, {
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

  const silentMap = analyzePcmListening({ sampleRate, channels: [new Float32Array(sampleRate)] }, {
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
  const belowMap = analyzePcmListening({ sampleRate, channels: [tone(75)] }, {
    id: 'below-range', filename: 'below.wav', mimeType: 'audio/wav',
  });
  const aboveMap = analyzePcmListening({ sampleRate, channels: [tone(1400)] }, {
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

test('SignalConsole uses semantic typography inside fixed phrase-group boundaries', () => {
  const component = readFileSync(new URL('../src/instrument-ui/signal-console/SignalConsole.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/instrument-ui/signal-console/signalConsole.css', import.meta.url), 'utf8');
  assert.match(component, /data-signal-group=/);
  assert.match(component, /data-signal-role=\{item\.role\}/);
  assert.match(component, /data-typography=\{musicalMetrics\.includes\(item\.label\) \? 'musical' : 'code'\}/);
  assert.match(component, /signal-separator/);
  assert.match(styles, /\.signal-phrase-layout \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(styles, /\.signal-phrase-group \{[^}]*white-space: nowrap/);
  assert.match(styles, /\[data-signal-role='signal'\] \.signal-value \{[^}]*proportional-nums/);
  assert.match(styles, /\[data-signal-role='anchor'\] \.signal-value \{[^}]*tabular-nums/);
  assert.doesNotMatch(styles, /\.signal-token\[data-signal-role='signal'\][^}]*transition/);
  assert.doesNotMatch(component + styles, /signal-console-grid|listening-field-row|listening-field-group/);
  assert.doesNotMatch(component, /RETAINED PRE-GATE EVIDENCE|ACCEPTED MUSICAL TRUTH|EVENT-DRIVEN|Retained analysis frames/);
  assert.match(component, /<details className="signal-inspect"/);
  assert.match(component, /open=\{defaultOpen \|\| undefined\}/);
  assert.match(component, /open=\{composition === 'performance' \|\| undefined\}/);
  assert.doesNotMatch(component, /data-signal-domain="source-system"[^>]*open=/);
  assert.match(component, /MELODY \/ INSPECT/);
  assert.match(component, /LISTENING MODELS/);
  assert.doesNotMatch(component, />HEARING</);
  assert.match(component, /label="Rejected pre-filter"/);
  assert.match(component, /label="Generation"/);
  assert.match(component, /rejectedCandidates\.map/);
  assert.match(readFileSync(new URL('../src/instrument-ui/signal-console/signalTelemetry.ts', import.meta.url), 'utf8'),
    /candidate\.reason/);
});

test('numeric geometry remains independent from semantic font selection', () => {
  const component = readFileSync(new URL('../src/instrument-ui/signal-console/SignalConsole.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/instrument-ui/signal-console/signalConsole.css', import.meta.url), 'utf8');
  assert.doesNotMatch(component, /NumericMode|Development numeric mode|signal-number-mode/);
  assert.match(styles, /data-signal-role='signal'[^}]*proportional-nums/);
  assert.match(styles, /data-signal-role='anchor'[^}]*tabular-nums/);
  assert.match(styles, /signal-token\[data-typography='code'\][^}]*font-family: var\(--signal-font-mono\)/s);
  assert.match(styles, /signal-token\[data-typography='musical'\][^}]*font-family: var\(--signal-font-sans\)/s);
  assert.match(styles, /signal-transport-values strong[^}]*inline-size: 7ch/);
  assert.match(styles, /data-signal-metric='tonal-center'[^}]*inline-size: 12ch/);
  assert.match(styles, /data-signal-metric='section'[^}]*inline-size: 8ch/);
  assert.match(styles, /data-signal-metric='bpm'[^}]*inline-size: 8ch/);
  assert.doesNotMatch(styles, /transition\s*:|animation\s*:|@keyframes/);
});

test('visual theme tokens do not alter typographic geometry or numeric mode', () => {
  const styles = readFileSync(new URL('../src/instrument-ui/signal-console/signalConsole.css', import.meta.url), 'utf8');
  assert.match(styles, /--signal-evidence-strong: var\(--signal-theme-console-signal, #473b5b\)/);
  assert.match(styles, /--signal-anchor: var\(--signal-theme-console-anchor, #242321\)/);
  assert.match(styles, /--signal-interpretation: var\(--signal-theme-console-interpretation, #473b5b\)/);
  assert.match(styles, /data-signal-role='signal'[^}]*proportional-nums/);
  assert.doesNotMatch(styles, /data-signal-visual-mode/);
});

test('Field typography follows evidence semantics instead of component identity', () => {
  const component = readFileSync(new URL('../src/instrument-ui/signal-console/ListeningField.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/instrument-ui/signal-console/signalConsole.css', import.meta.url), 'utf8');
  for (const value of ['primary.signal.level', 'primary.signal.transient', 'primary.signal.low',
    'primary.signal.mid', 'primary.signal.high', 'primary.harmony.hypothesis', 'primary.structure.progress']) {
    assert.match(component, new RegExp(`typography="code"[^>]*[\\s\\S]{0,90}\\{${value.replaceAll('.', '\\.')}`));
  }
  for (const value of ['primary.observedPitch.noteName', 'primary.melody.identity', 'primary.rhythm.bpm',
    'primary.percussion.hit', 'primary.harmony.chord', 'primary.tonalCenter.identity', 'primary.structure.identity']) {
    assert.match(component, new RegExp(`typography="musical"[^>]*[\\s\\S]{0,100}\\{${value.replaceAll('.', '\\.')}`));
  }
  assert.match(component, /listening-field-event" data-typography="musical"/);
  assert.match(component, /listening-field-boundary" data-typography="code"/);
  assert.match(component, /listening-field-hypothesis" data-typography="code"/);
  assert.match(styles, /\.listening-field-cognition \{[\s\S]*var\(--signal-font-mono\)/);
  assert.doesNotMatch(styles, /data-signal-role='anchor'[^}]*font-family/);
  assert.doesNotMatch(styles, /\.listening-field-signal \.listening-field-identity \{[^}]*font-family/s);
});

test('Melody evidence hierarchy derives visual weight from existing evidence without layout motion', () => {
  const component = readFileSync(new URL('../src/instrument-ui/signal-console/SignalConsole.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/instrument-ui/signal-console/signalConsole.css', import.meta.url), 'utf8');
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

test('SignalConsole uses one presentation loop', () => {
  const component = readFileSync(new URL('../src/instrument-ui/signal-console/SignalConsole.tsx', import.meta.url), 'utf8');
  const selector = readFileSync(new URL('../src/instrument-ui/signal-console/signalTelemetry.ts', import.meta.url), 'utf8');
  assert.equal((component.match(/requestAnimationFrame/g) ?? []).length, 2);
  assert.doesNotMatch(component + selector, /setInterval/);
  assert.match(component, /selectPrimaryListeningView\(telemetry, interpretation, events\)/);
  assert.match(component, /data-time-scale=/);
  assert.match(component, /data-signal-layer=\{layer\}/);
});

test('primary listening projection preserves model logic and separates evidence from accepted interpretation', () => {
  const telemetry = selectSignalTelemetry(observation(map(), .2));
  const snapshot = lookupSnapshot(map(), { time: .2, duration: 2, playing: true });
  const frame = { snapshot: {
    ...snapshot,
    melody: { ...snapshot.melody, available: true, active: true, noteName: 'C#3' },
    harmony: { ...snapshot.harmony, available: true, active: true, chord: 'A minor', confidence: .81 },
    percussion: { ...snapshot.percussion, available: true, activity: .64 },
    tonalCenter: { ...snapshot.tonalCenter, available: true, label: 'A minor', confidence: .72 },
    structure: { ...snapshot.structure, available: true, label: 'section-3', sectionProgress: .64 },
  }, events: [] };
  const projected = selectPrimaryListeningView({ ...telemetry, primaryEvidence: {
    ...telemetry.primaryEvidence,
    harmony: { chroma: '.10 .00 .00 .00 .30 .00 .00 .20 .00 .40 .00 .00',
      hypothesis: 'A minor', frameConfidence: '.620' },
  } }, frame, [
    { type: 'note-on', time: .1, note: { id: 'n', start: .1, end: 1, midi: 49, noteName: 'C#3', intensity: .8 } },
    { type: 'snare', time: .1, id: 'snare', strength: .82, confidence: .7,
      hit: { id: 'snare', time: .1, type: 'snare', strength: .82 } },
    { type: 'beat', time: .1, id: 'beat', index: 4, strength: .8 },
    { type: 'chord-change', time: .1, harmony: { id: 'h', start: .1, end: 1,
      chord: 'A minor', rootPitchClass: 9, pitchClasses: [9, 0, 4], confidence: .81 } },
  ]);
  assert.deepEqual(projected.listeningModels, telemetry.hearing);
  assert.equal(projected.melody.identity, 'C#3');
  assert.equal(projected.melody.state, 'ACCEPTED');
  assert.equal(projected.harmony.hypothesis, 'A minor');
  assert.equal(projected.harmony.chord, 'A minor');
  assert.equal(projected.harmony.state, 'ACCEPTED');
  assert.equal(projected.percussion.hit, 'SNARE');
  assert.equal(projected.percussion.strength, '0.820');
  assert.equal(projected.structure.identity, 'SECTION 03');
});

test('below-range observed pitch remains primary evidence while Melody reports searching', () => {
  const telemetry = selectSignalTelemetry(observation(map(), .2));
  const projected = selectPrimaryListeningView({ ...telemetry, primaryEvidence: {
    ...telemetry.primaryEvidence,
    observedPitch: { frequencyHz: '79.73', noteName: 'D#2', score: '.714', rangeStatus: 'BELOW MELODY RANGE' },
  } }, { snapshot: lookupSnapshot({ ...map(), capabilities: { ...map().capabilities, melody: false }, melody: null } as InstrumentListeningMap,
    { time: .2, duration: 2, playing: true }), events: [] }, []);
  assert.equal(projected.observedPitch.frequencyHz, '79.73');
  assert.equal(projected.observedPitch.rangeStatus, 'BELOW MELODY RANGE');
  assert.equal(projected.melody.state, 'SEARCHING');
});

test('event emphasis is a deterministic projection of authoritative event age', () => {
  const audioMap = map();
  const event = { type: 'beat' as const, time: .1, id: 'beat', index: 1, strength: .8 };
  const atTime = (time: number) => {
    const telemetry = selectSignalTelemetry(observation(audioMap, time));
    return selectPrimaryListeningView(telemetry,
      { snapshot: lookupSnapshot(audioMap, { time, duration: 2, playing: true }), events: [] }, [event]).rhythm.emphasis;
  };
  assert.equal(atTime(.2), 'current');
  assert.equal(atTime(.4), 'recent');
  assert.equal(atTime(.6), 'none');
});

test('Listening Field beat emphasis returns to baseline within each beat interval', () => {
  const bpm = 146.5;
  const interval = 60 / bpm;
  assert.equal(listeningFieldBeatEmphasis(.05, bpm), 'current');
  assert.equal(listeningFieldBeatEmphasis(.2, bpm), 'recent');
  assert.equal(listeningFieldBeatEmphasis(interval * .76, bpm), 'none');
  assert.equal(listeningFieldBeatEmphasis(interval - .001, bpm), 'none');
  assert.equal(listeningFieldBeatEmphasis(.2, null), 'none');
});

test('temporal score composition keeps primary order, forensic disclosures, and fixed placeholders', () => {
  const component = readFileSync(new URL('../src/instrument-ui/signal-console/SignalConsole.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/instrument-ui/signal-console/signalConsole.css', import.meta.url), 'utf8');
  const ordered = ['scale="FAST"', 'scale="SHORT"', 'scale="BEAT"', 'scale="SLOW"', 'scale="SECTION"'];
  ordered.reduce((position, marker) => {
    const next = component.indexOf(marker);
    assert.ok(next > position, `${marker} must follow the previous temporal band`);
    return next;
  }, -1);
  assert.match(component, /name="PERCUSSION"/);
  assert.match(component, /label="HYPOTHESIS"/);
  assert.match(component, /label="CHORD"/);
  assert.doesNotMatch(component.slice(component.indexOf('signal-temporal-score'), component.indexOf('signal-performance-band')), /MELODY FRAME|barPhase|SOURCE/);
  assert.match(component, /<summary>RECENT EVENTS<\/summary>/);
  assert.match(component, /<summary>SOURCE \/ SYSTEM<\/summary>/);
  assert.match(styles, /\.signal-primary-line \{[^}]*min-height: 1\.8rem/s);
  assert.match(styles, /\.signal-console section \{[^}]*background: transparent/s);
  assert.match(styles, /data-event-emphasis='current'/);
  assert.doesNotMatch(styles, /transition\s*:|animation\s*:|@keyframes/);
});

test('Listening Field reuses the primary listening projection through a presentation-only variant', () => {
  const component = readFileSync(new URL('../src/instrument-ui/signal-console/SignalConsole.tsx', import.meta.url), 'utf8');
  const fieldComponent = readFileSync(new URL('../src/instrument-ui/signal-console/ListeningField.tsx', import.meta.url), 'utf8');
  const player = readFileSync(new URL('../src/instrument-ui/signal-player/SignalPlayer.tsx', import.meta.url), 'utf8');
  const host = readFileSync(new URL('../src/ZoeApp.tsx', import.meta.url), 'utf8');
  assert.equal((component.match(/selectPrimaryListeningView\(/g) ?? []).length, 1);
  assert.match(component, /composition = 'temporal-score'/);
  assert.match(component, /<ListeningField primary=\{primary\}/);
  assert.match(player, /composition\?: SignalComposition/);
  assert.match(player, /composition=\{composition\}/);
  assert.match(host, /composition="performance"/);
  assert.doesNotMatch(fieldComponent, /selectSignalTelemetry|requestAnimationFrame|setInterval/);
});

test('Performance Surface keeps permanent model orientation and opens performance layers by default', () => {
  const component = readFileSync(new URL('../src/instrument-ui/signal-console/SignalConsole.tsx', import.meta.url), 'utf8');
  const fieldComponent = readFileSync(new URL('../src/instrument-ui/signal-console/ListeningField.tsx', import.meta.url), 'utf8');
  assert.match(component, /composition === 'performance'/);
  assert.match(component, /defaultOpen=\{composition === 'performance'\}/);
  assert.match(component, /open=\{composition === 'performance' \|\| undefined\}/);
  assert.match(component, /<summary>SOURCE \/ SYSTEM<\/summary>/);
  assert.doesNotMatch(component, /data-signal-domain="source-system"[^>]*open=/);
  assert.match(component, /signal-console-heading--performance/);
  assert.match(component, /signal-performance-models" aria-label="Listening models"/);
  assert.match(fieldComponent, /showModels \? <ModelIndex/);
  assert.match(component, /showModels=\{composition !== 'performance'\}/);
  assert.match(fieldComponent, /performance \? null : <div className="listening-field-transport"/);
});

test('Performance Surface uses unequal field heights and keeps uncertainty evidence production-backed', () => {
  const styles = readFileSync(new URL('../src/instrument-ui/signal-console/signalConsole.css', import.meta.url), 'utf8');
  assert.match(styles, /--performance-pitch-height: 9\.25rem/);
  assert.match(styles, /--performance-signal-height: 3rem/);
  assert.match(styles, /--performance-rhythm-height: 3\.5rem/);
  assert.match(styles, /--performance-residue-height: 4\.75rem/);
  assert.match(styles, /--performance-structure-height: 3\.2rem/);
  assert.match(styles, /grid-template-columns: minmax\(0, 2\.65fr\) minmax\(14rem, 1fr\)/);
  assert.match(styles, /@media \(max-width: 900px\)[\s\S]*signal-performance-band \{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
  assert.doesNotMatch(styles, /transition\s*:|animation\s*:|@keyframes/);
});

test('Single-viewport performance format keeps core truth in one bounded desktop band', () => {
  const component = readFileSync(new URL('../src/instrument-ui/signal-console/SignalConsole.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/instrument-ui/signal-console/signalConsole.css', import.meta.url), 'utf8');
  const player = readFileSync(new URL('../src/instrument-ui/signal-player/SignalPlayer.tsx', import.meta.url), 'utf8');
  const playerStyles = readFileSync(new URL('../src/instrument-ui/signal-player/signalPlayer.css', import.meta.url), 'utf8');
  assert.match(component, /data-inspect-format=\{performance \? 'performance' : 'forensic'\}/);
  assert.match(component, /performance\s*\? inspect\.rejectedCandidates\.filter/);
  assert.match(component, /\{ label: 'COUNT', value: `\$\{rejectedTotal\}\/\$\{rejectedCapacity\}`/);
  assert.match(component, /Number\.isFinite\(rejectedTotalValue\) \? rejectedTotalValue : filledRejectedCount/);
  assert.match(component, /String\(inspect\.rejectedCandidates\.length\)/);
  for (const [key, label] of [['frame', 'FRAME'], ['generation', 'GEN'], ['rejected', 'REJ'],
    ['path', 'PATH'], ['decision', 'DEC'], ['track', 'TRACK'], ['accepted', 'NOTE']]) {
    assert.match(component, new RegExp(`${key}: '${label}'`));
  }
  assert.match(component, /events\.slice\(-8\)\.reverse\(\)/);
  assert.match(component, /inspect\.candidates\.map\(\(candidate, index\)/);
  for (const family of ['inspect.frame', 'inspect.generation', 'inspect.path', 'inspect.decision', 'inspect.track']) {
    assert.match(component, new RegExp(`fields=\\{${family.replace('.', '\\.')}`));
  }
  assert.match(component, /fields=\{accepted\}/);
  assert.match(component, /<div className="signal-performance-band">/);
  assert.match(component, /<footer className="signal-system-footer">/);
  assert.ok(component.indexOf('<div className="signal-performance-band">')
    < component.indexOf('<footer className="signal-system-footer">'));
  assert.doesNotMatch(component, /data-signal-domain="source-system"[^>]*open=/);
  assert.match(styles, /min-height: clamp\(13rem, 23vh, 14rem\)/);
  assert.match(styles, /data-inspect-format='performance'[\s\S]*grid-template-columns: 3\.25rem minmax\(0, 1fr\)/);
  assert.match(styles, /--performance-pitch-height: 9\.25rem/);
  assert.match(styles, /--performance-signal-height: 3rem/);
  assert.match(styles, /--performance-rhythm-height: 3\.5rem/);
  assert.match(styles, /--performance-structure-height: 3\.2rem/);
  assert.match(styles, /\.listening-field-harmony,[\s\S]*\.listening-field-tonal[\s\S]*--performance-residue-height/);
  assert.match(player, /data-composition=\{composition\}/);
  assert.match(playerStyles, /signal-player\[data-composition='performance'\] \{ padding-block: 1rem; \}/);
  assert.doesNotMatch(playerStyles, /signal-playback--compact \{[^}]*border-bottom/s);
});

test('Performance density pass uses truthful system rails and keeps Pitch Melody expressive', () => {
  const component = readFileSync(new URL('../src/instrument-ui/signal-console/ListeningField.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/instrument-ui/signal-console/signalConsole.css', import.meta.url), 'utf8');
  assert.match(component, /name === 'OBSERVED PITCH \/ MELODY' \? 'expressive'/);
  assert.match(component, /name === 'HARMONY' \|\| name === 'TONAL CENTER' \? 'residue' : 'rail'/);
  assert.match(component, /data-field-depth=\{depth\} data-field-form=\{form\}/);
  assert.match(styles, /\[data-field-form='rail'\][\s\S]*flex-wrap: nowrap/);
  assert.match(styles, /\.listening-field-signal \.listening-field-identity \{[\s\S]*font-size: \.9rem/);
  assert.match(styles, /\.listening-field-candidate \{[\s\S]*min-height: \.82rem/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*\[data-field-form='rail'\][\s\S]*flex-wrap: wrap/);
  assert.doesNotMatch(component + styles, /scanline|glitch|chromatic|hexagon|warning-stripe|text-shadow|box-shadow/i);
});

test('Uncertainty Field projects retained Melody candidates without changing their production order', () => {
  const sampleRate = 48_000;
  const tone = Float32Array.from({ length: sampleRate }, (_, index) =>
    .66 * Math.sin(2 * Math.PI * 220 * index / sampleRate)
    + .24 * Math.sin(2 * Math.PI * 440 * index / sampleRate));
  const audioMap = analyzePcmListening({ sampleRate, channels: [tone] }, {
    id: 'uncertainty-melody', filename: 'uncertainty.wav', mimeType: 'audio/wav',
  });
  const transport = { time: .4, duration: audioMap.duration, playing: true };
  const retained = selectMelodyEvidenceForTransport(audioMap.melodyEvidence, transport);
  const projected = selectSignalTelemetry({ audioMap, mapRevision: 1, transport })
    .primaryEvidence.uncertainty.melody.candidates;
  assert.ok((retained?.candidates.length ?? 0) > 0);
  assert.ok(projected.length <= 3);
  assert.deepEqual(projected.map(candidate => candidate.noteName),
    retained?.candidates.slice(0, 3).map(candidate => candidate.noteName));
  assert.deepEqual(projected.map(candidate => candidate.frequencyHz),
    retained?.candidates.slice(0, 3).map(candidate => candidate.pitchHz.toFixed(2)));
  assert.deepEqual(projected.map(candidate => candidate.score),
    retained?.candidates.slice(0, 3).map(candidate => candidate.score.toFixed(3)));
});

test('Uncertainty Field projects retained Harmony and Tonal top, second, and margin evidence', () => {
  const audioMap = map();
  const chord = (label: string, rootPitchClass: number, score: number) => ({
    label, rootPitchClass, quality: 'minor' as const,
    pitchClasses: [rootPitchClass, (rootPitchClass + 3) % 12, (rootPitchClass + 7) % 12], score,
  });
  const tonal = (label: string, rootPitchClass: number, score: number) => ({
    label, rootPitchClass, mode: 'minor' as const, score,
    profileScore: score, tonicSupport: score, chordSupport: score,
  });
  const enriched = { ...audioMap,
    harmonyAnalysis: { ...audioMap.harmonyAnalysis!, frames: audioMap.harmonyAnalysis!.frames.map((frame, index) =>
      index === 0 ? { ...frame, topCandidate: chord('G major', 7, .24),
        secondCandidate: chord('G# minor', 8, .22), scoreMargin: .02 } : frame) },
    tonalCenterAnalysis: { ...audioMap.tonalCenterAnalysis!, frames: audioMap.tonalCenterAnalysis!.frames.map((frame, index) =>
      index === 0 ? { ...frame, topCandidate: tonal('C minor', 0, .58),
        secondCandidate: tonal('G minor', 7, .51), topScore: .58, secondScore: .51, margin: .07 } : frame) },
  } as InstrumentListeningMap;
  const uncertainty = selectSignalTelemetry(observation(enriched, .1)).primaryEvidence.uncertainty;
  assert.deepEqual(uncertainty.harmony, {
    top: { identity: 'G major', score: '0.240' },
    second: { identity: 'G# minor', score: '0.220' }, margin: '0.020', history: [], changed: true,
  });
  assert.deepEqual(uncertainty.tonalCenter, {
    top: { identity: 'C minor', score: '0.580' },
    second: { identity: 'G minor', score: '0.510' }, margin: '0.070', history: [], changed: true,
  });
});

test('Uncertainty Field keeps cognition geometry across accepted states and adds no animation clock', () => {
  const component = readFileSync(new URL('../src/instrument-ui/signal-console/ListeningField.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/instrument-ui/signal-console/signalConsole.css', import.meta.url), 'utf8');
  assert.match(component, /Array\.from\(\{ length: cap \}/);
  assert.match(component, /accepted \|\| !active \? 'settled'/);
  assert.match(component, /transport\.playing && !ended && primary\.uncertainty\.melody\.changed/);
  assert.match(component, /primary\.uncertainty\.harmony\.changed/);
  assert.match(component, /primary\.uncertainty\.tonalCenter\.changed/);
  assert.match(component, /data-composition=\{performance \? 'performance' : uncertainty \? 'listening-field-uncertainty' : 'listening-field'\}/);
  assert.match(styles, /--field-cognition: #40584a/);
  assert.match(styles, /--field-active: #62f296/);
  assert.match(styles, /--field-foreground: #edf8f0/);
  assert.match(styles, /data-cognition-activity='active'/);
  assert.match(styles, /data-cognition-activity='settled'/);
  assert.match(styles, /nth-child\(3\) \{ visibility: hidden; \}/);
  assert.doesNotMatch(component + styles, /setInterval|setTimeout|@keyframes|animation\s*:|transition\s*:/);
  assert.doesNotMatch(styles, /data-cognition-activity[^}]*display:\s*none/);
});

test('Listening Field removes time blocks and peripheral metrics from its primary field', () => {
  const component = readFileSync(new URL('../src/instrument-ui/signal-console/ListeningField.tsx', import.meta.url), 'utf8');
  for (const voice of ['SIGNAL', 'OBSERVED PITCH / MELODY', 'RHYTHM / PERCUSSION', 'HARMONY',
    'TONAL CENTER', 'STRUCTURE']) assert.match(component, new RegExp(`name="${voice}"`));
  assert.equal((component.match(/listening-field-now-rule/g) ?? []).length, 1);
  assert.doesNotMatch(component, /FAST|SHORT|BEAT" detail|SLOW|SECTION" detail/);
  assert.doesNotMatch(component, /\.chroma|\.brightness|\.spectralChange|\.phase|\.activity|\.novelty/);
  assert.doesNotMatch(component, /periodicity|salience|threshold|FFT|hop/i);
  assert.doesNotMatch(component, /hypothesisConfidence|tonalCenter\.confidence/);
  assert.match(component, /data-field-alignment=\{pitchAligned \? 'aligned' : 'separated'\}/);
  assert.match(component, /primary\.observedPitch\.rangeStatus/);
  assert.match(component, /primary\.rhythm\.listeningFieldEmphasis/);
  assert.match(component, /primary\.harmony\.hypothesis/);
  assert.match(component, /primary\.harmony\.chord/);
});

test('Listening Field CSS preserves one responsive field, fixed depth rows, and scroll anchoring', () => {
  const styles = readFileSync(new URL('../src/instrument-ui/signal-console/signalConsole.css', import.meta.url), 'utf8');
  assert.match(styles, /\.listening-field-score \{[^}]*display: grid/s);
  assert.match(styles, /\.listening-field-now-rule \{[^}]*grid-row: 1 \/ 7/s);
  assert.match(styles, /\.listening-field-voice \{[^}]*grid-template-columns: subgrid/s);
  assert.match(styles, /\.listening-field-pitch \{[^}]*min-height: 7\.5rem/);
  assert.match(styles, /\.listening-field-structure \{[^}]*min-height: 8rem/);
  assert.match(styles, /@media \(max-width: 800px\)/);
  assert.match(styles, /\.signal-performance-band \{[^}]*overflow-anchor: none/s);
  assert.match(styles, /\.signal-inspect-stream \{[^}]*overflow-anchor: none/s);
  assert.doesNotMatch(styles, /transition\s*:|animation\s*:|@keyframes/);
});

function temporalMap(id = 'temporal-map', offset = 0): InstrumentListeningMap {
  const chord = (index: number, second = false) => ({
    label: `${second ? 'G' : 'C'} ${index % 2 ? 'minor' : 'major'}`,
    rootPitchClass: second ? 7 : 0,
    quality: (index % 2 ? 'minor' : 'major') as 'minor' | 'major',
    pitchClasses: second ? [7, 11, 2] : [0, 4, 7],
    score: Math.min(.99, .3 + offset + index * .02 - (second ? .04 : 0)),
  });
  const tonal = (index: number, second = false) => ({
    label: `${second ? 'G' : 'C'} ${index % 2 ? 'minor' : 'major'}`,
    rootPitchClass: second ? 7 : 0,
    mode: (index % 2 ? 'minor' : 'major') as 'minor' | 'major',
    score: Math.min(.99, .4 + offset + index * .03 - (second ? .05 : 0)),
    profileScore: .8, tonicSupport: .7, chordSupport: .7,
  });
  const harmonyFrames = Array.from({ length: 25 }, (_, index) => ({
    time: index * .1, chroma: Array(12).fill(0), energy: .5, confidence: .7,
    chord: chord(index), topCandidate: chord(index), secondCandidate: chord(index, true), scoreMargin: .04,
  }));
  const tonalFrames = Array.from({ length: 7 }, (_, index) => ({
    time: index * 2, rootPitchClass: 0, mode: 'major' as const, label: 'C major', confidence: .7,
    topCandidate: tonal(index), secondCandidate: tonal(index, true),
    topScore: tonal(index).score, secondScore: tonal(index, true).score, margin: .05, usableCoverage: .8,
  }));
  const acceptedChord = { id: 'chord', start: 0, end: 14, chord: 'C major', rootPitchClass: 0,
    quality: 'major' as const, pitchClasses: [0, 4, 7], confidence: .8 };
  return { ...map(id), id, duration: 14, harmony: [acceptedChord],
    analysis: { ...map(id).analysis!, analyzedDuration: 14 },
    harmonyAnalysis: { version: 1, available: true, confidence: .8, noChordRatio: 0,
      averageSegmentDuration: 14, frames: harmonyFrames,
      segments: [acceptedChord],
      metadata: { analysisSampleRate: 12000, frameSize: 4096, hopSize: 1024,
        frequencyRange: [80, 5000], chordVocabulary: '12-major-12-minor-triads',
        normalization: 'log-compressed-peak-weighted-l1-chroma',
        smoothing: 'three-frame-island-removal-and-minimum-segment', minimumSegmentDuration: .24,
        frameConfidenceThreshold: .52, availabilityThreshold: .6 } },
    tonalCenterAnalysis: { version: 1, available: true, confidence: .8,
      globalTonalCenter: tonal(6), averageSegmentDuration: 14, frames: tonalFrames,
      segments: [{ id: 'tonal', start: 0, end: 14, rootPitchClass: 0, mode: 'major', label: 'C major',
        confidence: .8, circleOfFifthsIndex: 0, distanceFromPrevious: null }],
      metadata: { sourceChroma: 'harmony-analysis-normalized-chroma', windowSize: 8, hopSize: 2,
        majorProfile: Array(12).fill(0), minorProfile: Array(12).fill(0), similarity: 'cosine',
        smoothing: 'non-causal-dynamic-programming-plus-minimum-segment', minimumSegmentDuration: 4,
        minimumUsableDuration: 2, availabilityThreshold: .56, switchPenalty: .11 } },
  } as InstrumentListeningMap;
}

test('Temporal residue selects bounded real retained states at domain-specific cadence', () => {
  assert.deepEqual(TEMPORAL_RESIDUE_POLICY, {
    sampleCount: 3, melodyStepSeconds: .192, harmonyFrameStride: 6, tonalFrameStride: 1,
  });
  const telemetry = selectSignalTelemetry(observation(temporalMap(), 12));
  assert.deepEqual(telemetry.primaryEvidence.uncertainty.harmony.history.map(item => item.index), [18, 12, 6]);
  assert.deepEqual(telemetry.primaryEvidence.uncertainty.tonalCenter.history.map(item => item.index), [5, 4, 3]);
  for (const history of [telemetry.primaryEvidence.uncertainty.harmony.history,
    telemetry.primaryEvidence.uncertainty.tonalCenter.history]) {
    assert.ok(history.length <= TEMPORAL_RESIDUE_POLICY.sampleCount);
    assert.ok(history.every((item, index) => index === 0 || history[index - 1].index > item.index));
  }
});

test('Melody residue uses retained candidate frames without interpolation or repeated density', () => {
  const sampleRate = 48_000;
  const tone = Float32Array.from({ length: sampleRate }, (_, index) =>
    .72 * Math.sin(2 * Math.PI * 220 * index / sampleRate));
  const audioMap = analyzePcmListening({ sampleRate, channels: [tone] }, {
    id: 'melody-residue', filename: 'melody-residue.wav', mimeType: 'audio/wav',
  });
  const telemetry = selectSignalTelemetry(observation(audioMap, .8));
  const history = telemetry.primaryEvidence.uncertainty.melody.history;
  assert.ok(history.length > 0 && history.length <= 3);
  assert.ok(history.every((item, index) => item.index < telemetry.indexes.melodyEvidence
    && (index === 0 || history[index - 1].index > item.index)));
  assert.equal(new Set(history.map(item => item.index)).size, history.length);
  history.forEach(item => assert.deepEqual(item.candidates,
    selectMelodyEvidenceForTransport(audioMap.melodyEvidence, {
      time: item.time, duration: audioMap.duration, playing: true,
    })?.candidates.slice(0, 3).map(candidate => ({
      identity: candidate.noteName, score: candidate.score.toFixed(3),
    }))));
});

test('restart, seek, and AudioMap replacement reconstruct residue without stale UI history', () => {
  const original = temporalMap('same', 0);
  const restarted = selectSignalTelemetry(observation(original, 0, 2, false));
  assert.deepEqual(restarted.primaryEvidence.uncertainty.harmony.history, []);
  assert.deepEqual(restarted.primaryEvidence.uncertainty.tonalCenter.history, []);
  const forward = selectSignalTelemetry(observation(original, 12, 2, false));
  const soughtBack = selectSignalTelemetry(observation(original, 1.2, 2, false));
  assert.notDeepEqual(soughtBack.primaryEvidence.uncertainty.harmony.history,
    forward.primaryEvidence.uncertainty.harmony.history);
  assert.ok(soughtBack.primaryEvidence.uncertainty.harmony.history.every(item => item.time < 1.2));
  const replacement = selectSignalTelemetry(observation(temporalMap('same', .2), 12, 3, false));
  assert.deepEqual(replacement.primaryEvidence.uncertainty.harmony.history.map(item => item.index),
    forward.primaryEvidence.uncertainty.harmony.history.map(item => item.index));
  assert.notDeepEqual(replacement.primaryEvidence.uncertainty.harmony.history,
    forward.primaryEvidence.uncertainty.harmony.history);
});

test('Melody, Harmony, and Tonal gates expose only audited production conditions', () => {
  const sampleRate = 48_000;
  const silence = analyzePcmListening({ sampleRate, channels: [new Float32Array(sampleRate)] }, {
    id: 'gate-silence', filename: 'gate-silence.wav', mimeType: 'audio/wav',
  });
  const melody = selectSignalTelemetry(observation(silence, .5)).primaryEvidence.gates.melody;
  assert.equal(melody?.reason, 'LOW_RMS');
  assert.match(melody?.text ?? '', /^rms 0\.0000 < required 0\.0025$/);
  const belowTone = Float32Array.from({ length: sampleRate }, (_, index) =>
    .72 * Math.sin(2 * Math.PI * 75 * index / sampleRate));
  const below = analyzePcmListening({ sampleRate, channels: [belowTone] }, {
    id: 'gate-below', filename: 'gate-below.wav', mimeType: 'audio/wav',
  });
  const belowGate = selectSignalTelemetry(observation(below, .5)).primaryEvidence.gates.melody;
  assert.equal(belowGate?.reason, 'BELOW_MELODY_RANGE');
  assert.equal(belowGate?.text, 'pitch below melody range');

  const base = temporalMap();
  const lowHarmony = { ...base, harmonyAnalysis: { ...base.harmonyAnalysis!, frames: base.harmonyAnalysis!.frames.map(
    (frame, index) => index === 12 ? { ...frame, confidence: .51, chord: null } : frame) } } as InstrumentListeningMap;
  const harmony = selectSignalTelemetry(observation(lowHarmony, 1.21)).primaryEvidence.gates.harmony;
  assert.equal(harmony?.reason, 'LOW_FRAME_CONFIDENCE');
  assert.equal(harmony?.text, 'confidence 0.510 < required 0.520');

  const lowTonal = { ...base, tonalCenterAnalysis: { ...base.tonalCenterAnalysis!, available: false,
    confidence: .55, segments: [] } } as InstrumentListeningMap;
  const tonal = selectSignalTelemetry(observation(lowTonal, 10)).primaryEvidence.gates.tonalCenter;
  assert.equal(tonal?.reason, 'LOW_TRACK_CONFIDENCE');
  assert.equal(tonal?.text, 'track confidence 0.550 < required 0.560');
  const selector = readFileSync(new URL('../src/instrument-ui/signal-console/signalTelemetry.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(selector, /margin \$\{.*< required/);
});

test('accepted interpretation suppresses stale gates while preserving residue geometry', () => {
  const audioMap = temporalMap();
  const telemetry = selectSignalTelemetry(observation(audioMap, 12));
  const snapshot = lookupSnapshot(audioMap, { time: 12, duration: audioMap.duration, playing: true });
  const primary = selectPrimaryListeningView(telemetry, { snapshot, events: [] }, []);
  assert.equal(primary.harmony.state, 'ACCEPTED');
  assert.equal(primary.harmony.gate, null);
  assert.equal(primary.tonalCenter.gate, null);
  assert.equal(primary.uncertainty.harmony.history.length, 3);
  assert.equal(primary.uncertainty.tonalCenter.history.length, 3);
});

test('Pulse is driven by the existing beat event emphasis and adds no independent clock', () => {
  const component = readFileSync(new URL('../src/instrument-ui/signal-console/ListeningField.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/instrument-ui/signal-console/signalConsole.css', import.meta.url), 'utf8');
  assert.match(component, /data-event-emphasis=\{primary\.rhythm\.listeningFieldEmphasis\}/g);
  assert.match(component, /className="listening-field-pulse"/);
  assert.match(styles, /listening-field-pulse i\[data-event-emphasis='current'\] \{ opacity: 1; \}/);
  assert.doesNotMatch(component + styles, /setInterval|setTimeout|@keyframes|animation\s*:|transition\s*:/);
  assert.equal(listeningFieldBeatEmphasis(.05, 120), 'current');
  assert.equal(listeningFieldBeatEmphasis(.3, 120), 'recent');
  assert.equal(listeningFieldBeatEmphasis(.4, 120), 'none');
});

test('Temporal Cognition presentation keeps fixed residue and gate structure without graphs', () => {
  const component = readFileSync(new URL('../src/instrument-ui/signal-console/ListeningField.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../src/instrument-ui/signal-console/signalConsole.css', import.meta.url), 'utf8');
  assert.match(component, /Array\.from\(\{ length: 3 \}/);
  assert.match(component, /listening-field-residue/);
  assert.match(component, /listening-field-gate/);
  assert.match(component, /showResidue=\{performance\}/);
  assert.match(component, /enabled=\{performance\}/);
  assert.match(component, /performance \? <i aria-hidden="true"/);
  assert.match(styles, /data-residue-age='1'/);
  assert.match(styles, /data-residue-age='2'/);
  assert.match(styles, /data-residue-age='3'/);
  assert.match(styles, /data-gate-reason='none'[^}]*visibility: hidden/);
  assert.doesNotMatch(component + styles, /canvas|svg|sparkline|chart|waveform/i);
});

test('Zoë exposes only a typed read-only observation seam for SignalConsole', () => {
  const source = readFileSync(new URL('../src/ZoeApp.tsx', import.meta.url), 'utf8');
  const types = readFileSync(new URL('../src/instrument-ui/contracts.ts', import.meta.url), 'utf8');
  assert.match(types, /type SignalConsoleObservation = Readonly<\{/);
  assert.match(source, /observe=\{\(\) => \(\{ mapRevision:/);
  assert.match(source, /melodyEvidence: selectMelodyEvidenceForTransport\(mapRef\.current\.melodyEvidence, transportRef\.current\)/);
  assert.match(source, /audioMap: mapRef\.current/);
});
