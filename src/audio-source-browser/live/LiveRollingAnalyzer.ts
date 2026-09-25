import {
  analyzeBassFromMelodyEvidence,
  createRollingListeningSession,
  type PcmAudio,
  type RollingListeningSessionOptions,
} from '@zoeyetc/computational-listening-engine';
import type { BrowserTransportState } from '../transportTypes.ts';
import type { LiveAnalysisUpdate, LiveInputState, LiveListenerState } from './types.ts';

type AnalyzePcm = NonNullable<RollingListeningSessionOptions['analyze']>;
export type LiveRollingAnalyzerOptions = Readonly<{
  sampleRate: number; sessionId: string; deviceId: string | null; deviceLabel: string | null;
  channelCount: number; baseLatency: number | null; outputLatency: number | null;
  readTransport(): BrowserTransportState; onUpdate(update: LiveAnalysisUpdate): void;
  analyze?: AnalyzePcm; now?: () => number;
}>;
const status = (ready: boolean, available: boolean): LiveListenerState => !ready ? 'WARMING_UP' : available ? 'LIVE' : 'SEARCHING';

export function createLiveRollingAnalyzer(options: LiveRollingAnalyzerOptions) {
  return createRollingListeningSession({
    sampleRate: options.sampleRate, analyze: options.analyze, now: options.now,
    readTime: () => options.readTransport().time,
    onUpdate(update) {
      const transport = options.readTransport();
      const elapsed = transport.time;
      const listeners = {
        signal: { state: status(elapsed >= 0.05, true), elapsed, required: 0.05 },
        melody: { state: status(elapsed >= 2, update.map.capabilities.melody), elapsed, required: 2 },
        rhythm: { state: status(elapsed >= 4, update.map.capabilities.rhythm), elapsed, required: 4 },
        percussion: { state: status(elapsed >= 0.3, update.map.capabilities.percussion), elapsed, required: 0.3 },
        harmony: { state: status(elapsed >= 2, update.map.capabilities.harmony), elapsed, required: 2 },
        tonalCenter: { state: status(elapsed >= 8, update.map.capabilities.tonalCenter), elapsed, required: 8 },
        structure: { state: 'UNAVAILABLE_LIVE' as const, elapsed, required: 0 },
      };
      const state: LiveInputState = {
        status: 'LIVE', devices: [], selectedDeviceId: options.deviceId, deviceLabel: options.deviceLabel,
        sampleRate: options.sampleRate, channelCount: options.channelCount, sessionTime: elapsed,
        baseLatency: options.baseLatency, outputLatency: options.outputLatency,
        ...update.diagnostics, listeners, error: null,
      };
      options.onUpdate({ sessionId: options.sessionId, map: update.map,
        bassEvidence: update.map.melodyEvidence
          ? analyzeBassFromMelodyEvidence(update.map.melodyEvidence) : null,
        source: { kind: 'live-input', filename: null, mimeType: 'audio/x-live-input', deviceId: options.deviceId, deviceLabel: options.deviceLabel },
        transport, events: update.events, state });
    },
  });
}
export type { PcmAudio };
