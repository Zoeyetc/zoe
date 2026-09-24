import type { AudioEvent, AudioFrame } from '../../audio/types';

export type PirateShipInput = Readonly<{
  rhythmAvailable: boolean;
  bpm: number | null;
  beatPhase: number;
  barPhase: number;
  groove: number;
  swing: number;
  transportPlaying: boolean;
  seek: boolean;
  restart: boolean;
}>;

/** Continuous rhythm snapshot boundary. Percussion events are intentionally excluded. */
export function toPirateShipInput(frame: AudioFrame): PirateShipInput {
  const seeks = frame.events.filter((event): event is Extract<AudioEvent, { type: 'seek' }> => event.type === 'seek');
  return {
    rhythmAvailable: frame.snapshot.rhythm.available,
    bpm: frame.snapshot.rhythm.bpm,
    beatPhase: frame.snapshot.rhythm.beatPhase,
    barPhase: frame.snapshot.rhythm.barPhase,
    groove: frame.snapshot.rhythm.groove,
    swing: frame.snapshot.rhythm.swing,
    transportPlaying: frame.snapshot.transport.playing,
    seek: seeks.length > 0,
    restart: seeks.some(event => event.to === 0),
  };
}
