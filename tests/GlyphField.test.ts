import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import type { BassEvidence, BassSnapshot, MelodyEvidenceObservation } from '@zoeyetc/computational-listening-engine';
import type { InstrumentListeningMap } from '../src/instrument-ui/contracts.ts';
import type { SignalConsoleObservation } from '../src/instrument-ui/signal-console/types.ts';
import { createListeningRecordLifecycle, createPersistentListeningRecord, estimateListeningRecordBytes,
  findListeningRecordSlice, projectListeningRecord,
  type ListeningRecordSession } from '../src/instrument-ui/representations/ListeningRecord.ts';
import { GLYPH_RENDERED_FRAME_LIMIT, glyphColumnFromSlice,
  selectedPathLinks, type GlyphFieldColumn } from '../src/instrument-ui/representations/glyphFieldModel.ts';

const melodyEvidence: MelodyEvidenceObservation = {
  frameIndex: 12, time: 1.2, rms: .2,
  candidates: [
    { rank: 1, pitchHz: 440, midiFloat: 69, noteName: 'A4', periodicity: .9, salience: .8, score: .84 },
    { rank: 2, pitchHz: 329.63, midiFloat: 64, noteName: 'E4', periodicity: .7, salience: .55, score: .52 },
    { rank: 3, pitchHz: 261.63, midiFloat: 60, noteName: 'C4', periodicity: .6, salience: .48, score: .44 },
  ],
  generation: { attempted: true, outcome: 'USABLE_CANDIDATES_SURVIVED', searchMode: 'LOCAL_MINIMA',
    localMinimumCount: 3, rawCandidateCount: 3, inRangeCandidateCountBeforeDeduplication: 3,
    duplicateCandidateRemovalCount: 0 },
  outOfRangeCandidateCount: 0, rejectedCandidates: [],
  observedPitch: { frequencyHz: 440, midi: 69, noteName: 'A4', score: .84,
    source: 'USABLE_CANDIDATE', melodyRangeStatus: 'IN_RANGE', rangeReason: null },
  selectedCandidateIndex: 0, selectedPitchHz: 440, selectedMidiFloat: 69,
  finalPitchHz: 440, finalMidiFloat: 69, finalConfidence: .76, finalSalience: .8,
  voiced: true, stage: 'frame', reason: 'VOICED',
};

const selectedBass: BassSnapshot = {
  time: 1.2, available: true, pitchHz: 82.41, midiFloat: 40,
  candidateScore: .61, reason: 'SELECTED',
};
const bassEvidence: BassEvidence = {
  version: 1, source: 'melody-candidate-evidence-v1',
  frames: [{ time: 1.2, candidates: [
    { pitchHz: 82.41, midiFloat: 40, score: .61, periodicity: .8, salience: .7,
      source: 'melody-range-rejected-low', sourceRank: 1 },
    { pitchHz: 110, midiFloat: 45, score: .39, periodicity: .6, salience: .5,
      source: 'melody-usable', sourceRank: 2 },
  ], selectedCandidateIndex: 0, selectedPitchHz: 82.41, selectedMidiFloat: 40,
  selectedScore: .61, reason: 'SELECTED' }],
  path: { version: 1, selectedCandidateIndexes: [0], objective: .61 },
  limitations: { nominalLowerFrequencyBoundHz: 80, upperCandidateFrequencyHz: 330,
    candidatesPrunedByMelody: true, voiceSeparation: false, calibratedConfidence: false },
};

const map = (id = 'field-map') => ({
  id, version: 1, duration: 600,
  capabilities: { melody: true, rhythm: false, percussion: false, harmony: false,
    tonalCenter: false, structure: false, spectrum: false },
  melody: null, percussion: null, rhythm: null, harmony: null, spectrum: null,
  source: { kind: 'real-audio', filename: 'record.wav', mimeType: 'audio/wav' },
}) as InstrumentListeningMap;

function observation(time = 1.2, id = 'field-map', overrides: Partial<SignalConsoleObservation> = {}): SignalConsoleObservation {
  return {
    mapRevision: Math.round(time * 1000), transport: { time, duration: 600, playing: true },
    audioMap: map(id), melodyEvidence: { ...melodyEvidence, frameIndex: Math.round(time * 24), time },
    bassEvidence: { ...bassEvidence, frames: bassEvidence.frames.map(frame => ({ ...frame, time })) },
    bassSnapshot: { ...selectedBass, time }, ...overrides,
  };
}

const fileSession: ListeningRecordSession = { id: 'field-map', kind: 'file', label: 'record.wav' };

test('Persistent Listening Record preserves simultaneous Melody competition and independent Bass evidence', () => {
  const source = observation();
  const before = structuredClone({ melody: source.melodyEvidence, bass: source.bassEvidence });
  const record = createPersistentListeningRecord(fileSession);
  assert.equal(record.capture(source), true);
  const slice = record.getSnapshot().entries[0];
  assert.deepEqual(slice.melody?.candidates.map(candidate => candidate.label), ['A4', 'E4', 'C4']);
  assert.equal(slice.melody?.selectedCandidateIndex, 0);
  assert.deepEqual(slice.bass?.candidates.map(candidate => candidate.label), ['E2', 'A2']);
  assert.equal(slice.bass?.selectedCandidateIndex, 0);
  assert.deepEqual({ melody: source.melodyEvidence, bass: source.bassEvidence }, before);
  const column = glyphColumnFromSlice(slice);
  assert.equal(column.melody.length, 3);
  assert.equal(column.melody.filter(glyph => glyph.kind === 'selected').length, 1);
  assert.equal(column.bass.length, 2);
});

test('record lifecycle survives pause, stop, visual/mode changes, and resets only for an explicit new source/session', () => {
  const record = createPersistentListeningRecord(fileSession);
  record.capture(observation(1.2));
  const retained = record.getSnapshot();
  assert.equal(retained.entries.length, 1);
  assert.strictEqual(record.getSnapshot(), retained, 'no presentation or transport command mutates the record');
  assert.equal(record.capture(observation(2, 'unrelated-map')), false, 'implicit source fallback cannot replace the active record');
  assert.strictEqual(record.getSnapshot(), retained);
  record.beginSession({ id: 'live-input-2', kind: 'live-input', label: 'LIVE INPUT' });
  assert.equal(record.getSnapshot().entries.length, 0);
  assert.equal(record.getSnapshot().session.id, 'live-input-2');
});

test('FILE selection after LIVE preserves LIVE and creates no FILE history until playback activation', () => {
  const record = createPersistentListeningRecord(fileSession);
  const lifecycle = createListeningRecordLifecycle(record);
  record.capture(observation(1, fileSession.id));
  const liveSession: ListeningRecordSession = { id: 'live-input-2', kind: 'live-input', label: 'LIVE INPUT' };
  lifecycle.activateLive(liveSession);
  record.capture(observation(4, liveSession.id));
  const completedLive = record.getSnapshot();

  lifecycle.selectFile(fileSession);
  assert.strictEqual(record.getSnapshot(), completedLive, 'selecting FILE does not activate or fabricate its record');
  assert.equal(record.getSessionSnapshot(fileSession.id)?.entries.length, 1);
  assert.equal(record.getSessionSnapshot(liveSession.id)?.entries.length, 1);
});

test('FILE PLAY after LIVE activates the retained FILE record and cannot append into LIVE', () => {
  const record = createPersistentListeningRecord(fileSession);
  const lifecycle = createListeningRecordLifecycle(record);
  record.capture(observation(1, fileSession.id));
  const liveSession: ListeningRecordSession = { id: 'live-input-3', kind: 'live-input', label: 'LIVE INPUT' };
  lifecycle.activateLive(liveSession);
  record.capture(observation(8, liveSession.id));
  const completedLive = record.getSessionSnapshot(liveSession.id)!;

  lifecycle.selectFile(fileSession);
  assert.equal(lifecycle.activateSelectedFile(), true);
  assert.equal(record.capture(observation(2, fileSession.id)), true);
  assert.equal(record.getSnapshot().session.id, fileSession.id);
  assert.deepEqual(record.getSnapshot().entries.map(entry => entry.time), [1, 2]);
  assert.strictEqual(record.getSessionSnapshot(liveSession.id), completedLive);
  assert.deepEqual(completedLive.entries.map(entry => entry.time), [8]);
});

test('FILE RESTART reactivates its session at zero without resetting its retained record', () => {
  const record = createPersistentListeningRecord(fileSession);
  const lifecycle = createListeningRecordLifecycle(record);
  record.capture(observation(3, fileSession.id));
  const liveSession: ListeningRecordSession = { id: 'live-input-4', kind: 'live-input', label: 'LIVE INPUT' };
  lifecycle.activateLive(liveSession);
  record.capture(observation(9, liveSession.id));
  lifecycle.selectFile(fileSession);

  lifecycle.activateSelectedFile();
  assert.equal(record.capture(observation(0, fileSession.id)), true);
  assert.deepEqual(record.getSnapshot().entries.map(entry => entry.time), [0, 3]);
  assert.deepEqual(record.getSessionSnapshot(liveSession.id)?.entries.map(entry => entry.time), [9]);
});

test('FILE pause, resume, and restart reuse one source session without unrelated records', () => {
  const record = createPersistentListeningRecord();
  const lifecycle = createListeningRecordLifecycle(record);
  lifecycle.selectFile(fileSession);
  lifecycle.activateSelectedFile();
  record.capture(observation(1, fileSession.id));
  const paused = record.getSnapshot();
  assert.equal(lifecycle.activateSelectedFile(), true, 'resume reuses the selected FILE session');
  assert.strictEqual(record.getSnapshot(), paused);
  record.capture(observation(2, fileSession.id));
  lifecycle.activateSelectedFile();
  assert.equal(record.capture(observation(0, fileSession.id)), true, 'restart adds source zero without resetting');
  assert.deepEqual(record.getSnapshot().entries.map(entry => entry.time), [0, 1, 2]);
  assert.equal(record.getSessionSnapshot('unrelated'), null);
});

test('LIVE record identity uses stable session time rather than rolling evidence-relative time', () => {
  const record = createPersistentListeningRecord({ id: 'live-input-7', kind: 'live-input', label: 'LIVE' });
  record.capture(observation(41.5, 'live-input-7', {
    melodyEvidence: { ...melodyEvidence, time: 11.5, frameIndex: 690 },
    bassEvidence, bassSnapshot: selectedBass,
  }));
  assert.equal(record.getSnapshot().entries[0].time, 41.5);
  assert.equal(record.getSnapshot().entries[0].melody?.evidenceTime, 11.5);
});

test('historical inspection resolves a retained slice without invoking analysis', () => {
  const record = createPersistentListeningRecord(fileSession);
  record.capture(observation(1));
  record.capture(observation(2));
  record.capture(observation(3));
  assert.equal(findListeningRecordSlice(record.getSnapshot().entries, 2.2)?.time, 2);
  const source = readFileSync(new URL('../src/instrument-ui/representations/GlyphFieldRenderer.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /analyze|createRollingListeningSession|AudioContext/);
});

test('three- and ten-minute logical records grow while active projection stays bounded by the viewport limit', () => {
  const record = createPersistentListeningRecord(fileSession);
  const cadence = 1 / 24;
  for (let index = 0; index <= 10 * 60 / cadence; index += 1) record.capture(observation(index * cadence));
  const snapshot = record.getSnapshot();
  const threeMinuteCount = snapshot.entries.filter(entry => entry.time <= 180).length;
  assert.equal(threeMinuteCount, 4321);
  assert.equal(snapshot.entries.length, 14401);
  assert.equal(estimateListeningRecordBytes(snapshot.entries.slice(0, threeMinuteCount)), 3_076_552);
  assert.equal(snapshot.approximateBytes, 10_253_512);
  const firstWindow = projectListeningRecord(snapshot.entries, 0, 90, GLYPH_RENDERED_FRAME_LIMIT);
  const lastWindow = projectListeningRecord(snapshot.entries, 510, 600, GLYPH_RENDERED_FRAME_LIMIT);
  assert.ok(firstWindow.length <= GLYPH_RENDERED_FRAME_LIMIT);
  assert.ok(lastWindow.length <= GLYPH_RENDERED_FRAME_LIMIT);
  assert.equal(GLYPH_RENDERED_FRAME_LIMIT, 96);
  assert.ok(lastWindow.map(glyphColumnFromSlice).reduce((count, column) =>
    count + column.melody.length + column.bass.length, 0) <= 1_056);
});

test('representation selection remains orthogonal, persistent, and Original stays the default', () => {
  const player = readFileSync(new URL('../src/instrument-ui/signal-player/SignalPlayer.tsx', import.meta.url), 'utf8');
  const renderer = readFileSync(new URL('../src/instrument-ui/representations/GlyphFieldRenderer.tsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/ZoeApp.tsx', import.meta.url), 'utf8');
  assert.match(player, /representation = VisualRepresentation\.Original/);
  assert.match(player, /representation === VisualRepresentation\.Original/);
  assert.match(player, /<GlyphFieldRenderer record=\{listeningRecord\}/);
  assert.match(app, /useState\(VisualRepresentation\.Original\)/);
  assert.match(app, /const \[listeningRecord\] = useState\(createPersistentListeningRecord\)/);
  assert.match(renderer, /useSyncExternalStore\(record\.subscribe/);
  assert.match(renderer, /\[NOW →\]/);
  assert.doesNotMatch(renderer, /RETURN TO NOW|<polyline/);
});

test('selected path continuity stays local and breaks across silence or large pitch transitions', () => {
  const column = (id: string, time: number, position: number | null): GlyphFieldColumn => ({
    id, time, melody: [], bass: [], melodySelectedPosition: position, bassSelectedPosition: position,
  });
  const columns = [column('a', 0, .5), column('b', .25, .53), column('jump', .5, .12),
    column('gap', 1.75, .14), column('silent', 2, null), column('restart', 2.1, .15)];
  assert.deepEqual(selectedPathLinks(columns, 'melody', 64).map(link => link.id), ['a-b']);
  assert.deepEqual(selectedPathLinks(columns, 'bass', 64).map(link => link.id), ['a-b']);
});
