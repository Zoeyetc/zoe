import type { AudioEvent, AudioFrame } from '../../audio/types';

export type DropTowerInput = Readonly<{
  structureAvailable: boolean;
  section: string | null;
  sectionProgress: number;
  energy: number;
  tension: number;
  build: number;
  transportPlaying: boolean;
  drop: Extract<AudioEvent, { type: 'drop' }> | null;
  seek: boolean;
  restart: boolean;
}>;

/** Structural boundary: local notes, percussion, groove, and harmony are intentionally excluded. */
export function toDropTowerInput(frame: AudioFrame): DropTowerInput {
  const drops = frame.events.filter(
    (event): event is Extract<AudioEvent, { type: 'drop' }> => event.type === 'drop',
  );
  const seeks = frame.events.filter(
    (event): event is Extract<AudioEvent, { type: 'seek' }> => event.type === 'seek',
  );
  return {
    structureAvailable: frame.snapshot.structure.available,
    section: frame.snapshot.structure.section,
    sectionProgress: frame.snapshot.structure.sectionProgress,
    energy: frame.snapshot.structure.energy,
    tension: frame.snapshot.structure.tension,
    build: frame.snapshot.structure.build,
    transportPlaying: frame.snapshot.transport.playing,
    drop: drops.at(-1) ?? null,
    seek: seeks.length > 0,
    restart: seeks.some(event => event.to === 0),
  };
}
