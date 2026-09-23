import type { AudioEvent, AudioFrame } from '../../audio/types';

export type DropTowerDriveSource = 'authored' | 'analyzed' | 'none';

export type DropTowerDrive = Readonly<{
  source: DropTowerDriveSource;
  available: boolean;
  build: number;
  tension: number;
  release: number;
  liftIntent: number;
  holdIntent: number;
  dropAuthorized: boolean;
  confidence: number;
  preparationSeconds: number;
  cooldownRemaining: number;
  reason: string;
  authorizationId: string | null;
}>;

export type DropTowerInput = Readonly<{
  structureAvailable: boolean;
  drive: DropTowerDrive;
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
  const authored = frame.snapshot.structure.source === 'authored';
  const drop = authored ? drops.at(-1) ?? null : null;
  const build = authored ? frame.snapshot.structure.build : 0;
  const tension = authored ? frame.snapshot.structure.tension : 0;
  return {
    structureAvailable: authored,
    drive: authored ? {
      source: 'authored', available: true, build, tension,
      release: drop?.strength ?? 0, liftIntent: build, holdIntent: tension,
      dropAuthorized: drop !== null, confidence: 1,
      preparationSeconds: build > 0 ? frame.snapshot.structure.sectionProgress : 0,
      cooldownRemaining: 0,
      reason: drop ? `authored drop ${drop.id}` : 'authored structure drive',
      authorizationId: drop?.id ?? null,
    } : {
      source: 'none', available: false, build: 0, tension: 0, release: 0,
      liftIntent: 0, holdIntent: 0, dropAuthorized: false, confidence: 0,
      preparationSeconds: 0, cooldownRemaining: 0,
      reason: 'structure unavailable', authorizationId: null,
    },
    section: frame.snapshot.structure.source === 'authored' ? frame.snapshot.structure.section : null,
    sectionProgress: frame.snapshot.structure.source === 'authored' ? frame.snapshot.structure.sectionProgress : 0,
    energy: frame.snapshot.structure.source === 'authored' ? frame.snapshot.structure.energy : 0,
    tension: frame.snapshot.structure.source === 'authored' ? frame.snapshot.structure.tension : 0,
    build: frame.snapshot.structure.source === 'authored' ? frame.snapshot.structure.build : 0,
    transportPlaying: frame.snapshot.transport.playing,
    drop,
    seek: seeks.length > 0,
    restart: seeks.some(event => event.to === 0),
  };
}
