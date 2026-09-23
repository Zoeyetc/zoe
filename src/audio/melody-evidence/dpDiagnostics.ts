export type MelodyCandidateScoreDiagnostic = Readonly<{
  frequencyHz: number;
  midiFloat: number;
  integerLag: number;
  interpolatedLag: number;
  rawDifferenceLeft: number;
  rawDifference: number;
  rawDifferenceRight: number;
  cumulativeDifferenceLeft: number;
  yinCumulativeDifference: number;
  cumulativeDifferenceRight: number;
  candidateSearchMode: 'LOCAL_MINIMA' | 'GLOBAL_MINIMUM_FALLBACK';
  periodicityUnclamped: number;
  periodicity: number;
  periodicityWeight: 0.50;
  periodicityContribution: number;
  harmonicSupport: number;
  harmonicWeightSum: number;
  salienceNormalizationDenominator: number;
  salienceUnclamped: number;
  salience: number;
  salienceWeight: 0.40;
  salienceContribution: number;
  frameRms: number;
  minimumRms: number;
  energyNormalizationSpan: 0.035;
  energySupportUnclamped: number;
  energySupport: number;
  energySupportWeight: 0.10;
  energySupportContribution: number;
  weightedSum: number;
  score: number;
}>;

export type MelodyYinLagPointDiagnostic = Readonly<{
  lag: number;
  frequencyHz: number;
  rawDifference: number;
  cumulativeDifference: number;
  periodicityUnclamped: number;
  periodicity: number;
  isLocalMinimum: boolean;
  selectedForCandidateGeneration: boolean;
}>;

export type MelodyYinFrameDiagnostic = Readonly<{
  frameIndex: number;
  time: number;
  rms: number;
  minimumLag: number;
  maximumLag: number;
  searchMode: 'LOCAL_MINIMA' | 'GLOBAL_MINIMUM_FALLBACK';
  localMinimumCount: number;
  selectedCandidateLags: readonly number[];
  lagPoints: readonly MelodyYinLagPointDiagnostic[];
}>;

export type MelodyDpStateDiagnostic = Readonly<{
  stateIndex: number;
  candidateIndex: number | null;
  pitchHz: number | null;
  midiFloat: number | null;
  candidateScore: number | null;
  candidateScoreDiagnostic: MelodyCandidateScoreDiagnostic | null;
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
