import type { ListeningEvent, ListeningMap } from '../../listening-engine/index.ts';
import type { AudioSourceMetadata } from '../types.ts';
import type { BrowserTransportState } from '../transportTypes.ts';

export type LiveInputStatus = 'NOT_REQUESTED' | 'REQUESTING' | 'LIVE' | 'DENIED' | 'NO_DEVICE' | 'DEVICE_LOST' | 'STOPPED' | 'ERROR';
export type LiveListenerState = 'LIVE' | 'WARMING_UP' | 'SEARCHING' | 'UNAVAILABLE_LIVE';
export type LiveListenerId = 'signal' | 'melody' | 'rhythm' | 'percussion' | 'harmony' | 'tonalCenter' | 'structure';
export type LiveListenerStatus = Readonly<{ state: LiveListenerState; elapsed: number; required: number }>;
export type LiveInputDevice = Readonly<{ deviceId: string; label: string; labelAvailable: boolean }>;
export type LiveInputState = Readonly<{
  status: LiveInputStatus; devices: readonly LiveInputDevice[]; selectedDeviceId: string | null;
  deviceLabel: string | null; sampleRate: number | null; channelCount: number | null; sessionTime: number;
  baseLatency: number | null; outputLatency: number | null; rollingPcmBytes: number;
  retainedEvidenceBytes: number; retainedEventCount: number; analysisCadence: number;
  droppedAnalysisRequests: number; lastAnalysisLatency: number | null;
  listeners: Readonly<Record<LiveListenerId, LiveListenerStatus>>; error: string | null;
}>;
export type LiveAnalysisUpdate = Readonly<{
  sessionId: string; map: ListeningMap; source: AudioSourceMetadata; transport: BrowserTransportState;
  events: readonly ListeningEvent[]; state: LiveInputState;
}>;
export const LIVE_INPUT_WINDOW_SECONDS = 12;
export const LIVE_ANALYSIS_CADENCE_SECONDS = 0.5;
export const LIVE_EVENT_BUFFER_CAP = 64;
const listener = (state: LiveListenerState, elapsed: number, required: number): LiveListenerStatus => ({ state, elapsed, required });
export function emptyLiveListeners(): LiveInputState['listeners'] { return {
  signal: listener('WARMING_UP', 0, 0.05), melody: listener('WARMING_UP', 0, 2), rhythm: listener('WARMING_UP', 0, 4),
  percussion: listener('WARMING_UP', 0, 0.3), harmony: listener('WARMING_UP', 0, 2), tonalCenter: listener('WARMING_UP', 0, 8),
  structure: listener('UNAVAILABLE_LIVE', 0, 0),
}; }
export const INITIAL_LIVE_INPUT_STATE: LiveInputState = Object.freeze({
  status: 'NOT_REQUESTED', devices: Object.freeze([]), selectedDeviceId: null, deviceLabel: null,
  sampleRate: null, channelCount: null, sessionTime: 0, baseLatency: null, outputLatency: null,
  rollingPcmBytes: 0, retainedEvidenceBytes: 0, retainedEventCount: 0,
  analysisCadence: LIVE_ANALYSIS_CADENCE_SECONDS, droppedAnalysisRequests: 0, lastAnalysisLatency: null,
  listeners: emptyLiveListeners(), error: null,
});
