import type { AudioEvent, AudioFrame, PercussionKind } from '../audio/types';
import type { HearingDomain, HearingStatus, SignalField, SignalTelemetry } from './signalTelemetry';

export type EventEmphasis = 'none' | 'recent' | 'current';
export type ListenerState = HearingStatus | 'ACCEPTED' | 'NO ACTIVE MELODY' | 'NO ACTIVE CHORD' | 'LISTENING';

export type PrimaryListeningView = Readonly<{
  listeningModels: readonly HearingDomain[];
  signal: SignalTelemetry['primaryEvidence']['signal'];
  observedPitch: SignalTelemetry['primaryEvidence']['observedPitch'];
  uncertainty: SignalTelemetry['primaryEvidence']['uncertainty'];
  melody: Readonly<{ identity: string; state: ListenerState; emphasis: EventEmphasis }>;
  harmony: Readonly<{
    chroma: string; hypothesis: string; frameConfidence: string;
    chord: string; state: ListenerState; emphasis: EventEmphasis;
  }>;
  rhythm: Readonly<{
    bpm: string; phase: string; groove: string; swing: string; beat: string; emphasis: EventEmphasis;
    listeningFieldEmphasis: EventEmphasis;
  }>;
  percussion: Readonly<{
    hit: string; strength: string; activity: string; state: 'LISTENING' | 'UNAVAILABLE'; emphasis: EventEmphasis;
  }>;
  tonalCenter: Readonly<{
    identity: string; state: HearingStatus; confidence: string;
    hypothesis: string; hypothesisConfidence: string; emphasis: EventEmphasis;
  }>;
  structure: Readonly<{
    identity: string; state: HearingStatus; progress: string; novelty: string;
    boundaryConfidence: string; emphasis: EventEmphasis;
  }>;
  sourceSystem: readonly SignalField[];
}>;

const PERCUSSION_KINDS = new Set<PercussionKind>([
  'kick', 'snare', 'closed-hat', 'open-hat', 'tom', 'other-percussion',
]);

const number = (value: number | null | undefined, digits = 3) =>
  value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits);

const hearing = (telemetry: SignalTelemetry, id: HearingDomain['id']) =>
  telemetry.hearing.find(domain => domain.id === id)?.status ?? 'UNAVAILABLE';

function latestTimedEvent(events: readonly AudioEvent[], accepts: (event: AudioEvent) => boolean, time: number) {
  return [...events].reverse().find(event => event.type !== 'seek' && event.time <= time && accepts(event)) ?? null;
}

function emphasisFor(event: AudioEvent | null, time: number): EventEmphasis {
  if (!event || event.type === 'seek') return 'none';
  const age = time - event.time;
  if (age < 0 || age > 0.45) return 'none';
  return age <= 0.16 ? 'current' : 'recent';
}

/** Listening Field presentation policy: preserve the existing hard caps while
 * reserving the final quarter of a stable beat interval at baseline. */
export function listeningFieldBeatEmphasis(age: number, bpm: number | null): EventEmphasis {
  if (!Number.isFinite(age) || age < 0 || bpm === null || !Number.isFinite(bpm) || bpm <= 0) return 'none';
  const beatInterval = 60 / bpm;
  const currentUntil = Math.min(0.16, beatInterval * 0.25);
  const recentUntil = Math.min(0.45, beatInterval * 0.75);
  if (age > recentUntil) return 'none';
  return age <= currentUntil ? 'current' : 'recent';
}

function displayPercussion(type: PercussionKind) {
  return type === 'other-percussion' ? 'OTHER' : type.replaceAll('-', ' ').toUpperCase();
}

function displaySection(label: string | null) {
  if (!label) return '—';
  const generic = /^section[-\s_]*(\d+)$/i.exec(label);
  return generic ? `SECTION ${generic[1].padStart(2, '0')}` : label.toUpperCase();
}

/** Presentation-only projection. It combines retained evidence with the current
 * AudioWorld interpretation and existing timeline events without creating new musical truth. */
export function selectPrimaryListeningView(telemetry: SignalTelemetry, frame: AudioFrame,
  events: readonly AudioEvent[]): PrimaryListeningView {
  const snapshot = frame.snapshot;
  const time = snapshot.transport.time;
  const noteEvent = latestTimedEvent(events, event => event.type === 'note-on', time);
  const chordEvent = latestTimedEvent(events, event => event.type === 'chord-change' && event.harmony !== null, time);
  const beatEvent = latestTimedEvent(events, event => event.type === 'beat', time);
  const percussionEvent = latestTimedEvent(events,
    event => PERCUSSION_KINDS.has(event.type as PercussionKind), time);
  const tonalEvent = latestTimedEvent(events, event => event.type === 'tonal-center-change', time);
  const sectionEvent = latestTimedEvent(events, event => event.type === 'section-change', time);
  const melodyEvidence = telemetry.primaryEvidence.observedPitch.frequencyHz !== '—';
  const melodyState: ListenerState = snapshot.melody.active ? 'ACCEPTED'
    : telemetry.ended ? snapshot.melody.available ? 'NO ACTIVE MELODY' : 'UNAVAILABLE'
      : melodyEvidence && telemetry.primaryEvidence.observedPitch.rangeStatus !== 'IN RANGE' ? 'SEARCHING'
        : hearing(telemetry, 'MELODY') === 'UNCERTAIN' ? 'UNCERTAIN'
          : snapshot.melody.available ? 'NO ACTIVE MELODY' : 'UNAVAILABLE';
  const harmonyState: ListenerState = snapshot.harmony.active ? 'ACCEPTED'
    : telemetry.primaryEvidence.harmony.hypothesis !== '—' ? 'UNCERTAIN'
      : snapshot.harmony.available ? 'NO ACTIVE CHORD' : 'UNAVAILABLE';
  const hit = percussionEvent && percussionEvent.type !== 'seek'
    && PERCUSSION_KINDS.has(percussionEvent.type as PercussionKind)
    ? percussionEvent as Extract<AudioEvent, { type: PercussionKind }> : null;
  const boundary = sectionEvent?.type === 'section-change' ? sectionEvent : null;
  const beatAge = beatEvent && beatEvent.type === 'beat' ? time - beatEvent.time : Number.POSITIVE_INFINITY;

  return {
    listeningModels: telemetry.hearing,
    signal: telemetry.primaryEvidence.signal,
    observedPitch: telemetry.primaryEvidence.observedPitch,
    uncertainty: telemetry.primaryEvidence.uncertainty,
    melody: {
      identity: snapshot.melody.noteName ?? '—', state: melodyState,
      emphasis: snapshot.melody.active ? emphasisFor(noteEvent, time) : 'none',
    },
    harmony: {
      ...telemetry.primaryEvidence.harmony,
      chord: snapshot.harmony.chord ?? '—', state: harmonyState,
      emphasis: snapshot.harmony.active ? emphasisFor(chordEvent, time) : 'none',
    },
    rhythm: {
      bpm: snapshot.rhythm.bpm === null ? '—' : `${snapshot.rhythm.bpm.toFixed(2)} BPM`,
      phase: telemetry.ended || !snapshot.rhythm.available ? '—' : number(snapshot.rhythm.beatPhase),
      groove: number(snapshot.rhythm.groove), swing: number(snapshot.rhythm.swing),
      beat: snapshot.rhythm.beatIndex === null ? '—' : `BEAT ${snapshot.rhythm.beatIndex}`,
      emphasis: emphasisFor(beatEvent, time),
      listeningFieldEmphasis: listeningFieldBeatEmphasis(beatAge, snapshot.rhythm.bpm),
    },
    percussion: {
      hit: hit && time - hit.time <= 0.35 ? displayPercussion(hit.type) : '—',
      strength: hit && time - hit.time <= 0.35 ? number(hit.strength) : '—',
      activity: number(snapshot.percussion.activity),
      state: snapshot.percussion.available ? 'LISTENING' : 'UNAVAILABLE',
      emphasis: hit && time - hit.time <= 0.35 ? emphasisFor(hit, time) : 'none',
    },
    tonalCenter: {
      identity: snapshot.tonalCenter.label?.toUpperCase() ?? '—',
      state: hearing(telemetry, 'KEY'), confidence: number(snapshot.tonalCenter.confidence),
      hypothesis: telemetry.primaryEvidence.tonalCenter.hypothesis.toUpperCase(),
      hypothesisConfidence: telemetry.primaryEvidence.tonalCenter.hypothesisConfidence,
      emphasis: snapshot.tonalCenter.available ? emphasisFor(tonalEvent, time) : 'none',
    },
    structure: {
      identity: displaySection(snapshot.structure.label), state: hearing(telemetry, 'STRUCTURE'),
      progress: telemetry.ended || !snapshot.structure.available ? '—' : `${Math.round(snapshot.structure.sectionProgress * 100)}%`,
      novelty: telemetry.primaryEvidence.structure.novelty,
      boundaryConfidence: boundary ? number(boundary.structure.confidence) : '—',
      emphasis: snapshot.structure.available ? emphasisFor(sectionEvent, time) : 'none',
    },
    sourceSystem: telemetry.primaryEvidence.sourceSystem,
  };
}
