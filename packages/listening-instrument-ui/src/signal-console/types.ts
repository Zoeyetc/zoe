import type { InstrumentListeningMap, BrowserTransportState } from '../contracts.ts';
import type { MelodyEvidenceObservation } from '@computational-listening/engine';
import type { LiveInputState } from '@computational-listening/audio-source-browser';

/** Narrow, read-only signal observation shared by standalone presentation hosts. */
export type SignalConsoleObservation = Readonly<{
  mapRevision: number;
  transport: BrowserTransportState;
  audioMap: InstrumentListeningMap;
  melodyEvidence?: MelodyEvidenceObservation | null;
  live?: LiveInputState | null;
}>;
