import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createDoodleCircle, createDoodlePath, createDoodlePolyline } from '../apps/zland/src/experience/doodle/geometry.ts';
import { PARK_ACTOR_ANCHORS, PARK_FOCUS_BOUNDS, PARK_DISTRICT_CONTOURS } from '../apps/zland/src/experience/park/config.ts';

const geometrySource = readFileSync(new URL('../apps/zland/src/experience/doodle/geometry.ts', import.meta.url), 'utf8');
const parkSource = readFileSync(new URL('../apps/zland/src/experience/park/ParkMap.tsx', import.meta.url), 'utf8');
const carouselSource = readFileSync(new URL('../apps/zland/src/rides/carousel/CarouselView.tsx', import.meta.url), 'utf8');
const ferrisSource = readFileSync(new URL('../apps/zland/src/rides/ferris-wheel/FerrisWheelView.tsx', import.meta.url), 'utf8');

test('doodle geometry is deterministic, seeded, and finite', () => {
  const points = [{ x: 0, y: 0 }, { x: 40, y: 12 }, { x: 82, y: 4 }];
  const first = createDoodlePolyline(points, 'mechanism-a', 1.2);
  assert.equal(first, createDoodlePolyline(points, 'mechanism-a', 1.2));
  assert.notEqual(first, createDoodlePolyline(points, 'mechanism-b', 1.2));
  for (const output of [first, createDoodleCircle(20, 20, 12, 'orb', .6), createDoodlePath('M0 0 Q20 12 40 0', 'path', 1)]) {
    assert.doesNotMatch(output, /NaN|Infinity/);
    assert.ok([...output.matchAll(/-?\d+(?:\.\d+)?/g)].every(match => Number.isFinite(Number(match[0]))));
  }
  assert.doesNotMatch(geometrySource, /Math\.random/);
});

test('doodle pass preserves canonical topology and focus configuration', () => {
  assert.deepEqual(PARK_ACTOR_ANCHORS, {
    carousel: { x: 0.22, y: 0.1, width: 0.32, height: 0.42 },
    ferrisWheel: { x: 0.56, y: 0.04, width: 0.41, height: 0.56 },
    pirateShip: { x: 0.58, y: 0.65, width: 0.2, height: 0.25 },
    dropTower: { x: 0.035, y: 0.07, width: 0.18, height: 0.54 },
    bumperCars: { x: 0.79, y: 0.68, width: 0.18, height: 0.2 },
    rollerCoaster: { x: 0.08, y: 0.61, width: 0.47, height: 0.31 },
  });
  assert.equal(Object.keys(PARK_FOCUS_BOUNDS).length, 6);
  assert.equal(Object.keys(PARK_DISTRICT_CONTOURS).length, 6);
  assert.doesNotMatch(parkSource, /create[A-Z][A-Za-z]+Simulation|AudioWorld|AudioClock/);
});

test('Park-only doodle treatment leaves precise evidence membership intact', () => {
  assert.match(parkSource, /<CarouselView state=\{state\.carousel\} doodle/);
  assert.match(parkSource, /<FerrisWheelView state=\{state\.ferrisWheel\} doodle/);
  assert.match(carouselSource, /pose\.active \? 'carousel-carrier carousel-carrier--active'/);
  assert.match(ferrisSource, /data-pitch-class=\{cabin\.pitchClass\}/);
  assert.match(ferrisSource, /state\.activeCabinIds\.map/);
  assert.match(ferrisSource, /tonal orientation/i);
});

test('annotations remain sparse and debug overlays are outside the doodle utility', () => {
  assert.match(parkSource, /<LiveAnnotationSystem/);
  assert.doesNotMatch(parkSource, /park-annotation-line/);
  assert.doesNotMatch(geometrySource, /PhysicsDebug|confidence|ZlandAudioMap/);
  assert.match(parkSource, /<PhysicsDebugOverlay/);
});
