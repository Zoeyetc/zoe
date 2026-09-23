import { connectorGeometry, frameAt, lineGeometry, makeDropGeometry, makeLiftGeometry, makeLoopGeometry, makeRunoutGeometry, placeGeometry, sampledGeometry, V } from './geometry.ts';
import { rollerCoasterSegmentPhysics, sampleRoute } from './route.ts';
import type { Route, RoutePiece, SegmentDefinition, SegmentGeometry, SegmentKind, TrackFrame, Vec3 } from './types.ts';
import { createSafeTrackPlan, type TrackFeaturePlan, type TrackFeatureType, type TrackPlan } from './trackPlan.ts';
import type { AudioMap } from '../../audio/types.ts';

export const TRACK_MAP_VERSION = '9f.1';
export const TRACK_LOCAL_BOUNDS = Object.freeze({ minX: 0, maxX: 1200, minY: -300, maxY: 300, minZ: -110, maxZ: 110 });
export type TrackMapBounds = Readonly<{ minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }>;
export type TrackMapSegment = Readonly<{
  featureId: string;
  type: TrackFeatureType;
  startDistance: number;
  endDistance: number;
  sourceEvidence: TrackFeaturePlan['sourceEvidence'];
}>;
export type TrackMap = Readonly<{
  version: typeof TRACK_MAP_VERSION;
  id: string;
  planId: string;
  route: Route;
  points: readonly Vec3[];
  segments: readonly TrackMapSegment[];
  totalLength: number;
  bounds: TrackMapBounds;
  normalizationScale: number;
  valid: boolean;
  fallbackUsed: boolean;
  generationMs: number;
  error: string | null;
}>;

const kindFor = (type: TrackFeatureType): SegmentKind => type[0].toUpperCase() + type.slice(1) as SegmentKind;
const featureLength = (feature: TrackFeaturePlan) => 110 + feature.scale * 210;
const scaleGeometry = (geometry: SegmentGeometry, scale: number): SegmentGeometry => ({
  length: geometry.length * scale,
  samplePosition: distance => {
    const point = geometry.samplePosition(distance / scale);
    return V(point.x * scale, point.y * scale, point.z * scale);
  },
  sampleTangent: distance => geometry.sampleTangent(distance / scale),
  sampleUp: distance => geometry.sampleUp(distance / scale),
});
const makeCrestGeometry = (length: number, strength: number) => sampledGeometry(Array.from({ length: 65 }, (_, index) => {
  const t = index / 64;
  return V(length * t, -length * (.08 + strength * .1) * Math.sin(Math.PI * t), 0);
}));
const makeRunGeometry = (feature: TrackFeaturePlan) => {
  const length = featureLength(feature) * 1.35;
  const motifCode = [...feature.motif].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const cycles = 1 + motifCode % 3;
  const amplitude = length * (.025 + feature.scale * .045);
  const lateral = length * .04 * ((motifCode % 5) / 4);
  const arrangementDetail = Math.min(1, feature.sourceEvidence.arrangementChangeIds.length / 5);
  return sampledGeometry(Array.from({ length: 97 }, (_, index) => {
    const t = index / 96;
    const envelope = Math.sin(Math.PI * t) ** 2;
    return V(length * t, Math.sin(t * Math.PI * 2 * cycles) * amplitude * envelope,
      Math.sin(t * Math.PI * 2) * lateral * envelope * arrangementDetail);
  }));
};
const localGeometry = (feature: TrackFeaturePlan): SegmentGeometry => {
  const target = featureLength(feature);
  switch (feature.type) {
    case 'station': return lineGeometry(target * 1.05);
    case 'lift': return scaleGeometry(makeLiftGeometry(), target / 390 * (.8 + feature.strength * .25));
    case 'crest': return makeCrestGeometry(target * .8, feature.strength);
    case 'drop': return scaleGeometry(makeDropGeometry(), target / 470 * (.82 + feature.strength * .28));
    case 'run': return makeRunGeometry(feature);
    case 'loop': return scaleGeometry(makeLoopGeometry(), Math.max(.72, target / 300));
    case 'runout': return scaleGeometry(makeRunoutGeometry(), target / 520 * 1.25);
  }
};

function composeRaw(plan: TrackPlan): Route {
  const pieces: RoutePiece[] = [];
  const segments: SegmentDefinition[] = [];
  let length = 0;
  let exit: TrackFrame = { position: V(), forward: V(1, 0, 0), up: V(0, -1, 0) };
  const append = (geometry: SegmentGeometry, rest: Omit<RoutePiece, 'start' | 'geometry'>) => {
    pieces.push({ start: length, geometry, ...rest });
    length += geometry.length;
    exit = frameAt(geometry, geometry.length);
  };
  plan.features.forEach((feature, index) => {
    const geometry = placeGeometry(localGeometry(feature), exit);
    const kind = kindFor(feature.type);
    const segment: SegmentDefinition = { featureId: feature.id, kind, geometry, entryFrame: frameAt(geometry, 0),
      exitFrame: frameAt(geometry, geometry.length), physics: rollerCoasterSegmentPhysics(kind) };
    segments.push(segment);
    append(geometry, { segment });
    if (index < plan.features.length - 1) append(connectorGeometry(exit, 45 + feature.scale * 35), {
      connector: { hidden: true, nextSegment: kindFor(plan.features[index + 1].type) },
    });
  });
  return { pieces, segments, length };
}

const projectedY = (point: Vec3) => point.y - point.z * .18;
const routePoints = (route: Route, perPiece = 25) => route.pieces.flatMap(piece => Array.from({ length: perPiece }, (_, index) =>
  piece.geometry.samplePosition(piece.geometry.length * index / (perPiece - 1))));
const calculateBounds = (points: readonly Vec3[]): TrackMapBounds => ({
  minX: Math.min(...points.map(point => point.x)), maxX: Math.max(...points.map(point => point.x)),
  minY: Math.min(...points.map(point => point.y)), maxY: Math.max(...points.map(point => point.y)),
  minZ: Math.min(...points.map(point => point.z)), maxZ: Math.max(...points.map(point => point.z)),
});
const transformGeometry = (geometry: SegmentGeometry, scale: number, offset: Vec3): SegmentGeometry => ({
  length: geometry.length * scale,
  samplePosition: distance => {
    const point = geometry.samplePosition(distance / scale);
    return V(point.x * scale + offset.x, point.y * scale + offset.y, point.z * scale + offset.z);
  },
  sampleTangent: distance => geometry.sampleTangent(distance / scale),
  sampleUp: distance => geometry.sampleUp(distance / scale),
});

function normalizeRoute(raw: Route) {
  const samples = routePoints(raw, 33);
  const minX = Math.min(...samples.map(point => point.x));
  const maxX = Math.max(...samples.map(point => point.x));
  const minP = Math.min(...samples.map(projectedY));
  const maxP = Math.max(...samples.map(projectedY));
  const minZ = Math.min(...samples.map(point => point.z));
  const maxZ = Math.max(...samples.map(point => point.z));
  const scale = Math.min(
    (TRACK_LOCAL_BOUNDS.maxX - TRACK_LOCAL_BOUNDS.minX) / Math.max(1, maxX - minX),
    (TRACK_LOCAL_BOUNDS.maxY - TRACK_LOCAL_BOUNDS.minY) / Math.max(1, maxP - minP),
    (TRACK_LOCAL_BOUNDS.maxZ - TRACK_LOCAL_BOUNDS.minZ) / Math.max(1, maxZ - minZ),
  );
  const offset = V(-minX * scale, -(minP + maxP) * .5 * scale, -(minZ + maxZ) * .5 * scale);
  const pieces: RoutePiece[] = [];
  const segments: SegmentDefinition[] = [];
  let length = 0;
  raw.pieces.forEach(piece => {
    const geometry = transformGeometry(piece.geometry, scale, offset);
    if (piece.segment) {
      const segment: SegmentDefinition = { ...piece.segment, geometry, entryFrame: frameAt(geometry, 0), exitFrame: frameAt(geometry, geometry.length) };
      segments.push(segment);
      pieces.push({ start: length, geometry, segment });
    } else pieces.push({ start: length, geometry, connector: piece.connector });
    length += geometry.length;
  });
  return { route: { pieces, segments, length } satisfies Route, scale };
}

const hashTrack = (plan: TrackPlan, points: readonly Vec3[]) => {
  const input = `${plan.id}|${points.map(point => `${point.x.toFixed(3)},${point.y.toFixed(3)},${point.z.toFixed(3)}`).join('|')}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
};

export function validateTrackMap(track: Pick<TrackMap, 'route' | 'points' | 'bounds'>) {
  if (!(track.route.length > 0) || !track.route.pieces.length) return false;
  if (!track.points.every(point => Object.values(point).every(Number.isFinite))) return false;
  if (track.bounds.minX < TRACK_LOCAL_BOUNDS.minX - 1e-5 || track.bounds.maxX > TRACK_LOCAL_BOUNDS.maxX + 1e-5
    || track.bounds.minY < TRACK_LOCAL_BOUNDS.minY - 1e-5 || track.bounds.maxY > TRACK_LOCAL_BOUNDS.maxY + 1e-5
    || track.bounds.minZ < TRACK_LOCAL_BOUNDS.minZ - 1e-5 || track.bounds.maxZ > TRACK_LOCAL_BOUNDS.maxZ + 1e-5) return false;
  for (let index = 0; index < track.route.pieces.length - 1; index += 1) {
    const current = track.route.pieces[index];
    const next = track.route.pieces[index + 1];
    const a = current.geometry.samplePosition(current.geometry.length);
    const b = next.geometry.samplePosition(0);
    if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > 1e-4) return false;
  }
  return true;
}

export function generateTrackMap(plan: TrackPlan): TrackMap {
  const started = performance.now();
  const { route, scale } = normalizeRoute(composeRaw(plan));
  const points = routePoints(route, 17);
  const bounds = calculateBounds(points);
  const segments = route.segments.map(segment => {
    const piece = route.pieces.find(item => item.segment === segment)!;
    const feature = plan.features.find(item => item.id === segment.featureId)!;
    return { featureId: feature.id, type: feature.type, startDistance: piece.start,
      endDistance: piece.start + piece.geometry.length, sourceEvidence: feature.sourceEvidence };
  });
  const draft = { version: TRACK_MAP_VERSION, id: `track-map-${hashTrack(plan, points)}`, planId: plan.id, route, points, segments,
    totalLength: route.length, bounds, normalizationScale: scale, valid: true, fallbackUsed: plan.fallbackUsed,
    generationMs: performance.now() - started, error: plan.error } satisfies TrackMap;
  return { ...draft, valid: validateTrackMap(draft) };
}

export function createRollerCoasterTrack(map: AudioMap, planner: (map: AudioMap) => TrackPlan): { plan: TrackPlan; map: TrackMap } {
  try {
    const plan = planner(map);
    const track = generateTrackMap(plan);
    if (!track.valid) throw new Error('generated geometry failed validation');
    return { plan, map: track };
  } catch (error) {
    const plan = createSafeTrackPlan(map, `generation error: ${error instanceof Error ? error.message : String(error)}`);
    return { plan, map: generateTrackMap(plan) };
  }
}

export const sampleTrackMap = (track: TrackMap, distance: number) => sampleRoute(track.route, distance);
