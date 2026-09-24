import type { WorldPoint } from '../../physics/types';
import type { AttentionActorId } from '../attention';

export type ParkBounds = Readonly<{ x: number; y: number; width: number; height: number }>;

export const PARK_VIEWBOX = { width: 1000, height: 640 } as const;

/** Semantic scale follows evidence density and mechanical travel, not literal ride size. */
export const PARK_ACTOR_ANCHORS = {
  carousel: { x: 0.22, y: 0.1, width: 0.32, height: 0.42 },
  ferrisWheel: { x: 0.56, y: 0.04, width: 0.41, height: 0.56 },
  pirateShip: { x: 0.58, y: 0.65, width: 0.2, height: 0.25 },
  dropTower: { x: 0.035, y: 0.07, width: 0.18, height: 0.54 },
  bumperCars: { x: 0.79, y: 0.68, width: 0.18, height: 0.2 },
  rollerCoaster: { x: 0.08, y: 0.61, width: 0.47, height: 0.31 },
} satisfies Record<string, ParkBounds>;

export const PARK_SEMANTIC_SCALES = {
  carousel: 'medium-large',
  ferrisWheel: 'large',
  pirateShip: 'medium-large',
  dropTower: 'medium-tall',
  bumperCars: 'compact',
  rollerCoaster: 'landmark-large',
  parkTrain: 'infrastructure-thin',
} as const;

export const PARK_SPATIAL_CATEGORIES = {
  musicalActors: ['carousel', 'ferrisWheel', 'pirateShip', 'dropTower', 'bumperCars', 'rollerCoaster'],
  globalAtmosphere: ['freeBodies', 'sharedOpenSpace'],
  experienceInfrastructure: ['gate', 'parkTrain', 'paths'],
} as const;

export const PARK_BUMPER_CARS_BOUNDS = PARK_ACTOR_ANCHORS.bumperCars;
export const PARK_ROLLER_COASTER_BOUNDS = PARK_ACTOR_ANCHORS.rollerCoaster;
export const PARK_CONTENT_BOUNDS: ParkBounds = { x: 0.69, y: 0.595, width: 0.105, height: 0.064 };
export const PARK_GATE_BOUNDS: ParkBounds = { x: 0.43, y: 0.92, width: 0.14, height: 0.042 };
export const PARK_FREE_BODY_PRESENTATION = {
  opacity: 0.34,
  selectedOpacity: 0.46,
  quietOpacity: 0.12,
  maximumRadius: 8,
} as const;
export const PARK_DROP_TOWER_RENDERER = {
  fit: 'district-height',
  localViewBoxHeight: 450,
  localTravelTop: 54,
  localTravelBottom: 382,
} as const;
export const PARK_PIRATE_SHIP_RENDERER = {
  fit: 'district-height',
  localViewBoxHeight: 300,
} as const;

/** Presentation-only framing. Canonical actor and PhysicsWorld coordinates never use these bounds. */
export const PARK_FOCUS_BOUNDS = {
  carousel: { x: 0.19, y: 0.055, width: 0.38, height: 0.5 },
  ferrisWheel: { x: 0.52, y: 0.01, width: 0.46, height: 0.61 },
  pirateShip: { x: 0.54, y: 0.59, width: 0.28, height: 0.34 },
  bumperCars: { x: 0.75, y: 0.63, width: 0.24, height: 0.3 },
  dropTower: { x: 0.005, y: 0.025, width: 0.25, height: 0.63 },
  rollerCoaster: { x: 0.045, y: 0.55, width: 0.54, height: 0.4 },
} satisfies Record<AttentionActorId, ParkBounds>;

export type ParkViewportTransform = Readonly<{ scale: number; x: number; y: number }>;
export const PARK_OVERVIEW_VIEWPORT: ParkViewportTransform = { scale: 1, x: 0, y: 0 };

export function focusViewport(bounds: ParkBounds): ParkViewportTransform {
  const scale = Math.min(1.65, 0.74 / bounds.width, 0.74 / bounds.height);
  return {
    scale,
    x: 0.5 - scale * (bounds.x + bounds.width / 2),
    y: 0.5 - scale * (bounds.y + bounds.height / 2),
  };
}

/** Quiet, irregular local floor fields. Geometry is authored in the Park viewBox. */
export const PARK_DISTRICT_CONTOURS = {
  dropTower: 'M24 36 Q112 24 220 50 L222 394 Q120 410 24 382 Z',
  carousel: 'M198 44 Q372 28 556 66 L566 344 Q380 362 202 332 Z',
  ferrisWheel: 'M544 22 Q770 6 986 48 L982 394 Q770 408 546 378 Z',
  rollerCoaster: 'M62 374 Q310 356 566 390 L572 604 Q314 624 62 588 Z',
  pirateShip: 'M566 404 Q684 392 792 422 L790 584 Q676 596 566 570 Z',
  bumperCars: 'M778 424 Q886 412 982 438 L978 574 Q882 588 780 562 Z',
} as const;

/** Experience infrastructure only: no musical or PhysicsWorld ownership. */
export const PARK_TRAIN_BOUNDS: ParkBounds = { x: 0.01, y: 0, width: 0.985, height: 0.984 };
export const PARK_TRAIN_ROUTE = 'M500 622 C330 630 115 615 42 540 C10 480 12 180 40 90 C92 20 300 10 500 18 C700 0 910 16 970 92 C995 200 996 450 968 542 C900 615 690 628 500 622 Z';
export const PARK_TRAIN_STATIONS = [
  { id: 'gate', x: 0.5, y: 0.972 },
  { id: 'north', x: 0.5, y: 0.028 },
  { id: 'east', x: 0.982, y: 0.5 },
  { id: 'west', x: 0.022, y: 0.5 },
] as const;

export const PARK_PATHS = [
  'M500 604 C500 568 500 540 486 510',
  'M486 510 C420 484 356 478 294 500',
  'M486 510 C590 494 690 510 816 534',
] as const;

/** Renderer-only density masks; body positions remain canonical PhysicsWorld truth. */
export const PARK_FREE_BODY_QUIET_ZONES = [
  PARK_ACTOR_ANCHORS.carousel,
  PARK_ACTOR_ANCHORS.ferrisWheel,
  PARK_ACTOR_ANCHORS.dropTower,
] as const;

export function pointInBounds(point: WorldPoint, bounds: ParkBounds) {
  return point.x >= bounds.x && point.x <= bounds.x + bounds.width
    && point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

export function worldToPark(point: WorldPoint) {
  return { x: point.x * PARK_VIEWBOX.width, y: point.y * PARK_VIEWBOX.height };
}

export function boundsStyle(bounds: ParkBounds) {
  return {
    left: `${bounds.x * 100}%`, top: `${bounds.y * 100}%`,
    width: `${bounds.width * 100}%`, height: `${bounds.height * 100}%`,
  } as const;
}
