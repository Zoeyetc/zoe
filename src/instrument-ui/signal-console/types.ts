import type { InstrumentListeningMap, BrowserTransportState } from '../contracts.ts';
import type { MelodyEvidenceObservation } from '../../listening-engine/index.ts';
import type { LiveInputState } from '../../audio-source-browser/index.ts';

/** Narrow, read-only signal observation shared by standalone presentation hosts. */
export type SignalConsoleObservation = Readonly<{
  mapRevision: number;
  transport: BrowserTransportState;
  audioMap: InstrumentListeningMap;
  melodyEvidence?: MelodyEvidenceObservation | null;
  live?: LiveInputState | null;
}>;
