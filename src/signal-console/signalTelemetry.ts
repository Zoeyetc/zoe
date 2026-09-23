import type {
  AudioAmplitudeRegion, AudioFrame, AudioMap, ChromaFrame, MelodyPitchFrame, SpectrumRegion,
  StructureAnalysisFrame, TonalCenterFrame, TransportState,
} from '../audio/types';
import type { SignalConsoleObservation } from './types';

export type SignalField = Readonly<{
  label: string;
  value: string;
  role: 'signal' | 'anchor';
  width?: 'wide';
}>;
export type SignalDomain = Readonly<{ id: string; layer: 'analysis'; fields: readonly SignalField[] }>;
export type SignalTelemetry = Readonly<{
  signature: string;
  mapRevision: number;
  mapId: string;
  ended: boolean;
  transport: TransportState;
  indexes: Readonly<Record<'amplitude' | 'spectrum' | 'pitch' | 'chroma' | 'tonal' | 'structure', number>>;
  domains: readonly SignalDomain[];
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
  } as const;
}

export function signalPresentationKey(observation: SignalConsoleObservation) {
  const { audioMap: map, transport, mapRevision } = observation;
  const ended = isSignalTransportEnded(transport);
  const indexes = retainedIndexes(map, transport.time, ended);
  return [mapRevision, map.id, transport.duration, transport.playing ? 1 : 0, ended ? 1 : 0,
    indexes.amplitude, indexes.spectrum, indexes.pitch, indexes.chroma, indexes.tonal, indexes.structure].join(':');
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
const tonalFields = (chroma: ChromaFrame | null, tonal: TonalCenterFrame | null): readonly SignalField[] => [
  signal('CHROMA', chroma?.chroma.map(value => number(value, 2)).join(' ') ?? '—', 'wide'),
  signal('ENERGY', number(chroma?.energy)), signal('FRAME CONF', number(chroma?.confidence)),
  signal('TOP', chroma?.topCandidate ? `${chroma.topCandidate.label} ${number(chroma.topCandidate.score)}` : '—'),
  signal('MARGIN', number(chroma?.scoreMargin)),
  anchor('KEY CANDIDATE', tonal?.topCandidate ? `${tonal.topCandidate.label} ${number(tonal.topScore)}` : '—'),
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
  const signature = signalPresentationKey(observation);
  return {
    signature, mapRevision, mapId: map.id, ended, transport, indexes,
    domains: [
      { id: 'SOURCE', layer: 'analysis', fields: sourceFields(map, mapRevision) },
      { id: 'LEVEL', layer: 'analysis', fields: levelFields(amplitude) },
      { id: 'TRANSIENT', layer: 'analysis', fields: transientFields(amplitude) },
      { id: 'SPECTRUM', layer: 'analysis', fields: spectrumFields(spectrum) },
      { id: 'PITCH', layer: 'analysis', fields: pitchFields(pitch) },
      { id: 'TONAL', layer: 'analysis', fields: tonalFields(chroma, tonal) },
      { id: 'RHYTHM', layer: 'analysis', fields: rhythmFields(map) },
      { id: 'STRUCTURE', layer: 'analysis', fields: structureFields(map, structure, indexes.structure) },
    ],
  };
}
