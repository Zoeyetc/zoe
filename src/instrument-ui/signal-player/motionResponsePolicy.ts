import type { MotionMode } from './MotionMode.ts';
import { initialInstrumentMotion, instrumentEvidenceTarget, stepInstrumentMotion,
  type InstrumentMotionState } from './instrumentMotion.ts';
import { initialMaterialMotion, stepMaterialMotion, type MaterialMotionState } from './materialMotion.ts';
import { initialFieldMotion, stepFieldMotion, type FieldMotionState } from './fieldMotion.ts';
import { initialObservatoryMotion, stepObservatoryMotion, type ObservatoryMotionState } from './observatoryMotion.ts';
import type { MotionStudySample } from './motionStudyEvidence.ts';

export type MotionExpression = Readonly<{
  activity: number;
  articulation: number;
  memory: number;
  organization: number;
  commitment: number;
}>;

export type MotionPolicyState = Readonly<{
  instrument: InstrumentMotionState;
  material: MaterialMotionState;
  field: FieldMotionState;
  observatory: ObservatoryMotionState;
}>;

export const initialMotionPolicyState: MotionPolicyState = Object.freeze({
  instrument: initialInstrumentMotion,
  material: initialMaterialMotion,
  field: initialFieldMotion,
  observatory: initialObservatoryMotion,
});

const expression = (activity: number, articulation = 0, memory = 0, organization = 0,
  commitment = 0): MotionExpression => ({ activity, articulation, memory, organization, commitment });

/** Advance every bounded policy from the same evidence so mode switching never reconstructs listening history. */
export function stepMotionPolicies(state: MotionPolicyState, sample: MotionStudySample, dt: number) {
  const instrument = stepInstrumentMotion(state.instrument, instrumentEvidenceTarget(sample), dt);
  const material = stepMaterialMotion(state.material, sample, dt);
  const field = stepFieldMotion(state.field, sample, dt);
  const observatory = stepObservatoryMotion(state.observatory, sample, dt);
  const articulation = sample.active
    ? Math.max(sample.transient, sample.notePulse, sample.percussionPulse, sample.beat) : 0;
  return {
    state: { instrument, material, field, observatory },
    responses: {
      instrument: expression(instrument.activity, articulation),
      material: expression(material.activity, 0, material.pressure),
      field: expression(field.confidence, 0, 0, field.confidence),
      observatory: expression(observatory.activity, 0, 0, 0, observatory.confirmed ? 1 : 0),
    } satisfies Readonly<Record<MotionMode, MotionExpression>>,
  };
}

/** Fixed-size scalar state only; no mode retains a frame/event history. */
export const MOTION_POLICY_STATE_SCALAR_COUNT = 21;
