import type { ExperienceState } from '../createExperience';
import type { AttentionActorId } from '../attention';
import { bumperArenaPointToWorld } from '../../physics/adapters/bumperCars.ts';
import { rollerCoasterRoutePointToWorld } from '../../physics/adapters/rollerCoaster.ts';
import { PARK_ACTOR_ANCHORS, PARK_BUMPER_CARS_BOUNDS, PARK_ROLLER_COASTER_BOUNDS } from '../park/config.ts';
import type { AnnotationBounds, AnnotationPoint } from './annotationTypes.ts';

const TAU = Math.PI * 2;
const pointInActor = (actorId: keyof typeof PARK_ACTOR_ANCHORS, localX: number, localY: number): AnnotationPoint => {
  const bounds = PARK_ACTOR_ANCHORS[actorId];
  return { x: bounds.x + bounds.width * localX, y: bounds.y + bounds.height * localY };
};

function carouselAnchor(state: ExperienceState['carousel']) {
  if (state.activeRider === null) return pointInActor('carousel', .5, .55);
  const rider = state.riders[state.activeRider];
  const theta = state.baseAngle + rider.index / state.riders.length * TAU;
  const x = 280 + Math.cos(theta) * 176;
  const platformY = 250 + Math.sin(theta) * 36;
  const y = platformY - 38 - rider.position * 54;
  return pointInActor('carousel', x / 560, y / 330);
}

function bumperAnchor(state: ExperienceState['bumperCars']) {
  const selected = state.selectedBody === null ? null : state.bodies.find(body => body.id === state.selectedBody);
  return selected
    ? bumperArenaPointToWorld(selected, state.arena, PARK_BUMPER_CARS_BOUNDS)
    : { x: PARK_BUMPER_CARS_BOUNDS.x + PARK_BUMPER_CARS_BOUNDS.width / 2,
      y: PARK_BUMPER_CARS_BOUNDS.y + PARK_BUMPER_CARS_BOUNDS.height / 2 };
}

export function resolveAnnotationAnchors(state: ExperienceState): Readonly<Record<AttentionActorId, AnnotationPoint>> {
  return {
    carousel: carouselAnchor(state.carousel),
    ferrisWheel: pointInActor('ferrisWheel', .5, 210 / 470),
    pirateShip: pointInActor('pirateShip', .5, 46 / 300),
    bumperCars: bumperAnchor(state.bumperCars),
    dropTower: pointInActor('dropTower', .5, (54 + (382 - 54) * state.dropTower.position) / 450),
    rollerCoaster: rollerCoasterRoutePointToWorld(
      state.rollerCoaster.riderPosition, state.rollerCoasterTrackMap, PARK_ROLLER_COASTER_BOUNDS,
    ),
  };
}

export function annotationSafeZones(anchors: Readonly<Record<AttentionActorId, AnnotationPoint>>) {
  return Object.fromEntries(Object.entries(anchors).map(([id, point]) => [id, {
    x: point.x - .035, y: point.y - .045, width: .07, height: .09,
  }])) as Readonly<Record<AttentionActorId, AnnotationBounds>>;
}
