export type MelodyDpStateDiagnostic = Readonly<{
  stateIndex: number;
  candidateIndex: number | null;
  pitchHz: number | null;
  midiFloat: number | null;
  candidateScore: number | null;
  localContribution: number;
  predecessorStateIndex: number | null;
  predecessorCandidateIndex: number | null;
  predecessorCumulativeObjective: number | null;
  pitchDistance: number | null;
  pitchDistanceContribution: number;
  octaveContribution: number;
  transitionContribution: number;
  cumulativeObjective: number;
  predecessorBestTieCount: number;
  bestContinuationObjective: number;
  objectiveThroughState: number;
}>;

export type MelodyDpFrameDiagnostic = Readonly<{
  frameIndex: number;
  time: number;
  rms: number;
  states: readonly MelodyDpStateDiagnostic[];
  localBestCandidateStateIndex: number | null;
  prefixBestStateIndex: number;
  selectedPathStateIndex: number;
}>;

export type MelodyDpDiagnostics = Readonly<{
  localObjectiveVariant: 'BASELINE' | 'NO_CLIFF';
  optimizationDirection: 'MAXIMIZE';
  tieBreak: 'FIRST_STATE_ON_EXACT_EQUALITY';
  frames: readonly MelodyDpFrameDiagnostic[];
  selectedTerminalStateIndex: number;
  selectedTotalObjective: number;
  terminalBestTieCount: number;
}>;
