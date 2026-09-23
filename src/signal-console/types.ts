import type { AudioMap, TransportState } from '../audio/types';
import type { MelodyEvidenceObservation } from '../audio/melody-evidence/types';

/** Narrow, read-only signal observation shared by standalone presentation hosts. */
export type SignalConsoleObservation = Readonly<{
  mapRevision: number;
  transport: TransportState;
  audioMap: AudioMap;
  melodyEvidence?: MelodyEvidenceObservation | null;
}>;
