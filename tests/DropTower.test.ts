import assert from 'node:assert/strict';
import test from 'node:test';
import { milestoneOneAudioMap, milestoneTwoBAudioMap } from '../src/audio/AudioMap.ts';
import { lookupSnapshot } from '../src/audio/AudioWorld.ts';
import type { AudioFrame } from '../src/audio/types.ts';
import { toDropTowerInput, type DropTowerInput } from '../src/rides/drop-tower/adapter.ts';
import {
  createDropTowerSimulation,
  DROP_TOWER_MAX_VELOCITY,
  DROP_TOWER_REDUCED_TOP,
  DROP_TOWER_TOP,
} from '../src/rides/drop-tower/simulation.ts';

const input = (overrides: Partial<DropTowerInput> = {}): DropTowerInput => ({
  structureAvailable: true,
  section: 'build',
  sectionProgress: 0.5,
  energy: 0.6,
  tension: 0.6,
  build: 0.65,
  transportPlaying: true,
  drop: null,
  seek: false,
  restart: false,
  ...overrides,
});

const advance = (simulation: ReturnType<typeof createDropTowerSimulation>, value: DropTowerInput, seconds: number) => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) simulation.accept(value, 0.05);
};

const prepareHold = (simulation: ReturnType<typeof createDropTowerSimulation>) => {
  const hold = input({ section: 'hold', build: 1, tension: 1, energy: 0.36 });
  simulation.accept(hold, 0.05);
  simulation.accept(hold, 0.05);
  advance(simulation, hold, 3);
  return hold;
};

test('DropTower adapter consumes structure/drop and excludes local musical domains', () => {
  const snapshot = lookupSnapshot(milestoneTwoBAudioMap, { time: 7, duration: 20, playing: true });
  const frame: AudioFrame = {
    snapshot,
    events: [
      { type: 'kick', time: 7, id: 'ignored', strength: 1 },
      { type: 'chord-change', time: 7, harmony: milestoneTwoBAudioMap.harmony![1] },
    ],
  };
  const adapted = toDropTowerInput(frame);
  assert.equal(adapted.section, 'build');
  assert.equal('activeNote' in adapted, false);
  assert.equal('groove' in adapted, false);
  assert.equal('chord' in adapted, false);
  assert.equal(adapted.drop, null);
});

test('unavailable structure keeps DropTower inactive at rest', () => {
  const snapshot = lookupSnapshot(milestoneOneAudioMap, { time: 6, duration: 12, playing: true });
  const simulation = createDropTowerSimulation();
  simulation.accept(toDropTowerInput({ snapshot, events: [] }), 0.1);
  assert.equal(simulation.read().phase, 'IDLE');
  assert.equal(simulation.read().position, 1);
});

test('build drives bounded actor-local lift progression', () => {
  const simulation = createDropTowerSimulation();
  advance(simulation, input({ build: 0.8 }), 3);
  assert.equal(simulation.read().phase, 'LIFTING');
  assert.ok(simulation.read().position < 1);
  assert.ok(simulation.read().position > DROP_TOWER_TOP);
  assert.ok(Math.abs(simulation.read().velocity) <= DROP_TOWER_MAX_VELOCITY);
});

test('high build and tension permit a distinct holding state', () => {
  const simulation = createDropTowerSimulation();
  prepareHold(simulation);
  assert.equal(simulation.read().phase, 'HOLDING');
  assert.ok(Math.abs(simulation.read().velocity) < 0.02);
  assert.ok(Math.abs(simulation.read().position - DROP_TOWER_TOP) < 0.01);
});

test('only explicit drop releases the held carriage', () => {
  const simulation = createDropTowerSimulation();
  const hold = prepareHold(simulation);
  simulation.accept({ ...hold, energy: 1 }, 0.1);
  assert.equal(simulation.read().phase, 'HOLDING');
  simulation.accept({ ...hold, section: 'release', build: 0, tension: 0.1,
    energy: 1, drop: { type: 'drop', time: 13, id: 'major-drop', strength: 1 } }, 0.05);
  assert.equal(simulation.read().phase, 'DROPPING');
  assert.equal(simulation.read().latestDropEvent, 'major-drop');
});

test('drop, braking, rebound, and settling remain bounded', () => {
  const simulation = createDropTowerSimulation();
  const hold = prepareHold(simulation);
  const release = { ...hold, section: 'release', build: 0, tension: 0.1, energy: 1,
    drop: { type: 'drop' as const, time: 13, id: 'major-drop', strength: 1 } };
  simulation.accept(release, 0.05);
  let sawRebound = false;
  for (let index = 0; index < 180; index += 1) {
    simulation.accept({ ...release, drop: null }, 0.05);
    sawRebound ||= simulation.read().phase === 'REBOUND' || simulation.read().phase === 'SETTLING';
    assert.ok(simulation.read().position >= DROP_TOWER_TOP - 1e-9 && simulation.read().position <= 1.08 + 1e-9);
    assert.ok(Math.abs(simulation.read().velocity) <= DROP_TOWER_MAX_VELOCITY + 1e-9);
  }
  assert.equal(sawRebound, true);
  assert.equal(simulation.read().position, 1);
});

test('pause is state-aware for lifting, holding, and dropping', () => {
  const lifting = createDropTowerSimulation();
  advance(lifting, input(), 1);
  const liftSpeed = Math.abs(lifting.read().velocity);
  lifting.accept(input({ transportPlaying: false }), 0.1);
  assert.equal(lifting.read().phase, 'LIFTING');
  assert.ok(Math.abs(lifting.read().velocity) < liftSpeed);

  const holding = createDropTowerSimulation();
  const hold = prepareHold(holding);
  holding.accept({ ...hold, transportPlaying: false }, 0.2);
  assert.equal(holding.read().phase, 'HOLDING');

  const dropping = createDropTowerSimulation();
  prepareHold(dropping);
  dropping.accept({ ...hold, section: 'release', build: 0, tension: 0, energy: 1,
    drop: { type: 'drop', time: 13, id: 'drop', strength: 1 } }, 0.05);
  const before = dropping.read().position;
  dropping.accept(input({ section: 'release', build: 0, tension: 0, energy: 1,
    transportPlaying: false }), 0.1);
  assert.ok(dropping.read().position > before);
});

test('seek reconciles build and post-drop structure without replaying drop', () => {
  const simulation = createDropTowerSimulation();
  simulation.accept(input({ seek: true, section: 'build', build: 0.5 }), 0);
  assert.equal(simulation.read().phase, 'LIFTING');
  assert.ok(simulation.read().position < 1);
  assert.equal(simulation.read().latestDropEvent, null);
  simulation.accept(input({ seek: true, section: 'release', build: 0, tension: 0.1, energy: 0.8 }), 0);
  assert.equal(simulation.read().phase, 'SETTLING');
  assert.equal(simulation.read().position, 1);
  assert.equal(simulation.read().latestDropEvent, null);
});

test('restart restores deterministic initial state', () => {
  const simulation = createDropTowerSimulation();
  prepareHold(simulation);
  simulation.accept(input({ seek: true, restart: true, section: 'rest', build: 0, tension: 0, energy: 0.08 }), 0);
  const state = simulation.read();
  assert.equal(state.phase, 'IDLE');
  assert.equal(state.position, 1);
  assert.equal(state.velocity, 0);
  assert.equal(state.latestDropEvent, null);
});

test('reduced motion preserves phases with substantially limited travel', () => {
  const full = createDropTowerSimulation();
  const reduced = createDropTowerSimulation({ reducedMotion: true });
  const build = input({ build: 1, tension: 0.7 });
  advance(full, build, 4);
  advance(reduced, build, 4);
  assert.ok(full.read().position <= DROP_TOWER_TOP + 0.1);
  assert.ok(reduced.read().position >= DROP_TOWER_REDUCED_TOP - 1e-9);
  assert.ok(1 - reduced.read().position < (1 - full.read().position) * 0.3);
});
