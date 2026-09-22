import type { AudioEvent, AudioFrame } from '../../audio/types';

export type BumperCarsInput = Readonly<{
  percussionAvailable: boolean;
  transportPlaying: boolean;
  events: readonly AudioEvent[];
}>;

/** Musical boundary only; car selection and spatial impulse remain actor-local. */
export function toBumperCarsInput(frame: AudioFrame): BumperCarsInput {
  return {
    percussionAvailable: frame.snapshot.percussion.available,
    transportPlaying: frame.snapshot.transport.playing,
    events: frame.events,
  };
}
