import type { AudioSnapshot } from '../audio/types';

export const ATTENTION_ACTOR_IDS = [
  'carousel', 'ferrisWheel', 'pirateShip', 'bumperCars', 'dropTower', 'rollerCoaster',
] as const;

export type AttentionActorId = typeof ATTENTION_ACTOR_IDS[number];
export type AttentionRole = 'primary' | 'secondary' | 'ambient' | 'resting';
export type AttentionTransition = 'stable' | 'entering-focus' | 'returning-overview';

export type AttentionEvidence = Readonly<{
  snapshot: AudioSnapshot;
  dropTowerPhase: string;
  rollerCoasterReleaseActive: boolean;
  percussionStrength: number;
}>;

export type AttentionState = Readonly<{
  mode: 'overview' | 'focus';
  focusActorId: AttentionActorId | null;
  primaryActorId: AttentionActorId | null;
  roles: Readonly<Record<AttentionActorId, AttentionRole>>;
  transition: AttentionTransition;
  primarySince: number;
  reducedMotion: boolean;
}>;

export const ATTENTION_MINIMUM_PRIMARY_HOLD = 3;

function automaticCandidate(evidence: AttentionEvidence): AttentionActorId | null {
  const { snapshot } = evidence;
  const structure = snapshot.structure;
  if (evidence.dropTowerPhase === 'HOLDING' || evidence.dropTowerPhase === 'DROPPING'
    || structure.build >= 0.78) return 'dropTower';
  if (evidence.rollerCoasterReleaseActive || structure.section === 'phrase-release'
    || (structure.phraseProgress >= 0.65 && structure.energy >= 0.68)) return 'rollerCoaster';
  if (snapshot.transport.time < 4 && snapshot.melody.available) return 'carousel';
  if (snapshot.transport.time < 8 && snapshot.harmony.active) return 'ferrisWheel';
  return null;
}

export function resolveAttentionRoles(
  evidence: AttentionEvidence,
  primaryActorId: AttentionActorId | null,
): Record<AttentionActorId, AttentionRole> {
  const { snapshot } = evidence;
  const roles: Record<AttentionActorId, AttentionRole> = {
    carousel: snapshot.melody.available ? 'ambient' : 'resting',
    ferrisWheel: snapshot.harmony.available ? 'ambient' : 'resting',
    pirateShip: snapshot.rhythm.available ? 'ambient' : 'resting',
    bumperCars: snapshot.percussion.available ? 'ambient' : 'resting',
    dropTower: snapshot.structure.available ? 'ambient' : 'resting',
    rollerCoaster: snapshot.structure.available ? 'ambient' : 'resting',
  };

  if (snapshot.melody.active) roles.carousel = 'secondary';
  if (snapshot.harmony.active) roles.ferrisWheel = 'secondary';
  if (snapshot.rhythm.available && snapshot.rhythm.groove >= 0.45) roles.pirateShip = 'secondary';
  if (evidence.percussionStrength >= 0.18) roles.bumperCars = 'secondary';
  if (snapshot.structure.build >= 0.45 || evidence.dropTowerPhase !== 'RESTING') roles.dropTower = 'secondary';
  if (snapshot.structure.energy >= 0.55 || evidence.rollerCoasterReleaseActive) roles.rollerCoaster = 'secondary';
  if (primaryActorId) roles[primaryActorId] = 'primary';
  return roles;
}

export function createAttentionController(
  now: () => number,
  reducedMotion = false,
  minimumPrimaryHold = ATTENTION_MINIMUM_PRIMARY_HOLD,
) {
  let mode: AttentionState['mode'] = 'overview';
  let focusActorId: AttentionActorId | null = null;
  let primaryActorId: AttentionActorId | null = null;
  let primarySince = Number.NEGATIVE_INFINITY;
  let transition: AttentionTransition = 'stable';
  let transitionEndsAt = 0;
  let latestEvidence: AttentionEvidence | null = null;

  const settleTransition = () => {
    if (transition !== 'stable' && now() >= transitionEndsAt) transition = 'stable';
  };
  const read = (): AttentionState => {
    settleTransition();
    return {
      mode, focusActorId, primaryActorId,
      roles: latestEvidence
        ? resolveAttentionRoles(latestEvidence, primaryActorId)
        : Object.fromEntries(ATTENTION_ACTOR_IDS.map(id => [id, 'resting'])) as Record<AttentionActorId, AttentionRole>,
      transition, primarySince, reducedMotion,
    };
  };
  const update = (evidence: AttentionEvidence, semanticTime: number) => {
    latestEvidence = evidence;
    const candidate = automaticCandidate(evidence);
    if (candidate !== primaryActorId
      && (primaryActorId === null || semanticTime < primarySince || semanticTime - primarySince >= minimumPrimaryHold)) {
      primaryActorId = candidate;
      primarySince = semanticTime;
    }
    return read();
  };
  const beginTransition = (next: AttentionTransition) => {
    transition = reducedMotion ? 'stable' : next;
    transitionEndsAt = now() + (reducedMotion ? 0 : 0.36);
  };

  return {
    update, read,
    focus(actorId: AttentionActorId) {
      mode = 'focus'; focusActorId = actorId; beginTransition('entering-focus'); return read();
    },
    overview() {
      mode = 'overview'; focusActorId = null; beginTransition('returning-overview'); return read();
    },
  };
}
