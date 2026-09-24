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
    structureAvailable: structure.source === 'authored',
    section: structure.source === 'authored' ? structure.section : null,
    sectionProgress: structure.source === 'authored' ? structure.sectionProgress : 0,
    phraseProgress: structure.source === 'authored' ? structure.phraseProgress : 0,
    energy: structure.source === 'authored' ? structure.energy : 0,
    tension: structure.source === 'authored' ? structure.tension : 0,
    transportPlaying: frame.snapshot.transport.playing,
    seek: seek !== undefined,
    restart: seek?.type === 'seek' && seek.to === 0,
  };
}
