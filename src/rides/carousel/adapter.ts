import type { AudioFrame, AudioEvent, MelodyNote, ScaleDegreeEvidence } from '../../audio/types';

export type CarouselInput = Readonly<{
  melodyAvailable: boolean;
  activeNote: MelodyNote | null;
  scaleDegree: ScaleDegreeEvidence;
  noteProgress: number;
  transportPlaying: boolean;
  events: readonly AudioEvent[];
}>;

/** Musical input boundary; no raw audio, clock, geometry, or transforms. */
export function toCarouselInput(frame: AudioFrame): CarouselInput {
  return {
    melodyAvailable: frame.snapshot.melody.available,
    activeNote: frame.snapshot.melody.activeNote,
    scaleDegree: frame.snapshot.melody.scaleDegree,
    noteProgress: frame.snapshot.melody.noteProgress,
    transportPlaying: frame.snapshot.transport.playing,
    events: frame.events.filter(event => event.type === 'note-on'
      || event.type === 'note-off' || event.type === 'seek'),
  };
}
