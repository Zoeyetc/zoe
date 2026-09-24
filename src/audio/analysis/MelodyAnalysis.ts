/** Temporary compatibility re-export. Delete after consumers use the engine package APIs. */
export { MELODY_ANALYSIS, analyzeMelody, analyzeMelodyWithEvidence } from '@computational-listening/engine';
export type { MelodyAnalysisInput, MelodyAnalysisWithEvidence } from '@computational-listening/engine';
export { MELODY_SUBHARMONIC_AMBIGUITY, analyzeMelodyWithDpDiagnostics, analyzeMelodyWithNoCliffExperiment, analyzeMelodyWithSubharmonicAmbiguityExperiment, inspectMelodyYinFrame } from '@computational-listening/engine/diagnostics';
export type { MelodyAnalysisWithDpDiagnostics, MelodyLocalObjectiveVariant, MelodySubharmonicAmbiguityPenalty } from '@computational-listening/engine/diagnostics';
