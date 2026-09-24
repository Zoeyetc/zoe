import type { AudioSnapshot } from '../audio/types';
import {
  scoreStructuralAttention, STRUCTURAL_ATTENTION_CONFIG,
  type AttentionCandidateDiagnostic,
} from './attention/StructuralAttentionPolicy.ts';

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
  seek?: boolean;
  seekToken?: string | null;
}>;

export type AttentionState = Readonly<{
  mode: 'overview' | 'focus';
  focusActorId: AttentionActorId | null;
  primaryActorId: AttentionActorId | null;
  roles: Readonly<Record<AttentionActorId, AttentionRole>>;
  transition: AttentionTransition;
  primarySince: number;
  reducedMotion: boolean;
  diagnostics: Readonly<{
    source: 'structure' | 'fallback';
    scores: Readonly<Record<AttentionActorId, AttentionCandidateDiagnostic>>;
    decision: string;
    holdRemaining: number;
  }>;
}>;

export const ATTENTION_MINIMUM_PRIMARY_HOLD = STRUCTURAL_ATTENTION_CONFIG.minimumPrimaryHold;
export const ATTENTION_SWITCH_MARGIN = STRUCTURAL_ATTENTION_CONFIG.switchMargin;

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

const emptyScores = () => Object.fromEntries(ATTENTION_ACTOR_IDS.map(id => [id, {
  available: false, active: false, baseActivity: 0, structuralBias: 0, continuity: 0, score: 0, reason: 'not evaluated',
}])) as Record<AttentionActorId, AttentionCandidateDiagnostic>;

export function resolveAttentionRoles(
  evidence: AttentionEvidence,
  primaryActorId: AttentionActorId | null,
  scores?: Readonly<Record<AttentionActorId, AttentionCandidateDiagnostic>>,
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
  if (scores && primaryActorId) {
    const primaryScore = scores[primaryActorId].score;
    for (const id of ATTENTION_ACTOR_IDS) {
      if (!scores[id].available) roles[id] = 'resting';
      else if (id !== primaryActorId) roles[id] = scores[id].active
        && scores[id].score >= primaryScore * STRUCTURAL_ATTENTION_CONFIG.secondaryScoreRatio ? 'secondary' : 'ambient';
    }
    roles[primaryActorId] = 'primary';
  }
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
  let latestScores = emptyScores();
  let decisionSource: 'structure' | 'fallback' = 'fallback';
  let decision = 'waiting for evidence';
  let latestSemanticTime = 0;
  let latestSegmentId: string | null = null;
  let latestSeekToken: string | null = null;

  const settleTransition = () => {
    if (transition !== 'stable' && now() >= transitionEndsAt) transition = 'stable';
  };
  const read = (): AttentionState => {
    settleTransition();
    return {
      mode, focusActorId, primaryActorId,
      roles: latestEvidence
        ? resolveAttentionRoles(latestEvidence, primaryActorId,
          decisionSource === 'structure' ? latestScores : undefined)
        : Object.fromEntries(ATTENTION_ACTOR_IDS.map(id => [id, 'resting'])) as Record<AttentionActorId, AttentionRole>,
      transition, primarySince, reducedMotion,
      diagnostics: {
        source: decisionSource, scores: latestScores, decision,
        holdRemaining: primaryActorId === null ? 0
          : Math.max(0, minimumPrimaryHold - Math.max(0, latestSemanticTime - primarySince)),
      },
    };
  };
  const update = (evidence: AttentionEvidence, semanticTime: number) => {
    latestEvidence = evidence;
    const structural = evidence.snapshot.structure.available;
    decisionSource = structural ? 'structure' : 'fallback';
    const unseenSeek = evidence.seekToken !== undefined && evidence.seekToken !== null
      && evidence.seekToken !== latestSeekToken;
    const directResolve = evidence.seek === true || unseenSeek || semanticTime < latestSemanticTime;
    if (evidence.seekToken !== undefined && evidence.seekToken !== null) latestSeekToken = evidence.seekToken;
    latestSemanticTime = semanticTime;
    const segmentId = evidence.snapshot.structure.segmentId;
    const segmentChanged = structural && latestSegmentId !== null && segmentId !== latestSegmentId;
    latestSegmentId = segmentId;
    const scored = scoreStructuralAttention(evidence, directResolve ? null : primaryActorId);
    latestScores = scored.scores;
    const candidate = structural ? scored.leadingActorId : automaticCandidate(evidence);
    if (!evidence.snapshot.transport.playing && primaryActorId !== null && !directResolve) {
      decision = `retained ${primaryActorId}: transport paused`;
      return read();
    }
    if (candidate === primaryActorId) decision = candidate ? `retained ${candidate}: leading candidate` : 'no valid candidate';
    else if (candidate === null) decision = primaryActorId ? `retained ${primaryActorId}: no valid replacement` : 'no valid candidate';
    else if (directResolve || primaryActorId === null) {
      primaryActorId = candidate; primarySince = semanticTime;
      decision = `switched to ${candidate}: ${directResolve ? 'direct seek resolution' : 'initial candidate'}`;
    } else if (semanticTime - primarySince < minimumPrimaryHold) {
      decision = `retained ${primaryActorId}: minimum hold`;
    } else if (structural && !segmentChanged && latestScores[primaryActorId].available) {
      decision = `retained ${primaryActorId}: stable section ${segmentId ?? '—'}`;
    } else {
      const candidateScore = latestScores[candidate].score;
      const currentScore = latestScores[primaryActorId].score;
      if (!structural || candidateScore >= currentScore + ATTENTION_SWITCH_MARGIN) {
        primaryActorId = candidate; primarySince = semanticTime;
        decision = `switched to ${candidate}: score margin satisfied`;
      } else decision = `retained ${primaryActorId}: score margin ${ATTENTION_SWITCH_MARGIN.toFixed(2)}`;
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
