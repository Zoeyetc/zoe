import type { InstrumentListeningMap, BrowserTransportState } from '../contracts.ts';
import type { BassEvidence, BassSnapshot, MelodyEvidenceObservation } from '@zoeyetc/computational-listening-engine';
import type { LiveInputState } from '../../audio-source-browser/index.ts';

/** Narrow, read-only signal observation shared by standalone presentation hosts. */
export type SignalConsoleObservation = Readonly<{
  mapRevision: number;
  transport: BrowserTransportState;
  audioMap: InstrumentListeningMap;
  melodyEvidence?: MelodyEvidenceObservation | null;
  bassEvidence?: BassEvidence | null;
  bassSnapshot?: BassSnapshot | null;
  live?: LiveInputState | null;
}>;
