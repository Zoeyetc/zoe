import type { BumperArena, BumperCollision } from '../../rides/bumper-cars/simulation';
import type { PhysicsImpact, WorldPoint } from '../types';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export type BumperCarsWorldBounds = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

const FULL_WORLD: BumperCarsWorldBounds = { x: 0, y: 0, width: 1, height: 1 };

/** Shared actor-local arena → Park / PhysicsWorld transform. */
export function bumperArenaPointToWorld(
  point: WorldPoint,
  arena: BumperArena,
  bounds: BumperCarsWorldBounds = FULL_WORLD,
): WorldPoint {
  return {
    x: bounds.x + clamp01(point.x / arena.width) * bounds.width,
    y: bounds.y + clamp01(point.y / arena.height) * bounds.height,
  };
}

function bumperArenaDirectionToWorld(
  direction: WorldPoint,
  arena: BumperArena,
  bounds: BumperCarsWorldBounds,
): WorldPoint {
  const x = direction.x * bounds.width / arena.width;
  const y = direction.y * bounds.height / arena.height;
  const length = Math.hypot(x, y);
  return length > 1e-9 ? { x: x / length, y: y / length } : { x: 1, y: 0 };
}

/** Explicit actor-space → normalized world-space adapter. No DOM measurement participates. */
export function bumperCollisionToWorldImpact(
  collision: BumperCollision,
  arena: BumperArena,
  bounds: BumperCarsWorldBounds = FULL_WORLD,
): PhysicsImpact {
  return {
    id: collision.id,
    sourceId: 'bumper-cars',
    sourceType: 'collision',
    position: bumperArenaPointToWorld(collision.point, arena, bounds),
    direction: bumperArenaDirectionToWorld(collision.normal, arena, bounds),
    strength: clamp01(collision.impulse / 100),
    // Influence remains a shared-world material property; zoning changes only source placement.
    radius: 0.42,
    timestamp: collision.time,
  };
}
