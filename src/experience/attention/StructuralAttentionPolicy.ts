import type { AudioSnapshot } from '../../audio/types';

export const STRUCTURAL_ATTENTION_ACTOR_IDS = [
  'carousel', 'ferrisWheel', 'pirateShip', 'bumperCars', 'dropTower', 'rollerCoaster',
] as const;

export type StructuralAttentionActorId = typeof STRUCTURAL_ATTENTION_ACTOR_IDS[number];

export const STRUCTURAL_ATTENTION_CONFIG = Object.freeze({
  minimumPrimaryHold: 3,
  switchMargin: 0.08,
  boundaryAnticipationWindow: 1.5,
  continuityWeight: 0.08,
  secondaryScoreRatio: 0.72,
  weights: Object.freeze({ energy: 0.12, contrast: 0.22, importance: 0.18 }),
});

export type StructuralAttentionEvidence = Readonly<{
  snapshot: AudioSnapshot;
  dropTowerPhase: string;
  rollerCoasterReleaseActive: boolean;
  percussionStrength: number;
  seek?: boolean;
  seekToken?: string | null;
}>;

export type AttentionCandidateDiagnostic = Readonly<{
  available: boolean;
  active: boolean;
  baseActivity: number;
  structuralBias: number;
  continuity: number;
  score: number;
  reason: string;
}>;

export type StructuralAttentionDecision = Readonly<{
  scores: Readonly<Record<StructuralAttentionActorId, AttentionCandidateDiagnostic>>;
  leadingActorId: StructuralAttentionActorId | null;
}>;

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

function boundaryAnticipation(snapshot: AudioSnapshot): number {
  const next = snapshot.structure.nextBoundaryTime;
  if (next === null) return 0;
  const remaining = next - snapshot.transport.time;
  if (remaining < 0 || remaining > STRUCTURAL_ATTENTION_CONFIG.boundaryAnticipationWindow) return 0;
  return (1 - remaining / STRUCTURAL_ATTENTION_CONFIG.boundaryAnticipationWindow)
    * (snapshot.structure.nextBoundaryConfidence ?? snapshot.structure.confidence);
}

/**
 * Experience Composition heuristic only. It reads AudioWorld truth and never
 * writes musical evidence, actor inputs, simulations, or PhysicsWorld state.
 */
export function scoreStructuralAttention(
  evidence: StructuralAttentionEvidence,
  currentPrimary: StructuralAttentionActorId | null,
): StructuralAttentionDecision {
  const { snapshot } = evidence;
  const { structure } = snapshot;
  const authoredLongForm = structure.source === 'authored';
  const anticipation = boundaryAnticipation(snapshot);

  const inputs: Record<StructuralAttentionActorId, Omit<AttentionCandidateDiagnostic, 'score' | 'reason'>> = {
    carousel: {
      available: snapshot.melody.available,
      active: snapshot.melody.active,
      baseActivity: snapshot.melody.available
        ? 0.24 + (snapshot.melody.active ? 0.42 : 0.06) + snapshot.melody.intensity * 0.18 : 0,
      structuralBias: snapshot.melody.available
        ? structure.energy * STRUCTURAL_ATTENTION_CONFIG.weights.energy + structure.importance * 0.04 : 0,
      continuity: 0,
    },
    ferrisWheel: {
      available: snapshot.harmony.available,
      active: snapshot.harmony.active,
      baseActivity: snapshot.harmony.available
        ? 0.25 + (snapshot.harmony.active ? 0.34 : 0.06) + snapshot.harmony.confidence * 0.2 : 0,
      structuralBias: snapshot.harmony.available
        ? (1 - structure.contrast) * 0.08 + structure.importance * 0.04 : 0,
      continuity: 0,
    },
    pirateShip: {
      available: snapshot.rhythm.available,
      active: snapshot.rhythm.available && snapshot.rhythm.confidence > 0,
      baseActivity: snapshot.rhythm.available
        ? 0.22 + snapshot.rhythm.groove * 0.5 + snapshot.rhythm.confidence * 0.1 : 0,
      structuralBias: snapshot.rhythm.available ? structure.energy * 0.1 : 0,
      continuity: 0,
    },
    bumperCars: {
      available: snapshot.percussion.available,
      active: snapshot.percussion.available && evidence.percussionStrength > 0,
      baseActivity: snapshot.percussion.available ? 0.2 + clamp01(evidence.percussionStrength) * 0.65 : 0,
      structuralBias: 0,
      continuity: 0,
    },
    dropTower: {
      available: structure.available,
      active: structure.available,
      baseActivity: structure.available ? 0.2 + structure.contrast * 0.24 + structure.importance * 0.18
        + (authoredLongForm && (evidence.dropTowerPhase === 'HOLDING' || evidence.dropTowerPhase === 'DROPPING') ? 0.76 : 0) : 0,
      structuralBias: structure.available
        ? structure.contrast * STRUCTURAL_ATTENTION_CONFIG.weights.contrast
          + structure.importance * STRUCTURAL_ATTENTION_CONFIG.weights.importance + anticipation * 0.2 : 0,
      continuity: 0,
    },
    rollerCoaster: {
      available: authoredLongForm && structure.available,
      active: authoredLongForm && structure.available
        && (evidence.rollerCoasterReleaseActive || structure.phraseProgress > 0),
      baseActivity: authoredLongForm && structure.available
        ? 0.2 + structure.energy * 0.25 + (evidence.rollerCoasterReleaseActive ? 0.68 : 0) : 0,
      structuralBias: authoredLongForm && structure.available
        ? structure.energy * STRUCTURAL_ATTENTION_CONFIG.weights.energy + structure.importance * 0.06 : 0,
      continuity: 0,
    },
  };

  const scores = Object.fromEntries(STRUCTURAL_ATTENTION_ACTOR_IDS.map(actorId => {
    const input = inputs[actorId];
    const continuity = input.available && actorId === currentPrimary
      ? STRUCTURAL_ATTENTION_CONFIG.continuityWeight : 0;
    const score = input.available && input.active
      ? clamp01(input.baseActivity + input.structuralBias + continuity) : 0;
    const reason = !input.available ? 'unavailable'
      : !input.active ? 'available but inactive'
        : `${input.baseActivity.toFixed(2)} activity + ${input.structuralBias.toFixed(2)} structure + ${continuity.toFixed(2)} continuity`;
    return [actorId, { ...input, continuity, score, reason }];
  })) as Record<StructuralAttentionActorId, AttentionCandidateDiagnostic>;

  const leadingActorId = STRUCTURAL_ATTENTION_ACTOR_IDS
    .filter(actorId => scores[actorId].available && scores[actorId].active)
    .sort((left, right) => scores[right].score - scores[left].score
      || STRUCTURAL_ATTENTION_ACTOR_IDS.indexOf(left) - STRUCTURAL_ATTENTION_ACTOR_IDS.indexOf(right))[0] ?? null;

  return { scores, leadingActorId };
}
