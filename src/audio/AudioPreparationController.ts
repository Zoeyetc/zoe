import type { AudioMap } from './types';
import { decodeLocalAudioFile } from './AudioSourceLoader';
import { analyzePcmAudioAsync, pcmFromAudioBuffer } from './analysis/AudioAnalysis';
import { createLatestRequestGuard } from './analysis/requestGuard';

export type AudioPreparationState = Readonly<{
  sourceMode: 'fixture' | 'real-audio';
  filename: string | null;
  duration: number | null;
  decodeState: 'idle' | 'decoding' | 'ready' | 'error';
  analysisState: 'idle' | 'analyzing' | 'ready' | 'error';
  error: string | null;
  requestId: number;
}>;

export type PreparedRealAudio = Readonly<{
  context: AudioContext;
  buffer: AudioBuffer;
  map: AudioMap;
}>;

export const FIXTURE_PREPARATION_STATE: AudioPreparationState = {
  sourceMode: 'fixture', filename: null, duration: null,
  decodeState: 'idle', analysisState: 'idle', error: null, requestId: 0,
};

export function createAudioPreparationController(
  onState: (state: AudioPreparationState) => void,
  createContext: () => AudioContext = () => new AudioContext(),
) {
  const requests = createLatestRequestGuard();
  let context: AudioContext | null = null;
  let state = FIXTURE_PREPARATION_STATE;
  const publish = (next: AudioPreparationState) => { state = next; onState(next); };
  const ensureContext = () => context ??= createContext();

  return {
    read: () => state,
    async prepare(file: File): Promise<PreparedRealAudio | null> {
      const requestId = requests.begin();
      publish({ sourceMode: 'real-audio', filename: file.name, duration: null,
        decodeState: 'decoding', analysisState: 'idle', error: null, requestId });
      try {
        const audioContext = ensureContext();
        const buffer = await decodeLocalAudioFile(file, audioContext);
        if (!requests.isCurrent(requestId)) return null;
        publish({ ...state, duration: buffer.duration, decodeState: 'ready', analysisState: 'analyzing' });
        const map = await analyzePcmAudioAsync(pcmFromAudioBuffer(buffer), {
          id: `${requestId}-${file.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
          filename: file.name, mimeType: file.type || 'application/octet-stream',
        });
        if (!requests.isCurrent(requestId)) return null;
        publish({ ...state, duration: buffer.duration, analysisState: 'ready' });
        return { context: audioContext, buffer, map };
      } catch (error) {
        if (!requests.isCurrent(requestId)) return null;
        const message = error instanceof Error ? error.message : 'Audio preparation failed';
        publish({ ...state, decodeState: state.decodeState === 'decoding' ? 'error' : state.decodeState,
          analysisState: state.analysisState === 'analyzing' ? 'error' : state.analysisState, error: message });
        return null;
      }
    },
    useFixture() {
      requests.invalidate();
      publish({ ...FIXTURE_PREPARATION_STATE, requestId: requests.current() });
    },
    invalidate() { requests.invalidate(); },
    dispose() {
      requests.invalidate();
      if (context && context.state !== 'closed') void context.close();
      context = null;
    },
  };
}
