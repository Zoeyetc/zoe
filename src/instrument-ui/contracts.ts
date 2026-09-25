import type { AudioSourceMetadata, BrowserTransportState, LiveInputState } from '../audio-source-browser/index.ts';
import type { BassEvidence, BassSnapshot, ListeningEvent, ListeningMap, ListeningSnapshot,
  MelodyEvidenceObservation } from '@zoeyetc/computational-listening-engine';

export type InstrumentListeningMap = ListeningMap & Readonly<{ id: string; source?: AudioSourceMetadata }>;
export type InstrumentDualPath = Readonly<{ listeningMap: InstrumentListeningMap; bassEvidence: BassEvidence | null }>;
export type InstrumentSnapshot = ListeningSnapshot & Readonly<{ mapId: string; transport: BrowserTransportState }>;
export type InstrumentEvent = ListeningEvent | Readonly<{ type: 'seek'; from: number; to: number }>;
export type InstrumentFrame = Readonly<{ snapshot: InstrumentSnapshot; events: readonly InstrumentEvent[] }>;
export type InstrumentActions = Readonly<{ play(): void; pause(): void; seek(time: number): void; restart(): void }>;
export type AudioPreparationState = Readonly<{
  sourceMode: 'fixture' | 'real-audio'; filename: string | null; duration: number | null;
  decodeState: 'idle' | 'decoding' | 'ready' | 'error'; analysisState: 'idle' | 'analyzing' | 'ready' | 'error';
  error: string | null; requestId: number;
}>;
export type SignalConsoleObservation = Readonly<{
  mapRevision: number; transport: BrowserTransportState; audioMap: InstrumentListeningMap;
  melodyEvidence?: MelodyEvidenceObservation | null;
  bassEvidence?: BassEvidence | null; bassSnapshot?: BassSnapshot | null;
  live?: LiveInputState | null;
}>;

export type { BrowserTransportState, LiveInputState } from '../audio-source-browser/index.ts';
export type { AudioAmplitudeRegion, ChromaFrame, MelodyPitchFrame, PercussionKind, SpectrumRegion, StructureAnalysisFrame, TonalCenterFrame } from '@zoeyetc/computational-listening-engine';
