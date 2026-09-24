import type {
  AudioAmplitudeRegion, AudioFrame, AudioMap, ChromaFrame, MelodyPitchFrame, SpectrumRegion,
  StructureAnalysisFrame, TonalCenterFrame, TransportState,
} from '../audio/types';
import type { SignalConsoleObservation } from './types';
import { melodyEvidenceIndexAt, selectMelodyEvidence,
  selectMelodyEvidenceForTransport } from '../audio/melody-evidence/selectMelodyEvidence.ts';
import type {
  MelodyEvidenceCandidate, MelodyEvidenceObservation, ObservedPitchEvidence,
} from '../audio/melody-evidence/types';

export type SignalField = Readonly<{
  label: string;
  value: string;
  role: 'signal' | 'anchor';
  width?: 'wide';
}>;
export type SignalDomain = Readonly<{ id: string; layer: 'analysis'; fields: readonly SignalField[] }>;
export type HearingStatus = 'STABLE' | 'UNCERTAIN' | 'SEARCHING' | 'UNAVAILABLE';
export type HearingDomain = Readonly<{ id: 'RHYTHM' | 'MELODY' | 'HARMONY' | 'KEY' | 'STRUCTURE'; status: HearingStatus }>;
export type MelodyInspectTelemetry = Readonly<{
  available: boolean;
  frame: readonly SignalField[];
  generation: readonly SignalField[];
  rejectedSummary: readonly SignalField[];
  rejectedCandidates: readonly Readonly<{ id: string; fields: readonly SignalField[] }>[];
  candidates: readonly Readonly<{ id: string; fields: readonly SignalField[] }>[];
  path: readonly SignalField[];
  decision: readonly SignalField[];
  track: readonly SignalField[];
}>;
export type SignalTelemetry = Readonly<{
  signature: string;
  mapRevision: number;
  mapId: string;
  ended: boolean;
  transport: TransportState;
  indexes: Readonly<Record<'amplitude' | 'spectrum' | 'pitch' | 'chroma' | 'tonal' | 'structure' | 'melodyEvidence', number>>;
  domains: readonly SignalDomain[];
  hearing: readonly HearingDomain[];
  melodyInspect: MelodyInspectTelemetry;
  primaryEvidence: Readonly<{
    sourceSystem: readonly SignalField[];
    signal: Readonly<{
      level: string; transient: string; low: string; mid: string; high: string;
      brightness: string; spectralChange: string;
    }>;
    observedPitch: Readonly<{
      frequencyHz: string; noteName: string; score: string; rangeStatus: string;
    }>;
    harmony: Readonly<{ chroma: string; hypothesis: string; frameConfidence: string }>;
    tonalCenter: Readonly<{ hypothesis: string; hypothesisConfidence: string }>;
    uncertainty: Readonly<{
      melody: Readonly<{
        candidates: readonly Readonly<{ noteName: string; frequencyHz: string; score: string }>[];
        changed: boolean;
      }>;
      harmony: Readonly<{
        top: Readonly<{ identity: string; score: string }> | null;
        second: Readonly<{ identity: string; score: string }> | null;
        margin: string;
        changed: boolean;
      }>;
      tonalCenter: Readonly<{
        top: Readonly<{ identity: string; score: string }> | null;
        second: Readonly<{ identity: string; score: string }> | null;
        margin: string;
        changed: boolean;
      }>;
    }>;
    structure: Readonly<{ novelty: string; energy: string; onsetDensity: string }>;
  }>;
}>;

const END_ABSOLUTE_TOLERANCE_SECONDS = 1e-6;
const END_RELATIVE_TOLERANCE = 1e-6;

export function isSignalTransportEnded(transport: TransportState) {
  const tolerance = Math.max(END_ABSOLUTE_TOLERANCE_SECONDS,
    Math.min(1e-3, Math.abs(transport.duration) * END_RELATIVE_TOLERANCE));
  return transport.time >= transport.duration - tolerance;
}

const number = (value: number | null | undefined, digits = 3) =>
  value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(digits);
const bool = (value: boolean | undefined) => value === undefined ? '—' : value ? 'YES' : 'NO';
const signal = (label: string, value: string, width?: 'wide'): SignalField =>
  ({ label, value, role: 'signal', width });
const anchor = (label: string, value: string, width?: 'wide'): SignalField =>
  ({ label, value, role: 'anchor', width });
const changed = (current: unknown, previous: unknown) => JSON.stringify(current) !== JSON.stringify(previous);

export function signalPhraseGroups(fields: readonly SignalField[]): readonly (readonly SignalField[])[] {
  const groups: SignalField[][] = [];
  let group: SignalField[] = [];
  const flush = () => {
    if (group.length) groups.push(group);
    group = [];
  };
  for (const item of fields) {
    if (item.width === 'wide') {
      flush();
      groups.push([item]);
      continue;
    }
    group.push(item);
    if (group.length === 3) flush();
  }
  flush();
  return groups;
}

function latestIndex<T>(items: readonly T[] | null | undefined, timeOf: (item: T) => number, time: number) {
  if (!items?.length) return -1;
  let low = 0;
  let high = items.length - 1;
  let result = -1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    if (timeOf(items[middle]) <= time) { result = middle; low = middle + 1; } else high = middle - 1;
  }
  return result;
}

const at = <T,>(items: readonly T[] | null | undefined, index: number): T | null =>
  index < 0 ? null : items?.[index] ?? null;

function retainedIndex<T>(items: readonly T[] | null | undefined, timeOf: (item: T) => number,
  time: number, ended: boolean, finalValidTime?: number) {
  if (!items?.length) return -1;
  if (!ended) return latestIndex(items, timeOf, time);
  if (finalValidTime === undefined) return items.length - 1;
  const index = latestIndex(items, timeOf, finalValidTime);
  return index >= 0 ? index : items.length - 1;
}

function retainedIndexes(map: AudioMap, time: number, ended: boolean) {
  const analyzedDuration = Math.min(map.duration, map.analysis?.analyzedDuration ?? map.duration);
  const analysisFinalStart = map.analysis
    ? analyzedDuration - map.analysis.frameSize / map.analysis.sampleRate
    : undefined;
  const melodyFinalCenter = map.melodyAnalysis?.metadata
    ? analyzedDuration - map.melodyAnalysis.metadata.frameSize
      / (2 * map.melodyAnalysis.metadata.analysisSampleRate)
    : undefined;
  const harmonyFinalStart = map.harmonyAnalysis?.metadata
    ? analyzedDuration - map.harmonyAnalysis.metadata.frameSize
      / map.harmonyAnalysis.metadata.analysisSampleRate
    : undefined;
  return {
    amplitude: retainedIndex(map.amplitude, item => item.start, time, ended, analysisFinalStart),
    spectrum: retainedIndex(map.spectrum, item => item.start, time, ended, analysisFinalStart),
    pitch: retainedIndex(map.melodyAnalysis?.contour, item => item.time, time, ended, melodyFinalCenter),
    chroma: retainedIndex(map.harmonyAnalysis?.frames, item => item.time, time, ended, harmonyFinalStart),
    tonal: retainedIndex(map.tonalCenterAnalysis?.frames, item => item.time, time, ended),
    structure: retainedIndex(map.structureAnalysis?.frames, item => item.start, time, ended),
    melodyEvidence: map.melodyEvidence ? melodyEvidenceIndexAt(map.melodyEvidence, time, ended) : -1,
  } as const;
}

export function signalPresentationKey(observation: SignalConsoleObservation) {
  const { audioMap: map, transport, mapRevision } = observation;
  const ended = isSignalTransportEnded(transport);
  const indexes = retainedIndexes(map, transport.time, ended);
  return [mapRevision, map.id, transport.duration, transport.playing ? 1 : 0, ended ? 1 : 0,
    indexes.amplitude, indexes.spectrum, indexes.pitch, indexes.chroma, indexes.tonal, indexes.structure,
    indexes.melodyEvidence].join(':');
}

const sourceFields = (map: AudioMap, revision: number): readonly SignalField[] => [
  anchor('KIND', map.source?.kind.toUpperCase() ?? 'FIXTURE'), anchor('REVISION', String(revision)),
  anchor('FILE', map.source?.filename ?? '—'), anchor('MAP', map.id),
  anchor('SAMPLE RATE', map.analysis ? `${map.analysis.sampleRate} Hz` : '—'),
  anchor('HOP', map.analysis ? `${map.analysis.hopSize} samples` : '—'),
];
const levelFields = (frame: AudioAmplitudeRegion | null): readonly SignalField[] =>
  [signal('RMS', number(frame?.rms[0])), signal('PEAK', number(frame?.peak[0]))];
const transientFields = (frame: AudioAmplitudeRegion | null): readonly SignalField[] =>
  [signal('ONSET', number(frame?.onsetStrength[0]))];
const spectrumFields = (frame: SpectrumRegion | null): readonly SignalField[] => [
  signal('LOW', number(frame?.low[0])), signal('MID', number(frame?.mid[0])), signal('HIGH', number(frame?.high[0])),
  signal('BRIGHTNESS', number(frame?.brightness[0])), signal('TEXTURE', number(frame?.texture[0])),
];
const pitchFields = (frame: MelodyPitchFrame | null): readonly SignalField[] => [
  signal('PITCH HZ', number(frame?.pitchHz, 2)), signal('MIDI FLOAT', number(frame?.midiFloat, 2)),
  signal('FRAME CONF', number(frame?.confidence)), signal('SALIENCE', number(frame?.salience)),
  signal('VOICED', frame ? bool(frame.voiced) : '—'),
];
const observedPitchFields = (pitch: ObservedPitchEvidence | null): readonly SignalField[] => [
  signal('OBSERVED', number(pitch?.frequencyHz, 2)),
  signal('NOTE', pitch?.noteName ?? '—'),
  signal('MIDI FLOAT', number(pitch?.midi, 2)),
  signal('SCORE', number(pitch?.score)),
  anchor('SOURCE', pitch?.source.replaceAll('_', ' ') ?? 'NONE'),
  anchor('MELODY RANGE STATUS', pitch?.melodyRangeStatus.replaceAll('_', ' ') ?? 'UNAVAILABLE', 'wide'),
];
const tonalFields = (chroma: ChromaFrame | null, tonal: TonalCenterFrame | null): readonly SignalField[] => [
  signal('CHROMA', chroma?.chroma.map(value => number(value, 2)).join(' ') ?? '—', 'wide'),
  signal('ENERGY', number(chroma?.energy)), signal('FRAME CONF', number(chroma?.confidence)),
  signal('TOP', chroma?.topCandidate ? `${chroma.topCandidate.label} ${number(chroma.topCandidate.score)}` : '—'),
  signal('MARGIN', number(chroma?.scoreMargin)),
  signal('KEY CANDIDATE', tonal?.topCandidate ? `${tonal.topCandidate.label} ${number(tonal.topScore)}` : '—'),
  signal('KEY CONF', number(tonal?.confidence)),
];
const rhythmFields = (map: AudioMap): readonly SignalField[] => {
  const rhythm = map.rhythmAnalysis;
  return [anchor('BPM', number(rhythm?.bpm, 2)), signal('CONF', number(rhythm?.confidence)),
    signal('GROOVE', number(rhythm?.groove)), signal('SWING', number(rhythm?.swing)),
    anchor('BEATS', rhythm ? String(rhythm.beats.length) : '—')];
};
const structureFields = (map: AudioMap, frame: StructureAnalysisFrame | null, index: number): readonly SignalField[] => {
  const analysis = map.structureAnalysis;
  return [signal('ENERGY', number(frame?.energy)), signal('ONSET DENSITY', number(frame?.onsetDensity)),
    signal('NOVELTY', number(index < 0 ? null : analysis?.novelty[index])),
    signal('SHORT', number(index < 0 ? null : analysis?.noveltyScales.short[index])),
    signal('MEDIUM', number(index < 0 ? null : analysis?.noveltyScales.medium[index])),
    signal('LONG', number(index < 0 ? null : analysis?.noveltyScales.long[index]))];
};

/** Exact v0.1 status mapping: accepted capability = STABLE; rejected retained
 * hypotheses = UNCERTAIN; retained search evidence = SEARCHING; otherwise UNAVAILABLE. */
function selectHearing(map: AudioMap): readonly HearingDomain[] {
  const rhythmEvidence = Boolean(map.rhythmAnalysis?.tempoCandidates?.length || map.rhythmAnalysis?.beats?.length);
  const melodyEvidence = map.melodyEvidence;
  const harmonyEvidence = map.harmonyAnalysis?.frames.some(frame => frame.topCandidate !== null) ?? false;
  const keyEvidence = Boolean(map.tonalCenterAnalysis?.globalTonalCenter
    || map.tonalCenterAnalysis?.frames.some(frame => frame.topCandidate !== null));
  const structureEvidence = Boolean(map.structureAnalysis?.frames.length);
  return [
    { id: 'RHYTHM', status: map.capabilities.rhythm ? 'STABLE' : rhythmEvidence ? 'SEARCHING' : 'UNAVAILABLE' },
    { id: 'MELODY', status: map.capabilities.melody ? 'STABLE'
      : melodyEvidence?.candidateCount ? 'UNCERTAIN' : 'UNAVAILABLE' },
    { id: 'HARMONY', status: map.capabilities.harmony ? 'STABLE'
      : harmonyEvidence ? 'UNCERTAIN' : 'UNAVAILABLE' },
    { id: 'KEY', status: map.capabilities.tonalCenter ? 'STABLE'
      : keyEvidence ? 'UNCERTAIN' : 'UNAVAILABLE' },
    { id: 'STRUCTURE', status: map.capabilities.structure ? 'STABLE'
      : structureEvidence ? 'SEARCHING' : 'UNAVAILABLE' },
  ];
}

const candidateText = (candidate: MelodyEvidenceCandidate | undefined) => candidate
  ? `${candidate.noteName} ${number(candidate.pitchHz, 2)} Hz · periodicity ${number(candidate.periodicity)}`
    + ` · salience ${number(candidate.salience)} · score ${number(candidate.score)}`
  : '—';

const rejectedCandidateText = (candidate: MelodyEvidenceObservation['rejectedCandidates'][number] | undefined) => candidate
  ? `${number(candidate.frequencyHz, 2)} Hz · periodicity ${number(candidate.periodicity)}`
    + ` · salience ${number(candidate.salience)} · score ${number(candidate.score)} · ${candidate.reason}`
  : '—';

function selectMelodyInspect(map: AudioMap, evidence: MelodyEvidenceObservation | null): MelodyInspectTelemetry {
  const timeline = map.melodyEvidence;
  const candidates = Array.from({ length: 5 }, (_, index) => ({
    id: `CANDIDATE ${index + 1}`,
    fields: [signal('EVIDENCE', candidateText(evidence?.candidates[index]), 'wide')],
  }));
  const rejectedCandidates = Array.from({ length: timeline?.rejectedCandidateCap ?? 3 }, (_, index) => ({
    id: `REJECTED ${index + 1}`,
    fields: [signal('EVIDENCE', rejectedCandidateText(evidence?.rejectedCandidates[index]), 'wide')],
  }));
  const selected = evidence?.selectedCandidateIndex === null || evidence?.selectedCandidateIndex === undefined
    ? '—'
    : `${evidence.selectedCandidateIndex + 1} ${evidence.candidates[evidence.selectedCandidateIndex]?.noteName ?? '—'} ${number(evidence.selectedPitchHz, 2)} Hz`;
  return {
    available: Boolean(timeline && evidence),
    frame: [anchor('TIME', number(evidence?.time)), signal('RMS', number(evidence?.rms)),
      anchor('CANDIDATES', evidence ? String(evidence.candidates.length) : '—'),
      anchor('CHANNELS', timeline?.channelProjection === 'arithmetic-mean' ? 'MEAN' : '—'),
      anchor('OUT OF RANGE', evidence ? String(evidence.outOfRangeCandidateCount) : '—')],
    generation: [anchor('ATTEMPTED', evidence ? bool(evidence.generation.attempted) : '—'),
      anchor('OUTCOME', evidence?.generation.outcome ?? '—', 'wide'),
      anchor('SEARCH', evidence?.generation.searchMode ?? '—'),
      anchor('LOCAL MINIMA', evidence ? String(evidence.generation.localMinimumCount) : '—'),
      anchor('RAW', evidence ? String(evidence.generation.rawCandidateCount) : '—'),
      anchor('IN RANGE PRE-DEDUP', evidence
        ? String(evidence.generation.inRangeCandidateCountBeforeDeduplication) : '—'),
      anchor('DUPLICATES REMOVED', evidence
        ? String(evidence.generation.duplicateCandidateRemovalCount) : '—'),
      anchor('RMS GATE', number(timeline?.thresholds.minimumRms, 4))],
    rejectedSummary: [anchor('TOTAL', evidence ? String(evidence.outOfRangeCandidateCount) : '—'),
      anchor('RETAINED', evidence ? String(evidence.rejectedCandidates.length) : '—'),
      anchor('CAP', timeline ? String(timeline.rejectedCandidateCap) : '—')],
    rejectedCandidates,
    candidates,
    path: [signal('SELECTED', selected), signal('FINAL PITCH', number(evidence?.finalPitchHz, 2)),
      signal('MIDI', number(evidence?.finalMidiFloat, 2))],
    decision: [signal('CONFIDENCE', number(evidence?.finalConfidence)),
      anchor('REQUIRED', number(timeline?.thresholds.voicingConfidence)),
      anchor('RESULT', evidence ? evidence.voiced ? 'ACCEPTED' : 'REJECTED' : '—'),
      anchor('STAGE', evidence?.stage.toUpperCase() ?? '—'), anchor('REASON', evidence?.reason ?? '—'),
      signal('SALIENCE', number(evidence?.finalSalience))],
    track: [signal('CONFIDENCE', number(timeline?.track.confidence)),
      anchor('REQUIRED', number(timeline?.thresholds.trackConfidence)),
      signal('VOICED RATIO', number(timeline?.track.voicedFrameRatio)),
      signal('USABLE', timeline ? `${number(timeline.track.usableDuration)} s` : '—'),
      anchor('NOTES', timeline ? String(timeline.track.noteCountBeforeTrackGate) : '—'),
      anchor('SHORT NOTE', timeline ? String(timeline.track.rejectedShortNoteCount) : '—'),
      anchor('DECISION', timeline ? timeline.track.available ? 'ACCEPTED' : 'REJECTED' : '—'),
      anchor('NOTE REASONS', timeline?.track.noteReasons.join(' + ') || '—', 'wide'),
      anchor('REASONS', timeline?.track.reasons.join(' + ') ?? '—', 'wide')],
  };
}

export function selectSignalInterpretationFields(frame: AudioFrame, ended: boolean): readonly SignalField[] {
  const snapshot = frame.snapshot;
  return [
    signal('NOTE', ended ? '—' : snapshot.melody.noteName ?? '—'),
    signal('NOTE CONF', ended ? '—' : number(snapshot.melody.confidence)),
    signal('CHORD', ended ? '—' : snapshot.harmony.chord ?? '—'),
    signal('CHORD CONF', ended ? '—' : number(snapshot.harmony.confidence)),
    anchor('TONAL CENTER', snapshot.tonalCenter.label ?? '—'),
    signal('BEAT PHASE', ended ? '—' : number(snapshot.rhythm.beatPhase)),
    anchor('SECTION', snapshot.structure.label ?? '—'),
    signal('PROGRESS', ended ? '—' : number(snapshot.structure.sectionProgress)),
  ];
}

export function selectSignalTelemetry(observation: SignalConsoleObservation): SignalTelemetry {
  const { audioMap: map, transport, mapRevision } = observation;
  const ended = isSignalTransportEnded(transport);
  const indexes = retainedIndexes(map, transport.time, ended);
  const amplitude = at(map.amplitude, indexes.amplitude);
  const spectrum = at(map.spectrum, indexes.spectrum);
  const pitch = at(map.melodyAnalysis?.contour, indexes.pitch);
  const chroma = at(map.harmonyAnalysis?.frames, indexes.chroma);
  const tonal = at(map.tonalCenterAnalysis?.frames, indexes.tonal);
  const structure = at(map.structureAnalysis?.frames, indexes.structure);
  const melodyEvidence = observation.melodyEvidence
    ?? selectMelodyEvidenceForTransport(map.melodyEvidence, transport);
  const previousMelodyEvidence = melodyEvidence && melodyEvidence.frameIndex > 0
    ? selectMelodyEvidence(map.melodyEvidence, melodyEvidence.time - 1e-6) : melodyEvidence;
  const previousChroma = at(map.harmonyAnalysis?.frames, indexes.chroma - 1);
  const previousTonal = at(map.tonalCenterAnalysis?.frames, indexes.tonal - 1);
  const observedPitch = melodyEvidence?.observedPitch ?? null;
  const signature = signalPresentationKey(observation);
  return {
    signature, mapRevision, mapId: map.id, ended, transport, indexes,
    hearing: selectHearing(map),
    melodyInspect: selectMelodyInspect(map, melodyEvidence),
    primaryEvidence: {
      sourceSystem: sourceFields(map, mapRevision),
      signal: {
        level: number(amplitude?.rms[0]), transient: number(amplitude?.onsetStrength[0]),
        low: number(spectrum?.low[0]), mid: number(spectrum?.mid[0]), high: number(spectrum?.high[0]),
        brightness: number(spectrum?.brightness[0]), spectralChange: number(spectrum?.texture[0]),
      },
      observedPitch: {
        frequencyHz: number(observedPitch?.frequencyHz, 2), noteName: observedPitch?.noteName ?? '—',
        score: number(observedPitch?.score),
        rangeStatus: observedPitch?.melodyRangeStatus.replaceAll('_', ' ') ?? 'UNAVAILABLE',
      },
      harmony: {
        chroma: chroma?.chroma.map(value => number(value, 2)).join(' ') ?? '—',
        hypothesis: chroma?.topCandidate?.label ?? '—',
        frameConfidence: number(chroma?.confidence),
      },
      tonalCenter: {
        hypothesis: tonal?.topCandidate?.label ?? '—', hypothesisConfidence: number(tonal?.confidence),
      },
      uncertainty: {
        melody: {
          candidates: (melodyEvidence?.candidates ?? []).slice(0, 3).map(candidate => ({
            noteName: candidate.noteName,
            frequencyHz: number(candidate.pitchHz, 2),
            score: number(candidate.score),
          })),
          changed: changed(melodyEvidence?.candidates.slice(0, 3),
            previousMelodyEvidence?.candidates.slice(0, 3)),
        },
        harmony: {
          top: chroma?.topCandidate
            ? { identity: chroma.topCandidate.label, score: number(chroma.topCandidate.score) } : null,
          second: chroma?.secondCandidate
            ? { identity: chroma.secondCandidate.label, score: number(chroma.secondCandidate.score) } : null,
          margin: number(chroma?.scoreMargin),
          changed: changed(chroma && [chroma.topCandidate, chroma.secondCandidate, chroma.scoreMargin],
            previousChroma && [previousChroma.topCandidate, previousChroma.secondCandidate, previousChroma.scoreMargin]),
        },
        tonalCenter: {
          top: tonal?.topCandidate
            ? { identity: tonal.topCandidate.label, score: number(tonal.topScore) } : null,
          second: tonal?.secondCandidate
            ? { identity: tonal.secondCandidate.label, score: number(tonal.secondScore) } : null,
          margin: number(tonal?.margin),
          changed: changed(tonal && [tonal.topCandidate, tonal.secondCandidate, tonal.topScore,
            tonal.secondScore, tonal.margin], previousTonal && [previousTonal.topCandidate,
            previousTonal.secondCandidate, previousTonal.topScore, previousTonal.secondScore, previousTonal.margin]),
        },
      },
      structure: {
        novelty: number(indexes.structure < 0 ? null : map.structureAnalysis?.novelty[indexes.structure]),
        energy: number(structure?.energy), onsetDensity: number(structure?.onsetDensity),
      },
    },
    domains: [
      { id: 'SOURCE', layer: 'analysis', fields: sourceFields(map, mapRevision) },
      { id: 'LEVEL', layer: 'analysis', fields: levelFields(amplitude) },
      { id: 'TRANSIENT', layer: 'analysis', fields: transientFields(amplitude) },
      { id: 'SPECTRUM', layer: 'analysis', fields: spectrumFields(spectrum) },
      { id: 'PITCH', layer: 'analysis', fields: observedPitchFields(melodyEvidence?.observedPitch ?? null) },
      { id: 'MELODY FRAME', layer: 'analysis', fields: pitchFields(pitch) },
      { id: 'TONAL', layer: 'analysis', fields: tonalFields(chroma, tonal) },
      { id: 'RHYTHM', layer: 'analysis', fields: rhythmFields(map) },
      { id: 'STRUCTURE', layer: 'analysis', fields: structureFields(map, structure, indexes.structure) },
    ],
  };
}
