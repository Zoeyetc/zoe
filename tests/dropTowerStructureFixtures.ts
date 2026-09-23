export type DropTowerStructureFixture = Readonly<{
  id: string;
  confidence: number;
  energy: number;
  contrast: number;
  importance: number;
  nextBoundaryConfidence: number | null;
  description: string;
}>;

/** Deterministic interpretation cases; labels are diagnostic and never drive the actor. */
export const DROP_TOWER_STRUCTURE_FIXTURES: readonly DropTowerStructureFixture[] = [
  { id: 'flat', confidence: .9, energy: .45, contrast: .05, importance: .2, nextBoundaryConfidence: .1, description: 'flat section with no build' },
  { id: 'gradual-build', confidence: .9, energy: .62, contrast: .55, importance: .75, nextBoundaryConfidence: .8, description: 'gradual build without strong release' },
  { id: 'prepared-release', confidence: .92, energy: .7, contrast: .9, importance: .9, nextBoundaryConfidence: .95, description: 'build then strong boundary release' },
  { id: 'weak-boundary', confidence: .9, energy: .65, contrast: .35, importance: .7, nextBoundaryConfidence: .42, description: 'build then weak boundary' },
  { id: 'unprepared-boundary', confidence: .92, energy: .8, contrast: .95, importance: .9, nextBoundaryConfidence: .95, description: 'strong boundary without preparation' },
  { id: 'nearby-boundaries', confidence: .94, energy: .72, contrast: .94, importance: .9, nextBoundaryConfidence: .95, description: 'repeated nearby boundaries' },
  { id: 'high-stable', confidence: .9, energy: .95, contrast: .05, importance: .2, nextBoundaryConfidence: .1, description: 'high energy stable section' },
  { id: 'low-stable', confidence: .9, energy: .12, contrast: .05, importance: .15, nextBoundaryConfidence: .1, description: 'low energy stable section' },
  { id: 'a-to-b', confidence: .92, energy: .7, contrast: .9, importance: .88, nextBoundaryConfidence: .92, description: 'A to B strong contrast' },
  { id: 'a-b-a', confidence: .91, energy: .68, contrast: .82, importance: .82, nextBoundaryConfidence: .9, description: 'A to B to A recurrence' },
  { id: 'electronic-like', confidence: .94, energy: .78, contrast: .92, importance: .94, nextBoundaryConfidence: .96, description: 'electronic build and release evidence' },
  { id: 'gradual-transition', confidence: .74, energy: .55, contrast: .38, importance: .52, nextBoundaryConfidence: .58, description: 'gradual classical-like transition' },
  { id: 'weak-confidence', confidence: .4, energy: .75, contrast: .9, importance: .9, nextBoundaryConfidence: .95, description: 'weak confidence structure' },
  { id: 'unavailable', confidence: 0, energy: 0, contrast: 0, importance: 0, nextBoundaryConfidence: null, description: 'unavailable structure' },
  { id: 'short-song', confidence: .45, energy: .5, contrast: .4, importance: .4, nextBoundaryConfidence: null, description: 'short song' },
] as const;
