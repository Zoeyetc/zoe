export type Vec3 = Readonly<{ x: number; y: number; z: number }>;
export type TrackFrame = Readonly<{ position: Vec3; forward: Vec3; up: Vec3 }>;
export type SegmentKind = 'Station' | 'Lift' | 'Crest' | 'Drop' | 'Run' | 'Loop' | 'Runout';
export type SegmentGeometry = Readonly<{
  length: number;
  samplePosition(distance: number): Vec3;
  sampleTangent(distance: number): Vec3;
  sampleUp(distance: number): Vec3;
}>;
export type SegmentPhysics = Readonly<{
  gravityScale: number;
  drag: number;
  driveForce: number;
  brakeForce: number;
}>;
export type SegmentDefinition = Readonly<{
  featureId?: string;
  kind: SegmentKind;
  geometry: SegmentGeometry;
  entryFrame: TrackFrame;
  exitFrame: TrackFrame;
  physics: SegmentPhysics;
}>;
export type HiddenConnector = Readonly<{
  hidden: true;
  nextSegment: SegmentKind;
}>;
export type RoutePiece = Readonly<{
  start: number;
  geometry: SegmentGeometry;
  segment?: SegmentDefinition;
  connector?: HiddenConnector;
}>;
export type Route = Readonly<{
  pieces: readonly RoutePiece[];
  segments: readonly SegmentDefinition[];
  length: number;
}>;
