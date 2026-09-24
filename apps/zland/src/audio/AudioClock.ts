import type { TransportState } from './types';

/** The sole transport owner. No subscriptions, render loop, or musical lookup. */
export interface AudioClock {
  read(): TransportState;
  play(): void;
  pause(): void;
  seek(time: number): void;
  restart(): void;
}

/** Silent development transport. Inject seconds; real audio needs Web Audio time. */
export function createPreviewAudioClock(duration: number, now: () => number): AudioClock {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Invalid duration');
  let position = 0;
  let anchor = 0;
  let playing = false;

  const read = (): TransportState => {
    const time = Math.min(duration, position + (playing ? Math.max(0, now() - anchor) : 0));
    if (time >= duration) { position = duration; playing = false; }
    return { time, duration, playing };
  };
  const seek = (time: number) => {
    if (!Number.isFinite(time)) throw new Error('Invalid seek time');
    position = Math.max(0, Math.min(duration, time));
    anchor = now();
    if (position === duration) playing = false;
  };
  return {
    read,
    play() {
      if (read().playing || position >= duration) return;
      anchor = now();
      playing = true;
    },
    pause() { position = read().time; playing = false; },
    seek,
    restart() { seek(0); }, // preserve play/pause state
  };
}
