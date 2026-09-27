import { midiToNoteName, type BassEvidenceFrame } from '@zoeyetc/computational-listening-engine';
import type { SignalConsoleObservation } from '../signal-console/types.ts';

export type ListeningRecordSession = Readonly<{
  id: string;
  kind: 'file' | 'live-input' | 'fixture';
  label: string;
}>;

export type RecordedMelodyCandidate = Readonly<{
  rank: number; pitchHz: number; midi: number; label: string;
  periodicity: number; salience: number; score: number;
}>;

export type RecordedRejectedCandidate = Readonly<{
  rank: number; pitchHz: number; midi: number; periodicity: number;
  salience: number; score: number; reason: string;
}>;

export type RecordedMelodyEvidence = Readonly<{
  evidenceTime: number;
  frameIndex: number;
  candidates: readonly RecordedMelodyCandidate[];
  rejectedCandidates: readonly RecordedRejectedCandidate[];
  selectedCandidateIndex: number | null;
  finalConfidence: number;
  reason: string;
}>;

export type RecordedBassCandidate = Readonly<{
  pitchHz: number; midi: number; label: string; score: number;
  periodicity: number; salience: number; source: string; sourceRank: number;
}>;

export type RecordedBassEvidence = Readonly<{
  evidenceTime: number;
  candidates: readonly RecordedBassCandidate[];
  selectedCandidateIndex: number | null;
  selectedPitchHz: number | null;
  selectedMidi: number | null;
  selectedScore: number | null;
  reason: string;
}>;

export type ListeningRecordSlice = Readonly<{
  id: string;
  time: number;
  melody: RecordedMelodyEvidence | null;
  bass: RecordedBassEvidence | null;
}>;

export type ListeningRecordSnapshot = Readonly<{
  session: ListeningRecordSession;
  revision: number;
  entries: readonly ListeningRecordSlice[];
  latestTime: number;
  approximateBytes: number;
}>;

export type PersistentListeningRecord = Readonly<{
  beginSession(session: ListeningRecordSession): void;
  capture(observation: SignalConsoleObservation): boolean;
  getSnapshot(): ListeningRecordSnapshot;
  getSessionSnapshot(sessionId: string): ListeningRecordSnapshot | null;
  subscribe(listener: () => void): () => void;
}>;

export type ListeningRecordLifecycle = Readonly<{
  selectFile(session: ListeningRecordSession): void;
  clearFileSelection(): void;
  activateSelectedFile(): boolean;
  activateLive(session: ListeningRecordSession): void;
}>;

const EMPTY_SESSION: ListeningRecordSession = { id: 'zoe-empty', kind: 'fixture', label: 'REFERENCE' };

const bassFrameAt = (observation: SignalConsoleObservation): BassEvidenceFrame | null => {
  const frames = observation.bassEvidence?.frames;
  const target = observation.bassSnapshot?.time;
  if (!frames?.length || target === undefined || target === null) return null;
  let low = 0;
  let high = frames.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (frames[middle].time <= target) low = middle;
    else high = middle - 1;
  }
  return frames[low].time <= target ? frames[low] : null;
};

const midiFromHz = (frequency: number) => 69 + 12 * Math.log2(frequency / 440);

function recordSlice(observation: SignalConsoleObservation, session: ListeningRecordSession): ListeningRecordSlice {
  const evidence = observation.melodyEvidence ?? null;
  const bassFrame = bassFrameAt(observation);
  const time = session.kind === 'live-input'
    ? observation.transport.time
    : evidence?.time ?? observation.bassSnapshot?.time ?? observation.transport.time;
  const melody: RecordedMelodyEvidence | null = evidence ? {
    evidenceTime: evidence.time,
    frameIndex: evidence.frameIndex,
    candidates: evidence.candidates.map(candidate => ({
      rank: candidate.rank, pitchHz: candidate.pitchHz, midi: candidate.midiFloat, label: candidate.noteName,
      periodicity: candidate.periodicity, salience: candidate.salience, score: candidate.score,
    })),
    rejectedCandidates: evidence.rejectedCandidates.map(candidate => ({
      rank: candidate.rank, pitchHz: candidate.frequencyHz, midi: midiFromHz(candidate.frequencyHz),
      periodicity: candidate.periodicity, salience: candidate.salience, score: candidate.score,
      reason: candidate.reason,
    })),
    selectedCandidateIndex: evidence.selectedCandidateIndex,
    finalConfidence: evidence.finalConfidence,
    reason: evidence.reason,
  } : null;
  const bass: RecordedBassEvidence | null = bassFrame ? {
    evidenceTime: bassFrame.time,
    candidates: bassFrame.candidates.map(candidate => ({
      pitchHz: candidate.pitchHz, midi: candidate.midiFloat,
      label: midiToNoteName(Math.round(candidate.midiFloat)), score: candidate.score,
      periodicity: candidate.periodicity, salience: candidate.salience,
      source: candidate.source, sourceRank: candidate.sourceRank,
    })),
    selectedCandidateIndex: bassFrame.selectedCandidateIndex,
    selectedPitchHz: bassFrame.selectedPitchHz,
    selectedMidi: bassFrame.selectedMidiFloat,
    selectedScore: bassFrame.selectedScore,
    reason: bassFrame.reason,
  } : observation.bassSnapshot ? {
    evidenceTime: observation.bassSnapshot.time, candidates: [], selectedCandidateIndex: null,
    selectedPitchHz: observation.bassSnapshot.pitchHz, selectedMidi: observation.bassSnapshot.midiFloat,
    selectedScore: observation.bassSnapshot.candidateScore, reason: observation.bassSnapshot.reason,
  } : null;
  const id = `${time.toFixed(3)}:${melody?.frameIndex ?? '—'}:${bass?.evidenceTime.toFixed(3) ?? '—'}`;
  return { id, time, melody, bass };
}

const estimateSliceBytes = (entry: ListeningRecordSlice) => 144
    + (entry.melody ? 112 + entry.melody.candidates.length * 72 + entry.melody.rejectedCandidates.length * 64 : 0)
    + (entry.bass ? 96 + entry.bass.candidates.length * 72 : 0);

export function estimateListeningRecordBytes(entries: readonly ListeningRecordSlice[]) {
  return entries.reduce((total, entry) => total + estimateSliceBytes(entry), 0);
}

export function createPersistentListeningRecord(initialSession: ListeningRecordSession = EMPTY_SESSION): PersistentListeningRecord {
  type SessionState = {
    session: ListeningRecordSession;
    entries: ListeningRecordSlice[];
    ids: Set<string>;
    revision: number;
    approximateBytes: number;
    snapshot: ListeningRecordSnapshot;
  };
  const createSessionState = (session: ListeningRecordSession): SessionState => ({
    session, entries: [], ids: new Set(), revision: 0, approximateBytes: 0,
    snapshot: { session, revision: 0, entries: [], latestTime: 0, approximateBytes: 0 },
  });
  let active = createSessionState(initialSession);
  const sessions = new Map<string, SessionState>([[initialSession.id, active]]);
  const listeners = new Set<() => void>();
  const publish = (state: SessionState) => {
    state.revision += 1;
    state.snapshot = {
      session: state.session, revision: state.revision, entries: state.entries,
      latestTime: state.entries.at(-1)?.time ?? 0,
      approximateBytes: state.approximateBytes,
    };
    listeners.forEach(listener => listener());
  };
  return {
    beginSession(next) {
      if (next.id === active.session.id) return;
      const retained = sessions.get(next.id);
      active = retained ?? createSessionState(next);
      if (!retained) sessions.set(next.id, active);
      listeners.forEach(listener => listener());
    },
    capture(observation) {
      if (observation.audioMap.id !== active.session.id) return false;
      const entry = recordSlice(observation, active.session);
      if (active.ids.has(entry.id)) return false;
      active.ids.add(entry.id);
      active.approximateBytes += estimateSliceBytes(entry);
      const entries = active.entries.slice();
      if (!entries.length || entry.time >= entries[entries.length - 1].time) entries.push(entry);
      else {
        let index = entries.findIndex(item => item.time > entry.time);
        if (index < 0) index = entries.length;
        entries.splice(index, 0, entry);
      }
      active.entries = entries;
      publish(active);
      return true;
    },
    getSnapshot: () => active.snapshot,
    getSessionSnapshot: sessionId => sessions.get(sessionId)?.snapshot ?? null,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}

export function createListeningRecordLifecycle(record: PersistentListeningRecord): ListeningRecordLifecycle {
  let selectedFile: ListeningRecordSession | null = null;
  return {
    selectFile(session) {
      if (session.kind !== 'file') throw new Error('Listening Record FILE selection requires a file session');
      selectedFile = session;
    },
    clearFileSelection() { selectedFile = null; },
    activateSelectedFile() {
      if (!selectedFile) return false;
      record.beginSession(selectedFile);
      return true;
    },
    activateLive(session) {
      if (session.kind !== 'live-input') throw new Error('Listening Record LIVE activation requires a live session');
      record.beginSession(session);
    },
  };
}

export function findListeningRecordSlice(entries: readonly ListeningRecordSlice[], time: number) {
  if (!entries.length) return null;
  let low = 0;
  let high = entries.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (entries[middle].time < time) low = middle + 1;
    else high = middle;
  }
  const after = entries[low];
  const before = entries[Math.max(0, low - 1)];
  return Math.abs(after.time - time) < Math.abs(before.time - time) ? after : before;
}

export function projectListeningRecord(entries: readonly ListeningRecordSlice[], startTime: number, endTime: number,
  limit: number): readonly ListeningRecordSlice[] {
  let start = 0;
  let end = entries.length;
  while (start < end) {
    const middle = Math.floor((start + end) / 2);
    if (entries[middle].time < startTime) start = middle + 1;
    else end = middle;
  }
  const first = start;
  end = entries.length;
  while (start < end) {
    const middle = Math.floor((start + end) / 2);
    if (entries[middle].time <= endTime) start = middle + 1;
    else end = middle;
  }
  const count = Math.max(0, start - first);
  if (count <= limit) return entries.slice(first, first + count);
  const projected: ListeningRecordSlice[] = [];
  for (let index = 0; index < limit; index += 1) {
    const sourceIndex = first + Math.round(index * (count - 1) / Math.max(1, limit - 1));
    const entry = entries[sourceIndex];
    if (projected.at(-1)?.id !== entry.id) projected.push(entry);
  }
  return projected;
}
