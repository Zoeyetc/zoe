import { lookupListeningSnapshot } from '@zoeyetc/computational-listening-engine';
import type { InstrumentEvent } from '../contracts.ts';
import type { SignalConsoleObservation } from '../signal-console/types.ts';

export type MotionStudyVariant = 'a' | 'b' | 'c';

/** One read-only projection of the evidence all four response policies share. */
export type MotionStudySample = Readonly<{
  active: boolean;
  level: number;
  transient: number;
  structureEnergy: number;
  beat: number;
  notePulse: number;
  percussionPulse: number;
  percussionActivity: number;
  melodySupport: number;
  melodyCompetition: number;
  melodyAbstained: boolean;
  melodyIdentity: string | null;
  bassSupport: number;
  bassCompetition: number;
  bassAbstained: boolean;
  bassIdentity: string | null;
  rhythmSupport: number;
  harmonySupport: number;
  harmonyCompetition: number;
  harmonyIdentity: string | null;
  tonalSupport: number;
  tonalCompetition: number;
  tonalIdentity: string | null;
  interpretationKey: string | null;
  progress: number;
}>;

export const emptyMotionStudySample: MotionStudySample = Object.freeze({
  active: false,
  level: 0,
  transient: 0,
  structureEnergy: 0,
  beat: 0,
  notePulse: 0,
  percussionPulse: 0,
  percussionActivity: 0,
  melodySupport: 0,
  melodyCompetition: 0,
  melodyAbstained: false,
  melodyIdentity: null,
  bassSupport: 0,
  bassCompetition: 0,
  bassAbstained: false,
  bassIdentity: null,
  rhythmSupport: 0,
  harmonySupport: 0,
  harmonyCompetition: 0,
  harmonyIdentity: null,
  tonalSupport: 0,
  tonalCompetition: 0,
  tonalIdentity: null,
  interpretationKey: null,
  progress: 0,
});

const clamp = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

function retainedAt<T>(frames: readonly T[] | null | undefined, time: number, start: (frame: T) => number) {
  if (!frames?.length) return null;
  let low = 0;
  let high = frames.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (start(frames[middle]) <= time) low = middle + 1;
    else high = middle;
  }
  return frames[Math.max(0, low - 1)] ?? null;
}

function eventPulse(events: readonly InstrumentEvent[], time: number,
  accepts: (event: InstrumentEvent) => boolean, duration: number) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!('time' in event) || !accepts(event) || event.time > time) continue;
    const strength = 'strength' in event ? clamp(event.strength) : 1;
    return clamp(1 - (time - event.time) / duration) * strength;
  }
  return 0;
}

function candidateCompetition(scores: readonly number[], selectedIndex: number | null) {
  if (selectedIndex === null || scores.length < 2) return 0;
  const selected = clamp(scores[selectedIndex] ?? 0);
  const strongestOther = scores.reduce((strongest, score, index) =>
    index === selectedIndex ? strongest : Math.max(strongest, clamp(score)), 0);
  if (selected <= 0) return 1;
  return clamp(1 - Math.max(0, selected - strongestOther) / selected);
}

function pitchIdentity(prefix: string, midi: number | null | undefined) {
  return midi === null || midi === undefined || !Number.isFinite(midi) ? null : `${prefix}:${Math.round(midi)}`;
}

/** Read current retained evidence once; no mode may rerun or alter analysis. */
export function selectMotionStudySample(observation: SignalConsoleObservation,
  events: readonly InstrumentEvent[]): MotionStudySample {
  const { audioMap, transport } = observation;
  const active = transport.playing && transport.time < transport.duration;
  const progress = transport.duration > 0 ? clamp(transport.time / transport.duration) : 0;
  if (!active) return { ...emptyMotionStudySample, progress };

  const amplitude = retainedAt(audioMap.amplitude, transport.time, frame => frame.start);
  const structure = retainedAt(audioMap.structureAnalysis?.frames, transport.time, frame => frame.start);
  const harmonyFrame = retainedAt(audioMap.harmonyAnalysis?.frames, transport.time, frame => frame.time);
  const tonalFrame = retainedAt(audioMap.tonalCenterAnalysis?.frames, transport.time, frame => frame.time);
  const bassFrame = retainedAt(observation.bassEvidence?.frames, observation.bassSnapshot?.time ?? transport.time,
    frame => frame.time);
  const snapshot = lookupListeningSnapshot(audioMap, transport.time);
  const melody = observation.melodyEvidence ?? null;
  const melodyAccepted = Boolean(melody?.voiced && melody.selectedCandidateIndex !== null);
  const melodySupport = melodyAccepted ? clamp(melody?.finalConfidence ?? 0) : 0;
  const melodyAbstained = Boolean(melody && !melodyAccepted && melody.reason !== 'LOW_RMS');
  const bassSelected = observation.bassSnapshot?.available === true
    && observation.bassSnapshot.reason === 'SELECTED';
  const bassSupport = bassSelected ? clamp(observation.bassSnapshot?.candidateScore ?? 0) : 0;
  const bassAbstained = observation.bassSnapshot?.reason === 'PATH_ABSTAINED';
  const harmonySupport = snapshot.harmony.active ? clamp(snapshot.harmony.confidence) : 0;
  const tonalSupport = snapshot.tonalCenter.available ? clamp(snapshot.tonalCenter.confidence) : 0;
  const identities = [
    melodyAccepted ? pitchIdentity('M', melody?.selectedMidiFloat) : null,
    bassSelected ? pitchIdentity('B', observation.bassSnapshot?.midiFloat) : null,
    snapshot.harmony.active && snapshot.harmony.chord ? `H:${snapshot.harmony.chord}` : null,
    snapshot.tonalCenter.available && snapshot.tonalCenter.label ? `T:${snapshot.tonalCenter.label}` : null,
  ].filter((identity): identity is string => identity !== null);

  return {
    active,
    level: clamp(amplitude?.rms[0] ?? 0),
    transient: clamp(amplitude?.onsetStrength[0] ?? 0),
    structureEnergy: clamp(structure?.energy ?? 0),
    beat: eventPulse(events, transport.time, event => event.type === 'beat', .22),
    notePulse: eventPulse(events, transport.time, event => event.type === 'note-on', .28),
    percussionPulse: eventPulse(events, transport.time,
      event => ['kick', 'snare', 'closed-hat', 'open-hat', 'tom', 'other-percussion'].includes(event.type), .22),
    percussionActivity: snapshot.percussion.available
      ? clamp(snapshot.percussion.activity * snapshot.percussion.confidence) : 0,
    melodySupport,
    melodyCompetition: melody ? candidateCompetition(melody.candidates.map(candidate => candidate.score),
      melody.selectedCandidateIndex) : 0,
    melodyAbstained,
    melodyIdentity: melodyAccepted ? pitchIdentity('M', melody?.selectedMidiFloat) : null,
    bassSupport,
    bassCompetition: bassFrame ? candidateCompetition(bassFrame.candidates.map(candidate => candidate.score),
      bassFrame.selectedCandidateIndex) : 0,
    bassAbstained,
    bassIdentity: bassSelected ? pitchIdentity('B', observation.bassSnapshot?.midiFloat) : null,
    rhythmSupport: snapshot.rhythm.available ? clamp(snapshot.rhythm.confidence) : 0,
    harmonySupport,
    harmonyCompetition: harmonyFrame?.topCandidate
      ? clamp(1 - Math.max(0, harmonyFrame.scoreMargin)) : 0,
    harmonyIdentity: snapshot.harmony.active && snapshot.harmony.chord ? `H:${snapshot.harmony.chord}` : null,
    tonalSupport,
    tonalCompetition: tonalFrame?.topCandidate ? clamp(1 - Math.max(0, tonalFrame.margin)) : 0,
    tonalIdentity: snapshot.tonalCenter.available && snapshot.tonalCenter.label
      ? `T:${snapshot.tonalCenter.label}` : null,
    interpretationKey: identities.length ? identities.join('|') : null,
    progress,
  };
}

/** Legacy study adapter retained for calibration fixtures, not product mode interpretation. */
export function motionStudyTarget(variant: MotionStudyVariant, sample: MotionStudySample) {
  if (!sample.active) return 0;
  if (variant === 'a') return clamp(sample.level * .55 + sample.transient * .35 + sample.beat * .1);
  if (variant === 'b') return clamp(sample.level * .3 + sample.transient * .5 + sample.beat * .2);
  const audible = clamp(sample.level * 8 + sample.transient * 2);
  return clamp((sample.structureEnergy * .55 + sample.level * .35 + sample.transient * .1) * audible);
}
