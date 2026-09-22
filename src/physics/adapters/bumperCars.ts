import type { BumperArena, BumperCollision } from '../../rides/bumper-cars/simulation';
import type { PhysicsImpact } from '../types';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Explicit actor-space → normalized world-space adapter. No DOM measurement participates. */
export function bumperCollisionToWorldImpact(collision: BumperCollision, arena: BumperArena): PhysicsImpact {
  return {
    id: collision.id,
    sourceId: 'bumper-cars',
    sourceType: 'collision',
    position: { x: clamp01(collision.point.x / arena.width), y: clamp01(collision.point.y / arena.height) },
    direction: collision.normal,
    strength: clamp01(collision.impulse / 100),
    radius: 0.42,
    timestamp: collision.time,
  };
}
