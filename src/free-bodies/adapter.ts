import type { AudioFrame } from '../audio/types';

export type FreeBodiesInput = Readonly<{
  spectrumAvailable: boolean;
  low: number;
  mid: number;
  high: number;
  brightness: number;
  texture: number;
  seek: boolean;
  restart: boolean;
}>;

/** Atmospheric-only actor boundary; exact notes, chords, percussion, and ride inputs are excluded. */
export function toFreeBodiesInput(frame: AudioFrame): FreeBodiesInput {
  const seek = frame.events.find(event => event.type === 'seek');
  return {
    spectrumAvailable: frame.snapshot.spectrum.available,
    low: frame.snapshot.spectrum.low,
    mid: frame.snapshot.spectrum.mid,
    high: frame.snapshot.spectrum.high,
    brightness: frame.snapshot.spectrum.brightness,
    texture: frame.snapshot.spectrum.texture,
    seek: seek !== undefined,
    restart: seek?.type === 'seek' && seek.to === 0,
  };
}
