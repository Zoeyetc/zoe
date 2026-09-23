import { milestoneSevenAAudioMap } from './AudioMap.ts';
import type { AudioMap, StructureAnalysis, StructureBoundary, StructureSegment } from './types.ts';

export type DropTowerQaScenario = 'prepared-release' | 'weak-boundary' | 'unprepared-boundary'
  | 'nearby-boundaries' | 'unavailable';

const metadata: StructureAnalysis['metadata'] = {
  featureDimensions: ['fixture'], normalization: 'per-dimension-z-score-clamped-3-then-l2',
  similarity: 'cosine-mapped-0-1', noveltyKernelRadii: [1, 2, 4], minimumBoundarySeparation: 4,
  minimumArrangementSpacing: 2, minimumSectionDuration: 8, strongBoundaryMinimumSectionDuration: 4,
  boundarySnapMaximumBins: 1, beatBlockSizes: [8, 16, 32], coreFeatureDimensions: ['fixture'],
  arrangementFeatureDimensions: [], tempoAwareScaleTerminology: 'beat-count-blocks-not-meter',
  boundaryScoreFormula: 'deterministic QA fixture', arrangementScoreFormula: 'unused',
  fallbackWindowDuration: 1, recurrenceThreshold: .82, exactRecurrenceThreshold: .94,
  capabilityThreshold: .48, maximumFrameCount: 384,
};

function analysis(scenario: Exclude<DropTowerQaScenario, 'unavailable'>): StructureAnalysis {
  const firstBoundaryTime = 10;
  const nearbyBoundaryTime = 12.2;
  const weak = scenario === 'weak-boundary';
  const unprepared = scenario === 'unprepared-boundary';
  const boundaryConfidence = weak ? .4 : .95;
  const initialSegments: readonly StructureSegment[] = [
    { id: 'qa-a', start: 0, end: firstBoundaryTime, label: 'A', recurrenceGroup: 'A', confidence: .95,
      energy: .7, contrast: unprepared ? .05 : .85, importance: unprepared ? .1 : .9, startBoundaryConfidence: 0 },
    { id: 'qa-b', start: firstBoundaryTime, end: scenario === 'nearby-boundaries' ? nearbyBoundaryTime : 16,
      label: 'B', recurrenceGroup: 'B', confidence: .95,
      energy: weak ? .62 : .2, contrast: weak ? .3 : .95, importance: weak ? .5 : .9,
      startBoundaryConfidence: boundaryConfidence },
    ...(scenario === 'nearby-boundaries' ? [{
      id: 'qa-c', start: nearbyBoundaryTime, end: 16, label: 'C', recurrenceGroup: 'C', confidence: .95,
      energy: .82, contrast: .95, importance: .9, startBoundaryConfidence: .95,
    }] : []),
  ];
  const segments = initialSegments;
  const boundaries: readonly StructureBoundary[] = [{ id: 'qa-boundary', time: firstBoundaryTime, frameIndex: 1,
    novelty: boundaryConfidence, confidence: boundaryConfidence, sectionScore: boundaryConfidence,
    shortNovelty: boundaryConfidence, mediumNovelty: boundaryConfidence, longNovelty: boundaryConfidence,
    gridAlignmentBonus: 0 }, ...(scenario === 'nearby-boundaries' ? [{
      id: 'qa-nearby-boundary', time: nearbyBoundaryTime, frameIndex: 2, novelty: .95, confidence: .95,
      sectionScore: .95, shortNovelty: .95, mediumNovelty: .95, longNovelty: .95,
      gridAlignmentBonus: 0,
    }] : [])];
  return {
    version: 1, available: true, trackConfidence: .95, aggregationMode: 'time-fallback',
    frames: segments.map((segment, index) => ({ id: `qa-frame-${index}`, start: segment.start, end: segment.end,
      vector: [segment.energy, segment.contrast, segment.importance], energy: segment.energy, onsetDensity: 0 })),
    selfSimilarity: { size: segments.length, values: new Float32Array(segments.flatMap(
      (_, row) => segments.map((__, column) => row === column ? 1 : 0),
    )) },
    novelty: boundaries.map(boundary => boundary.novelty), noveltyScales: {
      short: boundaries.map(boundary => boundary.shortNovelty),
      medium: boundaries.map(boundary => boundary.mediumNovelty),
      long: boundaries.map(boundary => boundary.longNovelty),
    },
    arrangementChanges: [], boundaries, segments, recurrenceGroupCount: segments.length,
    averageSegmentDuration: 16 / segments.length, metadata,
  };
}

export function createDropTowerQaAudioMap(scenario: DropTowerQaScenario): AudioMap {
  const unavailable = scenario === 'unavailable';
  return {
    ...milestoneSevenAAudioMap,
    id: `drop-tower-qa-${scenario}`,
    duration: 16,
    capabilities: { ...milestoneSevenAAudioMap.capabilities, structure: !unavailable },
    structure: null,
    drops: null,
    structureAnalysis: unavailable ? null : analysis(scenario),
  };
}

export function resolveDropTowerQaAudioMap(value: string | null): AudioMap | null {
  return value === 'prepared-release' || value === 'weak-boundary'
    || value === 'unprepared-boundary' || value === 'nearby-boundaries' || value === 'unavailable'
    ? createDropTowerQaAudioMap(value) : null;
}
