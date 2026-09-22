import type { AudioFrame } from '../../audio/types';

export type RollerCoasterInput = Readonly<{
  structureAvailable: boolean;
  section: string | null;
  sectionProgress: number;
  phraseProgress: number;
  energy: number;
  tension: number;
  transportPlaying: boolean;
  seek: boolean;
  restart: boolean;
}>;

/** Deliberately excludes note, percussion, harmony, beat, groove, and swing domains. */
export function toRollerCoasterInput(frame: AudioFrame): RollerCoasterInput {
  const structure = frame.snapshot.structure;
  const seek = frame.events.find(event => event.type === 'seek');
  return {
    structureAvailable: structure.available,
    section: structure.section,
    sectionProgress: structure.sectionProgress,
    phraseProgress: structure.phraseProgress,
    energy: structure.energy,
    tension: structure.tension,
    transportPlaying: frame.snapshot.transport.playing,
    seek: seek !== undefined,
    restart: seek?.type === 'seek' && seek.to === 0,
  };
}
