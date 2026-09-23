import type { AudioEvent, AudioFrame, TonalMode } from '../../audio/types';

export type FerrisWheelInput = Readonly<{
  harmonyAvailable: boolean;
  chord: string | null;
  rootPitchClass: number | null;
  pitchClasses: readonly number[];
  confidence: number;
  tonalCenterAvailable: boolean;
  tonalCenterLabel: string | null;
  tonicPitchClass: number | null;
  tonalMode: TonalMode | null;
  tonalConfidence: number;
  circleOfFifthsIndex: number | null;
  transportPlaying: boolean;
  chordChange: Extract<AudioEvent, { type: 'chord-change' }> | null;
  tonalCenterChange: Extract<AudioEvent, { type: 'tonal-center-change' }> | null;
  seek: boolean;
  restart: boolean;
}>;

/** Harmony/tonal boundary: melody, percussion, beat phase, and groove remain excluded. */
export function toFerrisWheelInput(frame: AudioFrame): FerrisWheelInput {
  const chordChanges = frame.events.filter(
    (event): event is Extract<AudioEvent, { type: 'chord-change' }> => event.type === 'chord-change',
  );
  const seeks = frame.events.filter(
    (event): event is Extract<AudioEvent, { type: 'seek' }> => event.type === 'seek',
  );
  const tonalCenterChanges = frame.events.filter(
    (event): event is Extract<AudioEvent, { type: 'tonal-center-change' }> => event.type === 'tonal-center-change',
  );
  return {
    harmonyAvailable: frame.snapshot.harmony.available,
    chord: frame.snapshot.harmony.chord,
    rootPitchClass: frame.snapshot.harmony.rootPitchClass,
    pitchClasses: frame.snapshot.harmony.pitchClasses,
    confidence: frame.snapshot.harmony.confidence,
    tonalCenterAvailable: frame.snapshot.tonalCenter.available,
    tonalCenterLabel: frame.snapshot.tonalCenter.label,
    tonicPitchClass: frame.snapshot.tonalCenter.rootPitchClass,
    tonalMode: frame.snapshot.tonalCenter.mode,
    tonalConfidence: frame.snapshot.tonalCenter.confidence,
    circleOfFifthsIndex: frame.snapshot.tonalCenter.circleOfFifthsIndex,
    transportPlaying: frame.snapshot.transport.playing,
    chordChange: chordChanges.at(-1) ?? null,
    tonalCenterChange: tonalCenterChanges.at(-1) ?? null,
    seek: seeks.length > 0,
    restart: seeks.some(event => event.to === 0),
  };
}
