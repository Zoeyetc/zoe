import type { PhysicsWake, WorldPoint } from '../types.ts';
import { ROLLER_MAX_ACCELERATION, ROLLER_MAX_VELOCITY, type RollerCoasterState } from '../../rides/roller-coaster/simulation.ts';
import { rollerCoasterRoute } from '../../rides/roller-coaster/route.ts';

export const ROLLER_WAKE_SOURCE_ID = 'roller-coaster';
export const ROLLER_WAKE_SPEED_THRESHOLD = 18;
export const ROLLER_WAKE_MAX_STRENGTH = 0.9;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const projectedY = (point: { y: number; z: number }) => point.y - point.z * 0.18;
const routeSamples = rollerCoasterRoute.pieces.flatMap(piece => Array.from({ length: 33 }, (_, index) =>
  piece.geometry.samplePosition(piece.geometry.length * index / 32)));
const bounds = {
  minX: Math.min(...routeSamples.map(point => point.x)),
  maxX: Math.max(...routeSamples.map(point => point.x)),
  minY: Math.min(...routeSamples.map(projectedY)),
  maxY: Math.max(...routeSamples.map(projectedY)),
};
export type RollerCoasterWorldBounds = Readonly<{ x: number; y: number; width: number; height: number }>;
export const DEFAULT_ROLLER_COASTER_WORLD_BOUNDS: RollerCoasterWorldBounds = {
  x: 0.08, y: 0.12, width: 0.84, height: 0.76,
};

export function rollerCoasterRoutePointToWorld(
  point: { x: number; y: number; z: number },
  worldBounds: RollerCoasterWorldBounds = DEFAULT_ROLLER_COASTER_WORLD_BOUNDS,
): WorldPoint {
  return {
    x: worldBounds.x + clamp01((point.x - bounds.minX) / Math.max(1, bounds.maxX - bounds.minX)) * worldBounds.width,
    y: worldBounds.y + clamp01((projectedY(point) - bounds.minY) / Math.max(1, bounds.maxY - bounds.minY)) * worldBounds.height,
  };
}

export function rollerCoasterRouteForwardToWorld(
  forward: { x: number; y: number; z: number },
  worldBounds: RollerCoasterWorldBounds = DEFAULT_ROLLER_COASTER_WORLD_BOUNDS,
): WorldPoint {
  const x = forward.x * worldBounds.width / Math.max(1, bounds.maxX - bounds.minX);
  const y = (forward.y - forward.z * 0.18) * worldBounds.height / Math.max(1, bounds.maxY - bounds.minY);
  const length = Math.hypot(x, y);
  return length > 1e-9 ? { x: x / length, y: y / length } : { x: 1, y: 0 };
}

/** Explicit canonical-route XYZ → PhysicsWorld normalized-2D conversion. */
export function rollerCoasterToPhysicsWake(
  state: RollerCoasterState,
  timestamp: number,
  worldBounds: RollerCoasterWorldBounds = DEFAULT_ROLLER_COASTER_WORLD_BOUNDS,
): PhysicsWake {
  const speedProgress = clamp01(
    (state.velocity - ROLLER_WAKE_SPEED_THRESHOLD) / (ROLLER_MAX_VELOCITY - ROLLER_WAKE_SPEED_THRESHOLD),
  );
  const accelerationContribution = clamp01(Math.abs(state.acceleration) / ROLLER_MAX_ACCELERATION) * 0.1;
  const strength = Math.min(ROLLER_WAKE_MAX_STRENGTH, speedProgress * 0.8 + accelerationContribution);
  return {
    sourceId: ROLLER_WAKE_SOURCE_ID,
    sourceType: 'wake',
    position: rollerCoasterRoutePointToWorld(state.riderPosition, worldBounds),
    forward: rollerCoasterRouteForwardToWorld(state.riderForward, worldBounds),
    speed: state.velocity,
    acceleration: state.acceleration,
    strength,
    radius: 0.2 + speedProgress * 0.18,
    timestamp,
    active: state.velocity >= ROLLER_WAKE_SPEED_THRESHOLD && strength > 0,
  };
}
