import type { AudioClock } from './AudioClock';
import type { TransportState } from './types';

export type AudioPlaybackDiagnostics = Readonly<{
  contextState: AudioContextState;
  playbackOffset: number;
  sourceNodeState: 'idle' | 'playing' | 'paused' | 'ended' | 'disposed';
}>;

export type AudioPlaybackTransport = AudioClock & Readonly<{
  diagnostics(): AudioPlaybackDiagnostics;
  dispose(): void;
}>;

export function createAudioBufferPlaybackTransport(
  context: AudioContext,
  buffer: AudioBuffer,
): AudioPlaybackTransport {
  const duration = buffer.duration;
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Cannot play empty audio');
  let offset = 0;
  let contextStartTime = 0;
  let playing = false;
  let ended = false;
  let disposed = false;
  let wantsPlayback = false;
  let source: AudioBufferSourceNode | null = null;
  let sourceGeneration = 0;

  const stopSource = () => {
    sourceGeneration += 1;
    if (!source) return;
    source.onended = null;
    try { source.stop(); } catch { /* already stopped */ }
    source.disconnect();
    source = null;
  };
  const currentTime = () => Math.min(duration,
    playing ? offset + Math.max(0, context.currentTime - contextStartTime) : offset);
  const finishIfNeeded = () => {
    const time = currentTime();
    if (playing && time >= duration) {
      offset = duration;
      playing = false;
      wantsPlayback = false;
      ended = true;
      if (source) { source.onended = null; source.disconnect(); source = null; }
    }
    return time;
  };
  const startSource = () => {
    if (disposed || !wantsPlayback || playing || offset >= duration) return;
    stopSource();
    const node = context.createBufferSource();
    const generation = sourceGeneration;
    node.buffer = buffer;
    node.connect(context.destination);
    node.onended = () => {
      if (disposed || generation !== sourceGeneration || !playing) return;
      offset = duration;
      playing = false;
      wantsPlayback = false;
      ended = true;
      node.disconnect();
      if (source === node) source = null;
    };
    contextStartTime = context.currentTime;
    source = node;
    playing = true;
    ended = false;
    node.start(0, offset);
  };
  const seek = (time: number) => {
    if (!Number.isFinite(time)) throw new Error('Invalid seek time');
    const resume = playing || wantsPlayback;
    wantsPlayback = false;
    stopSource();
    playing = false;
    offset = Math.max(0, Math.min(duration, time));
    ended = offset >= duration;
    if (resume && offset < duration) {
      wantsPlayback = true;
      if (context.state === 'running') startSource();
      else void context.resume().then(startSource);
    }
  };

  return {
    read(): TransportState {
      const time = finishIfNeeded();
      return { time, duration, playing };
    },
    play() {
      if (disposed || playing || wantsPlayback || offset >= duration) return;
      wantsPlayback = true;
      if (context.state === 'running') startSource();
      else void context.resume().then(startSource);
    },
    pause() {
      if (!playing && !wantsPlayback) return;
      if (playing) offset = currentTime();
      wantsPlayback = false;
      playing = false;
      stopSource();
    },
    seek,
    restart() { seek(0); },
    diagnostics() {
      return {
        contextState: context.state,
        playbackOffset: currentTime(),
        sourceNodeState: disposed ? 'disposed' : playing ? 'playing' : ended ? 'ended' : offset > 0 ? 'paused' : 'idle',
      };
    },
    dispose() {
      if (disposed) return;
      if (playing) offset = currentTime();
      wantsPlayback = false;
      playing = false;
      disposed = true;
      stopSource();
    },
  };
}
