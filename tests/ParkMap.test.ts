import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { physicsDebugVisible, resolveExperienceMode } from '../src/experience/mode.ts';
import {
  PARK_ACTOR_ANCHORS, PARK_BUMPER_CARS_BOUNDS, PARK_CONTENT_BOUNDS,
  PARK_DISTRICT_CONTOURS, PARK_DROP_TOWER_RENDERER, PARK_FOCUS_BOUNDS,
  PARK_OVERVIEW_VIEWPORT, PARK_PIRATE_SHIP_RENDERER, focusViewport,
  PARK_ROLLER_COASTER_BOUNDS, PARK_SEMANTIC_SCALES,
  PARK_SPATIAL_CATEGORIES, PARK_TRAIN_ROUTE,
  PARK_TRAIN_BOUNDS, PARK_TRAIN_STATIONS, PARK_VIEWBOX, worldToPark,
} from '../src/experience/park/config.ts';
import { bumperArenaPointToWorld } from '../src/physics/adapters/bumperCars.ts';

const parkSource = readFileSync(new URL('../src/experience/park/ParkMap.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../src/experience/App.tsx', import.meta.url), 'utf8');
const experienceSource = readFileSync(new URL('../src/experience/createExperience.ts', import.meta.url), 'utf8');
const trainSource = readFileSync(new URL('../src/experience/park/ParkTrain.tsx', import.meta.url), 'utf8');
const dropTowerViewSource = readFileSync(new URL('../src/rides/drop-tower/DropTowerView.tsx', import.meta.url), 'utf8');
const pirateShipViewSource = readFileSync(new URL('../src/rides/pirate-ship/PirateShipView.tsx', import.meta.url), 'utf8');

test('Park Map defines explicit normalized actor anchors inside the canonical world', () => {
  assert.deepEqual(PARK_VIEWBOX, { width: 1000, height: 640 });
  for (const bounds of Object.values(PARK_ACTOR_ANCHORS)) {
    assert.ok(bounds.x >= 0 && bounds.y >= 0);
    assert.ok(bounds.x + bounds.width <= 1 && bounds.y + bounds.height <= 1);
  }
  assert.deepEqual(worldToPark({ x: 0.25, y: 0.75 }), { x: 250, y: 480 });
});

test('districts enlarge precise-evidence actors and bound BumperCars locally', () => {
  assert.ok(PARK_ACTOR_ANCHORS.carousel.width * PARK_ACTOR_ANCHORS.carousel.height > 0.24 * 0.32);
  assert.ok(PARK_ACTOR_ANCHORS.ferrisWheel.width * PARK_ACTOR_ANCHORS.ferrisWheel.height > 0.29 * 0.39);
  assert.ok(PARK_BUMPER_CARS_BOUNDS.x >= 0.5 && PARK_BUMPER_CARS_BOUNDS.y >= 0.5);
  assert.ok(PARK_BUMPER_CARS_BOUNDS.width < 0.5 && PARK_BUMPER_CARS_BOUNDS.height < 0.5);
  assert.equal(Object.keys(PARK_DISTRICT_CONTOURS).length, 6);
});

test('semantic scale preserves FerrisWheel and Carousel while rebalancing landmarks', () => {
  const area = (bounds: { width: number; height: number }) => bounds.width * bounds.height;
  assert.ok(area(PARK_ACTOR_ANCHORS.ferrisWheel) > 0.3 * 0.44 * 1.5);
  assert.equal(PARK_ACTOR_ANCHORS.ferrisWheel.width, 0.41);
  assert.equal(PARK_ACTOR_ANCHORS.ferrisWheel.height, 0.56);
  assert.ok(PARK_ACTOR_ANCHORS.dropTower.height >= 0.72 * 0.7);
  assert.ok(PARK_ACTOR_ANCHORS.dropTower.height <= 0.72 * 0.8);
  assert.ok(area(PARK_ACTOR_ANCHORS.carousel) >= 0.35 * 0.38 * 0.9);
  assert.ok(area(PARK_ACTOR_ANCHORS.carousel) <= 0.35 * 0.38 * 1.1);
  assert.equal(PARK_ACTOR_ANCHORS.carousel.width, 0.32);
  assert.equal(PARK_ACTOR_ANCHORS.carousel.height, 0.42);
  assert.equal(PARK_SEMANTIC_SCALES.ferrisWheel, 'large');
  assert.equal(PARK_SEMANTIC_SCALES.dropTower, 'medium-tall');
  assert.equal(PARK_SEMANTIC_SCALES.bumperCars, 'compact');
});

test('RollerCoaster grows and shifts left while keeping an explicit shared transform', () => {
  assert.ok(PARK_ROLLER_COASTER_BOUNDS.x < 0.2);
  assert.ok(PARK_ROLLER_COASTER_BOUNDS.width >= 0.43);
  assert.ok(PARK_ROLLER_COASTER_BOUNDS.width <= 0.48);
  assert.ok(Math.abs(PARK_ROLLER_COASTER_BOUNDS.x + PARK_ROLLER_COASTER_BOUNDS.width - 0.55) < 1e-9);
});

test('composition config separates actors, atmosphere, and infrastructure', () => {
  assert.ok(PARK_SPATIAL_CATEGORIES.musicalActors.includes('rollerCoaster'));
  assert.ok(PARK_SPATIAL_CATEGORIES.globalAtmosphere.includes('freeBodies'));
  assert.ok(PARK_SPATIAL_CATEGORIES.experienceInfrastructure.includes('parkTrain'));
  assert.match(parkSource, /data-spatial-role="musical-actor"/);
  assert.match(parkSource, /data-spatial-role="global-atmosphere"/);
});

test('Park Train is static experience infrastructure without musical or physical ownership', () => {
  assert.ok(PARK_TRAIN_ROUTE.length > 0);
  assert.equal(PARK_TRAIN_STATIONS.length, 4);
  assert.match(trainSource, /data-park-infrastructure="train"/);
  assert.doesNotMatch(trainSource, /\b(AudioWorld|AudioClock|snapshot|events|melody|harmony|groove|percussion|structure|phrase|spectrum)\b/i);
  assert.doesNotMatch(trainSource, /PhysicsWorld|registerSource|registerReceiver|state\./);
});

test('Park Train replaces the old land boundary and expands toward the map perimeter', () => {
  assert.doesNotMatch(parkSource, /className="park-land"/);
  assert.match(parkSource, /<ParkTrain \/>/);
  assert.ok(PARK_TRAIN_BOUNDS.x <= 0.01 && PARK_TRAIN_BOUNDS.y === 0);
  assert.ok(PARK_TRAIN_BOUNDS.x + PARK_TRAIN_BOUNDS.width >= 0.99);
  assert.ok(PARK_TRAIN_BOUNDS.y + PARK_TRAIN_BOUNDS.height >= 0.98);
  for (const bounds of Object.values(PARK_ACTOR_ANCHORS)) {
    assert.ok(bounds.x >= PARK_TRAIN_BOUNDS.x);
    assert.ok(bounds.y >= PARK_TRAIN_BOUNDS.y);
    assert.ok(bounds.x + bounds.width <= PARK_TRAIN_BOUNDS.x + PARK_TRAIN_BOUNDS.width);
    assert.ok(bounds.y + bounds.height <= PARK_TRAIN_BOUNDS.y + PARK_TRAIN_BOUNDS.height);
  }
});

test('Park-only DropTower fit expands local mechanical travel without changing state', () => {
  assert.equal(PARK_DROP_TOWER_RENDERER.fit, 'district-height');
  assert.match(parkSource, /<DropTowerView state=\{state\.dropTower\}/);
  assert.match(parkSource, /districtFit=\{PARK_DROP_TOWER_RENDERER\.fit === 'district-height'\}/);
  assert.match(dropTowerViewSource, /preserveAspectRatio=\{districtFit \? 'none' : 'xMidYMid meet'\}/);
  const localTravel = PARK_DROP_TOWER_RENDERER.localTravelBottom - PARK_DROP_TOWER_RENDERER.localTravelTop;
  const districtTravel = localTravel / PARK_DROP_TOWER_RENDERER.localViewBoxHeight
    * PARK_ACTOR_ANCHORS.dropTower.height;
  const oldWidthLimitedTravel = localTravel / 560 * PARK_ACTOR_ANCHORS.dropTower.width
    * PARK_VIEWBOX.width / PARK_VIEWBOX.height;
  assert.ok(districtTravel > oldWidthLimitedTravel * 2.3);
  assert.ok(PARK_ACTOR_ANCHORS.dropTower.height < 0.72);
});

test('Park-only PirateShip fit enlarges mechanics inside the unchanged district', () => {
  assert.equal(PARK_ACTOR_ANCHORS.pirateShip.x, 0.58);
  assert.equal(PARK_ACTOR_ANCHORS.pirateShip.y, 0.65);
  assert.equal(PARK_ACTOR_ANCHORS.pirateShip.width, 0.2);
  assert.equal(PARK_ACTOR_ANCHORS.pirateShip.height, 0.25);
  assert.equal(PARK_PIRATE_SHIP_RENDERER.fit, 'district-height');
  assert.match(parkSource, /<PirateShipView state=\{state\.pirateShip\}/);
  assert.match(parkSource, /districtFit=\{PARK_PIRATE_SHIP_RENDERER\.fit === 'district-height'\}/);
  assert.match(pirateShipViewSource, /preserveAspectRatio=\{districtFit \? 'none' : 'xMidYMid meet'\}/);
  const fittedHeight = PARK_ACTOR_ANCHORS.pirateShip.height * PARK_VIEWBOX.height;
  const oldHeight = PARK_ACTOR_ANCHORS.pirateShip.width * PARK_VIEWBOX.width
    / 560 * PARK_PIRATE_SHIP_RENDERER.localViewBoxHeight;
  assert.ok(fittedHeight / oldHeight >= 1.35);
  assert.ok(fittedHeight / oldHeight <= 1.5);
});

test('BumperCars rendering and PhysicsWorld publication share one local-world transform', () => {
  const world = bumperArenaPointToWorld(
    { x: 280, y: 140 },
    { width: 560, height: 280 },
    PARK_BUMPER_CARS_BOUNDS,
  );
  assert.deepEqual(world, {
    x: PARK_BUMPER_CARS_BOUNDS.x + PARK_BUMPER_CARS_BOUNDS.width / 2,
    y: PARK_BUMPER_CARS_BOUNDS.y + PARK_BUMPER_CARS_BOUNDS.height / 2,
  });
  assert.match(parkSource, /bumperArenaPointToWorld\(body, state\.arena, PARK_BUMPER_CARS_BOUNDS\)/);
  assert.match(experienceSource, /bumperCollisionToWorldImpact\([\s\S]*PARK_BUMPER_CARS_BOUNDS/);
});

test('Park Map composes canonical state without creating duplicate simulations', () => {
  assert.doesNotMatch(parkSource, /create[A-Z][A-Za-z]+Simulation/);
  assert.doesNotMatch(parkSource, /createExperience\(/);
  assert.equal((appSource.match(/createExperience\(/g) ?? []).length, 1);
  assert.match(appSource, /mode === 'park'/);
  assert.match(appSource, /: workbench/);
});

test('Park Map contains each required live actor renderer or canonical layer', () => {
  for (const actor of ['carousel', 'ferris-wheel', 'pirate-ship', 'bumper-cars', 'drop-tower', 'roller-coaster', 'free-bodies']) {
    assert.match(parkSource, new RegExp(actor));
  }
  assert.match(parkSource, /data-park-landmark="gate"/);
  assert.match(parkSource, /<CarouselView state=\{state\.carousel\}/);
  assert.match(parkSource, /<FerrisWheelView state=\{state\.ferrisWheel\}/);
});

test('canonical physical participants use their existing world-space truth', () => {
  assert.match(parkSource, /rollerCoasterRoutePointToWorld/);
  assert.match(parkSource, /rollerCoasterRouteForwardToWorld/);
  assert.match(parkSource, /bumperArenaPointToWorld/);
  assert.match(parkSource, /worldToPark\(body\.position\)/);
  assert.match(parkSource, /<AnchoredContentView state=\{state\.content\}/);
  assert.match(parkSource, /<PhysicsDebugOverlay/);
});

test('Park Map synchronizes the authored content anchor with its physical participant', () => {
  assert.match(appSource, /updateContentLayout\(PARK_CONTENT_BOUNDS\)/);
  assert.ok(PARK_CONTENT_BOUNDS.x >= 0 && PARK_CONTENT_BOUNDS.x + PARK_CONTENT_BOUNDS.width <= 1);
  assert.ok(PARK_CONTENT_BOUNDS.y >= 0 && PARK_CONTENT_BOUNDS.y + PARK_CONTENT_BOUNDS.height <= 1);
});

test('RollerCoaster infrastructure is derived from canonical route samples', () => {
  assert.match(parkSource, /rollerCoasterRoute\.pieces/);
  assert.match(parkSource, /park-track-bed/);
  assert.match(parkSource, /park-track-rail/);
  assert.match(parkSource, /park-track-tie/);
  assert.doesNotMatch(parkSource, /fake|decorative track/i);
});

test('RollerCoaster render and wake use the same dedicated district transform', () => {
  assert.ok(PARK_ROLLER_COASTER_BOUNDS.width < 0.5);
  assert.ok(PARK_ROLLER_COASTER_BOUNDS.height < 0.5);
  assert.match(parkSource, /rollerCoasterRoutePointToWorld\([\s\S]*PARK_ROLLER_COASTER_BOUNDS/);
  assert.match(parkSource, /rollerCoasterRouteForwardToWorld\([\s\S]*PARK_ROLLER_COASTER_BOUNDS/);
  assert.match(experienceSource, /rollerCoasterToPhysicsWake\([\s\S]*PARK_ROLLER_COASTER_BOUNDS/);
  assert.match(parkSource, />Crest<\/text>/);
});

test('composition does not own AudioClock or actor simulation behavior', () => {
  assert.doesNotMatch(parkSource, /AudioClock|AudioWorld|\.accept\(|\.step\(|requestAnimationFrame/);
  assert.match(parkSource, /state\.carousel/);
  assert.match(parkSource, /state\.ferrisWheel/);
  assert.match(parkSource, /state\.rollerCoaster/);
  assert.match(parkSource, /state\.freeBodies/);
});

test('Park mode, workbench mode, and physics debug flag remain independently addressable', () => {
  assert.equal(resolveExperienceMode(''), 'park');
  assert.equal(resolveExperienceMode('?mode=workbench'), 'workbench');
  assert.equal(resolveExperienceMode('?mode=workbench&hide-physics-debug'), 'workbench');
  assert.equal(physicsDebugVisible('?mode=workbench'), true);
  assert.equal(physicsDebugVisible('?hide-physics-debug'), false);
});

test('Park attention uses one presentation viewport and six semantic focus controls', () => {
  assert.equal(Object.keys(PARK_FOCUS_BOUNDS).length, 6);
  assert.deepEqual(PARK_OVERVIEW_VIEWPORT, { scale: 1, x: 0, y: 0 });
  assert.ok(focusViewport(PARK_FOCUS_BOUNDS.carousel).scale > 1);
  assert.match(parkSource, /className="park-viewport"/);
  assert.match(parkSource, /data-focus-trigger=/);
  assert.match(parkSource, /aria-label=\{`Focus/);
  assert.match(parkSource, /event\.key === 'Escape'/);
  assert.doesNotMatch(parkSource, /create[A-Z][A-Za-z]+Simulation/);
});
