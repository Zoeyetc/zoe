import type { AudioMap, TransportState } from '../audio/types';

/** Narrow, read-only signal observation shared by standalone presentation hosts. */
export type SignalConsoleObservation = Readonly<{
  mapRevision: number;
  transport: TransportState;
  audioMap: AudioMap;
}>;
