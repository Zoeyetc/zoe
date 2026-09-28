import type { MotionStudySample } from './motionStudyEvidence.ts';

export type FieldRelationships = Readonly<{
  melodyBass: number;
  pitchedRhythm: number;
  pitchedHarmony: number;
  harmonyTonal: number;
  percussionRhythm: number;
  organization: number;
}>;

export type FieldMotionState = Readonly<{
  confidence: number;
  relationships: FieldRelationships;
}>;

const emptyRelationships: FieldRelationships = Object.freeze({
  melodyBass: 0,
  pitchedRhythm: 0,
  pitchedHarmony: 0,
  harmonyTonal: 0,
  percussionRhythm: 0,
  organization: 0,
});

export const initialFieldMotion: FieldMotionState = {
  confidence: 0,
  relationships: emptyRelationships,
};

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const supportedPair = (first: number, second: number, ambiguity = 0) =>
  Math.min(clamp(first), clamp(second)) * (1 - clamp(ambiguity) * .72);

/** Co-occurrence and support only: no claim of consonance, groove, or causal agreement. */
export function fieldRelationships(sample: MotionStudySample): FieldRelationships {
  if (!sample.active) return emptyRelationships;
  const pitched = Math.max(sample.melodySupport, sample.bassSupport);
  const pitchedCompetition = sample.melodySupport >= sample.bassSupport
    ? sample.melodyCompetition : sample.bassCompetition;
  const melodyBass = supportedPair(sample.melodySupport, sample.bassSupport,
    Math.max(sample.melodyCompetition, sample.bassCompetition));
  const pitchedRhythm = supportedPair(pitched, sample.rhythmSupport, pitchedCompetition);
  const pitchedHarmony = supportedPair(sample.melodySupport, sample.harmonySupport,
    Math.max(sample.melodyCompetition, sample.harmonyCompetition));
  const harmonyTonal = supportedPair(sample.harmonySupport, sample.tonalSupport,
    Math.max(sample.harmonyCompetition, sample.tonalCompetition));
  const percussionRhythm = supportedPair(
    Math.max(sample.percussionActivity, sample.percussionPulse), sample.rhythmSupport);
  const relationships = [melodyBass, pitchedRhythm, pitchedHarmony, harmonyTonal, percussionRhythm];
  const organization = clamp(Math.sqrt(relationships.reduce((total, value) => total + value * value, 0)
    / relationships.length));
  return { melodyBass, pitchedRhythm, pitchedHarmony, harmonyTonal, percussionRhythm, organization };
}

/** Relationship support organizes the shared dividers; isolated activity contributes nothing. */
export function stepFieldMotion(state: FieldMotionState, sample: MotionStudySample, dt: number): FieldMotionState {
  const relationships = fieldRelationships(sample);
  const seconds = relationships.organization > state.confidence ? .24 : .52;
  let confidence = state.confidence + (relationships.organization - state.confidence)
    * (1 - Math.exp(-Math.max(0, Math.min(.1, dt)) / seconds));
  if (relationships.organization === 0 && confidence < .0005) confidence = 0;
  return { confidence, relationships };
}

/** Compatibility name for existing callers; now returns evidence relationships, not raw-feature overlap. */
export function fieldAgreement(sample: MotionStudySample) {
  return fieldRelationships(sample).organization;
}
