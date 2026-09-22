import { connectorGeometry, frameAt, lineGeometry, makeDropGeometry, makeLiftGeometry, makeLoopGeometry, makeRunoutGeometry, placeGeometry, V } from './geometry.ts';
import type { Route, RoutePiece, SegmentDefinition, SegmentGeometry, SegmentKind, TrackFrame } from './types';

export const ROLLER_ROUTE_SEGMENTS: readonly SegmentKind[] = ['Station', 'Lift', 'Drop', 'Loop', 'Runout', 'Station'];

function physics(kind: SegmentKind) {
  switch (kind) {
    case 'Station': return { gravityScale: 0, drag: 5, driveForce: 85, brakeForce: 150 };
    case 'Lift': return { gravityScale: 35, drag: 2.8, driveForce: 72, brakeForce: 110 };
    case 'Drop': return { gravityScale: 250, drag: 2.1, driveForce: 42, brakeForce: 120 };
    case 'Loop': return { gravityScale: 210, drag: 2.4, driveForce: 46, brakeForce: 120 };
    case 'Runout': return { gravityScale: 130, drag: 3.8, driveForce: 58, brakeForce: 130 };
  }
}

/** Extracted open-route composition. Every authored segment begins and exits on a +X tangent. */
export function composeRollerCoasterRoute(): Route {
  const pieces: RoutePiece[] = [];
  const segments: SegmentDefinition[] = [];
  let length = 0;
  let exit: TrackFrame = { position: V(), forward: V(1, 0, 0), up: V(0, -1, 0) };
  const append = (geometry: SegmentGeometry, rest: Omit<RoutePiece, 'start' | 'geometry'>) => {
    pieces.push({ start: length, geometry, ...rest });
    length += geometry.length;
    exit = frameAt(geometry, geometry.length);
  };
  const localFor = (kind: SegmentKind, index: number) => {
    if (kind === 'Station') return lineGeometry(index === 0 ? 230 : 280);
    if (kind === 'Lift') return makeLiftGeometry();
    if (kind === 'Drop') return makeDropGeometry();
    if (kind === 'Loop') return makeLoopGeometry();
    return makeRunoutGeometry();
  };
  ROLLER_ROUTE_SEGMENTS.forEach((kind, index) => {
    const geometry = placeGeometry(localFor(kind, index), exit);
    const segment: SegmentDefinition = {
      kind,
      geometry,
      entryFrame: frameAt(geometry, 0),
      exitFrame: frameAt(geometry, geometry.length),
      physics: physics(kind),
    };
    segments.push(segment);
    append(geometry, { segment });
    const next = ROLLER_ROUTE_SEGMENTS[index + 1];
    if (next) {
      const connector = connectorGeometry(exit);
      append(connector, { connector: { hidden: true, nextSegment: next } });
    }
  });
  return { pieces, segments, length };
}

export const rollerCoasterRoute = composeRollerCoasterRoute();

export function pieceIndexAt(route: Route, distance: number) {
  let low = 0;
  let high = route.pieces.length;
  while (low + 1 < high) {
    const middle = (low + high) >> 1;
    if (route.pieces[middle].start <= distance) low = middle;
    else high = middle;
  }
  return low;
}

export function sampleRoute(route: Route, distance: number): TrackFrame {
  if (!route.pieces.length) return { position: V(), forward: V(1, 0, 0), up: V(0, -1, 0) };
  const clamped = Math.max(0, Math.min(route.length, distance));
  const piece = route.pieces[pieceIndexAt(route, clamped)];
  return frameAt(piece.geometry, clamped - piece.start);
}
