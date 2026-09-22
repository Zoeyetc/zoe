import type { AudioEvent, AudioFrame } from '../../audio/types';

export type FerrisWheelInput = Readonly<{
  harmonyAvailable: boolean;
  chord: string | null;
  rootPitchClass: number | null;
  pitchClasses: readonly number[];
  confidence: number;
  transportPlaying: boolean;
  chordChange: Extract<AudioEvent, { type: 'chord-change' }> | null;
  seek: boolean;
  restart: boolean;
}>;

/** Harmony-only boundary: melody, percussion, beat phase, and groove are intentionally excluded. */
export function toFerrisWheelInput(frame: AudioFrame): FerrisWheelInput {
  const chordChanges = frame.events.filter(
    (event): event is Extract<AudioEvent, { type: 'chord-change' }> => event.type === 'chord-change',
  );
  const seeks = frame.events.filter(
    (event): event is Extract<AudioEvent, { type: 'seek' }> => event.type === 'seek',
  );
  return {
    harmonyAvailable: frame.snapshot.harmony.available,
    chord: frame.snapshot.harmony.chord,
    rootPitchClass: frame.snapshot.harmony.rootPitchClass,
    pitchClasses: frame.snapshot.harmony.pitchClasses,
    confidence: frame.snapshot.harmony.confidence,
    transportPlaying: frame.snapshot.transport.playing,
    chordChange: chordChanges.at(-1) ?? null,
    seek: seeks.length > 0,
    restart: seeks.some(event => event.to === 0),
  };
}
