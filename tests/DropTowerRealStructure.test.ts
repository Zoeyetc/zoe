import assert from 'node:assert/strict';
import test from 'node:test';
import { milestoneSevenZlandAudioMap } from '../apps/zland/src/audio/ZlandAudioMaps.ts';
import { createAudioWorld, lookupSnapshot } from '../apps/zland/src/audio/AudioWorld.ts';
import { createDropTowerQaZlandAudioMap } from '../apps/zland/src/audio/DropTowerQaZlandAudioMap.ts';
import type { StructureSegment } from '@computational-listening/engine';
import type { AudioEvent, AudioFrame } from '../apps/zland/src/audio/types.ts';
import { createDropTowerStructureInterpreter, DROP_TOWER_STRUCTURE_CONSTANTS } from '../apps/zland/src/rides/drop-tower/realStructureAdapter.ts';
import { createDropTowerSimulation } from '../apps/zland/src/rides/drop-tower/simulation.ts';
import { DROP_TOWER_STRUCTURE_FIXTURES } from './dropTowerStructureFixtures.ts';

type Evidence = Readonly<{
  available?: boolean; segmentId?: string; section?: string; progress?: number;
  confidence?: number; energy?: number; contrast?: number; importance?: number;
  previousBoundaryConfidence?: number | null; nextBoundaryTime?: number | null;
  nextBoundaryConfidence?: number | null;
}>;

const segment = (id: string, start: number, energy: number, contrast: number, importance: number): StructureSegment => ({
  id, start, end: start + 8, label: id, recurrenceGroup: id.toUpperCase(),
  confidence: .95, energy, contrast, importance, startBoundaryConfidence: .95,
});

function frame(time: number, evidence: Evidence = {}, events: readonly AudioEvent[] = [], playing = true): AudioFrame {
  const snapshot = lookupSnapshot(milestoneSevenZlandAudioMap, { time, duration: 24, playing });
  const available = evidence.available ?? true;
  return {
    events,
    snapshot: { ...snapshot, transport: { ...snapshot.transport, time, playing }, structure: {
      ...snapshot.structure,
      source: available ? 'analysis' : null,
      available,
      segmentId: available ? evidence.segmentId ?? 'analysis-a' : null,
      section: available ? evidence.section ?? 'A' : null,
      label: available ? evidence.section ?? 'A' : null,
      recurrenceGroup: available ? 'A' : null,
      segmentStart: available ? 0 : null,
      segmentEnd: available ? 8 : null,
      sectionProgress: evidence.progress ?? Math.min(1, time / 8),
      confidence: evidence.confidence ?? .95,
      energy: evidence.energy ?? .7,
      contrast: evidence.contrast ?? .85,
      importance: evidence.importance ?? .9,
      novelty: .6,
      previousBoundaryTime: evidence.previousBoundaryConfidence === undefined ? null : time,
      previousBoundaryConfidence: evidence.previousBoundaryConfidence ?? null,
      nextBoundaryTime: evidence.nextBoundaryTime === undefined ? 8 : evidence.nextBoundaryTime,
      nextBoundaryConfidence: evidence.nextBoundaryConfidence === undefined ? .95 : evidence.nextBoundaryConfidence,
      tension: 0, build: 0, phraseProgress: 0,
    } },
  };
}

function prepare(interpreter: ReturnType<typeof createDropTowerStructureInterpreter>, start = 5.5) {
  let result = interpreter.accept(frame(start), .1);
  for (let index = 1; index <= 18; index += 1) {
    const time = start + index * .1;
    result = interpreter.accept(frame(time, { progress: time / 8 }), .1);
  }
  return result;
}

function crossing(time: number, evidence: Evidence = {}) {
  const next = segment('analysis-b', time, evidence.energy ?? .2, evidence.contrast ?? .95, evidence.importance ?? .9);
  return frame(time, { segmentId: next.id, section: 'B', progress: 0,
    energy: next.energy, contrast: next.contrast, importance: next.importance,
    previousBoundaryConfidence: evidence.previousBoundaryConfidence ?? .95,
    nextBoundaryTime: time + 8, ...evidence }, [{ type: 'section-change', time, structure: next }]);
}

test('all required real-structure fixtures are explicit, finite, and deterministic', () => {
  assert.equal(DROP_TOWER_STRUCTURE_FIXTURES.length, 15);
  assert.deepEqual(DROP_TOWER_STRUCTURE_FIXTURES.map(item => item.id), [
    'flat', 'gradual-build', 'prepared-release', 'weak-boundary', 'unprepared-boundary',
    'nearby-boundaries', 'high-stable', 'low-stable', 'a-to-b', 'a-b-a',
    'electronic-like', 'gradual-transition', 'weak-confidence', 'unavailable', 'short-song',
  ]);
  for (const fixture of DROP_TOWER_STRUCTURE_FIXTURES) {
    assert.ok([fixture.confidence, fixture.energy, fixture.contrast, fixture.importance]
      .every(value => Number.isFinite(value) && value >= 0 && value <= 1));
  }
});

test('flat and high-energy stable sections remain neutral without structural preparation', () => {
  for (const energy of [.2, .95]) {
    const interpreter = createDropTowerStructureInterpreter();
    let drive = interpreter.accept(frame(2, { energy, contrast: .04, importance: .18,
      nextBoundaryConfidence: .1, nextBoundaryTime: 20 }), .1).drive;
    for (let index = 0; index < 30; index += 1) drive = interpreter.accept(frame(2 + index * .1,
      { energy, contrast: .04, importance: .18, nextBoundaryConfidence: .1, nextBoundaryTime: 20 }), .1).drive;
    assert.ok(drive.liftIntent < DROP_TOWER_STRUCTURE_CONSTANTS.liftThreshold);
    assert.equal(drive.dropAuthorized, false);
  }
});

test('sustained build creates bounded lift and hold intent while a short spike does not', () => {
  const sustained = createDropTowerStructureInterpreter();
  const drive = prepare(sustained).drive;
  assert.ok(drive.liftIntent >= DROP_TOWER_STRUCTURE_CONSTANTS.liftThreshold);
  assert.ok(drive.holdIntent >= DROP_TOWER_STRUCTURE_CONSTANTS.holdThreshold);
  const spike = createDropTowerStructureInterpreter().accept(frame(7.5), .1).drive;
  assert.ok(spike.liftIntent < DROP_TOWER_STRUCTURE_CONSTANTS.liftThreshold);
  assert.ok(drive.build > spike.build);
});

test('prepared strong boundary authorizes one drop; weak or unprepared boundary does not', () => {
  const prepared = createDropTowerStructureInterpreter();
  prepare(prepared);
  const strong = prepared.accept(crossing(8), .1).drive;
  assert.equal(strong.dropAuthorized, true, JSON.stringify(strong));
  assert.ok(strong.release >= DROP_TOWER_STRUCTURE_CONSTANTS.releaseThreshold);

  const weak = createDropTowerStructureInterpreter();
  prepare(weak);
  assert.equal(weak.accept(crossing(8, { contrast: .3, previousBoundaryConfidence: .4,
    importance: .5, energy: .62 }), .1).drive.dropAuthorized, false);

  const unprepared = createDropTowerStructureInterpreter();
  assert.equal(unprepared.accept(crossing(8), .1).drive.dropAuthorized, false);
});

test('low confidence, arrangement-only updates, and seek never authorize drop', () => {
  const low = createDropTowerStructureInterpreter();
  for (let index = 0; index < 25; index += 1) low.accept(frame(5 + index * .1, { confidence: .4 }), .1);
  assert.equal(low.accept(crossing(8, { confidence: .4 }), .1).drive.dropAuthorized, false);

  const arrangement = createDropTowerStructureInterpreter();
  prepare(arrangement);
  assert.equal(arrangement.accept(frame(8, { segmentId: 'analysis-a', progress: 1 }), .1).drive.dropAuthorized, false);

  const sought = createDropTowerStructureInterpreter();
  prepare(sought);
  const seek = sought.accept(frame(16, { segmentId: 'analysis-c', progress: .8 },
    [{ type: 'seek', from: 6, to: 16 }]), 0).drive;
  assert.equal(seek.dropAuthorized, false);
});

test('cooldown blocks a second nearby prepared release', () => {
  const interpreter = createDropTowerStructureInterpreter();
  prepare(interpreter);
  assert.equal(interpreter.accept(crossing(8), .1).drive.dropAuthorized, true);
  for (let index = 0; index < 20; index += 1) interpreter.accept(frame(8.1 + index * .1,
    { segmentId: 'analysis-b', section: 'B', progress: .8 }), .1);
  const repeated = interpreter.accept(crossing(10.2, { segmentId: 'analysis-c' }), .1).drive;
  assert.equal(repeated.dropAuthorized, false);
  assert.ok(repeated.cooldownRemaining > 0);
  assert.match(repeated.reason, /cooldown/);
});

test('same analyzed history produces byte-equivalent drive state', () => {
  const first = createDropTowerStructureInterpreter();
  const second = createDropTowerStructureInterpreter();
  for (let index = 0; index < 20; index += 1) {
    const next = frame(5.5 + index * .1);
    assert.deepEqual(first.accept(next, .1), second.accept(next, .1));
  }
});

test('analyzed drive operates the existing state machine and releases only after preparation', () => {
  const interpreter = createDropTowerStructureInterpreter();
  const simulation = createDropTowerSimulation();
  for (let index = 0; index < 24; index += 1) {
    const next = frame(5.5 + index * .1);
    simulation.accept(interpreter.accept(next, .1), .1);
  }
  assert.ok(['LIFTING', 'HOLDING'].includes(simulation.read().phase));
  for (let index = 0; index < 30 && simulation.read().phase !== 'HOLDING'; index += 1) {
    const next = frame(7.8, { progress: .98 });
    simulation.accept(interpreter.accept(next, .1), .1);
  }
  assert.equal(simulation.read().phase, 'HOLDING');
  simulation.accept(interpreter.accept(crossing(8), .1), .1);
  assert.equal(simulation.read().phase, 'DROPPING');
  let sawRebound = false;
  for (let index = 0; index < 180; index += 1) {
    const next = frame(8.1 + index * .05, { segmentId: 'analysis-b', section: 'B',
      progress: Math.min(1, index / 160), energy: .2, contrast: .05, importance: .1,
      previousBoundaryConfidence: .95, nextBoundaryTime: null, nextBoundaryConfidence: null });
    simulation.accept(interpreter.accept(next, .05), .05);
    sawRebound ||= simulation.read().phase === 'REBOUND' || simulation.read().phase === 'SETTLING';
  }
  assert.equal(sawRebound, true);
  assert.equal(simulation.read().phase, 'IDLE');
});

test('seek reconciles analyzed build or hold without replaying release', () => {
  const interpreter = createDropTowerStructureInterpreter();
  const simulation = createDropTowerSimulation();
  const buildSeek = frame(7, { progress: .875 }, [{ type: 'seek', from: 1, to: 7 }]);
  simulation.accept(interpreter.accept(buildSeek, 0), 0);
  assert.notEqual(simulation.read().phase, 'DROPPING');
  assert.equal(simulation.read().latestDropEvent, null);
  const firstSeek = createDropTowerStructureInterpreter().accept(buildSeek, 0);
  const repeat = createDropTowerStructureInterpreter().accept(buildSeek, 0);
  assert.deepEqual(firstSeek.drive, repeat.drive);
});

test('structure unavailable aborts preparation without creating a drop', () => {
  const interpreter = createDropTowerStructureInterpreter();
  const simulation = createDropTowerSimulation();
  const prepared = prepare(interpreter);
  simulation.accept(prepared, .1);
  const unavailable = interpreter.accept(frame(8, { available: false }), .1);
  simulation.accept(unavailable, .1);
  assert.equal(unavailable.drive.source, 'none');
  assert.equal(unavailable.drive.dropAuthorized, false);
  assert.notEqual(simulation.read().phase, 'DROPPING');
});

test('analyzed hold aborts into controlled settling when release evidence disappears', () => {
  const interpreter = createDropTowerStructureInterpreter();
  const simulation = createDropTowerSimulation();
  for (let index = 0; index < 30; index += 1) {
    const time = 5.2 + index * .1;
    simulation.accept(interpreter.accept(frame(time, { progress: time / 8 }), .1), .1);
  }
  for (let index = 0; index < 40 && simulation.read().phase !== 'HOLDING'; index += 1) {
    simulation.accept(interpreter.accept(frame(7.9, { progress: .99 }), .1), .1);
  }
  assert.equal(simulation.read().phase, 'HOLDING');
  for (let index = 0; index < 18; index += 1) {
    const time = 8 + index * .1;
    simulation.accept(interpreter.accept(frame(time, { segmentId: 'analysis-b', section: 'B',
      progress: index / 80, energy: .7, contrast: .02, importance: .05,
      nextBoundaryTime: null, nextBoundaryConfidence: null }), .1), .1);
  }
  assert.ok(['SETTLING', 'IDLE'].includes(simulation.read().phase));
  assert.equal(simulation.read().latestDropEvent, null);
});

test('analyzed pause is state-aware and restart is deterministic', () => {
  const interpreter = createDropTowerStructureInterpreter();
  const simulation = createDropTowerSimulation();
  for (let index = 0; index < 24; index += 1) {
    const time = 5.5 + index * .1;
    simulation.accept(interpreter.accept(frame(time, { progress: time / 8 }), .1), .1);
  }
  const beforePause = simulation.read();
  simulation.accept(interpreter.accept(frame(7.9, { progress: .99 }, [], false), .2), .2);
  assert.notEqual(simulation.read().phase, 'DROPPING');
  assert.ok(Math.abs(simulation.read().position - beforePause.position) < .1);

  simulation.accept(interpreter.accept(crossing(8), .1), .1);
  const droppingPosition = simulation.read().position;
  simulation.accept(interpreter.accept(frame(8.1, { segmentId: 'analysis-b', section: 'B', progress: .01,
    energy: .2, contrast: .95, importance: .9 }, [], false), .1), .1);
  assert.ok(simulation.read().position >= droppingPosition);
  assert.equal(simulation.read().phase, 'DROPPING');

  simulation.accept({ ...interpreter.accept(frame(0, { contrast: .05, importance: .1,
    nextBoundaryTime: null, nextBoundaryConfidence: null }), 0), restart: true }, 0);
  assert.equal(simulation.read().phase, 'IDLE');
  assert.equal(simulation.read().position, 1);
  assert.equal(simulation.read().latestDropEvent, null);
});

test('analyzed simulation remains finite and bounded under repeated structure updates', () => {
  const interpreter = createDropTowerStructureInterpreter();
  const simulation = createDropTowerSimulation();
  for (let index = 0; index < 600; index += 1) {
    const time = (index * .05) % 8;
    simulation.accept(interpreter.accept(frame(time, { progress: time / 8,
      energy: .2 + (index % 17) / 25 }), .05), .05);
    const state = simulation.read();
    assert.ok(Number.isFinite(state.position) && Number.isFinite(state.velocity));
    assert.ok(state.position >= DROP_TOWER_STRUCTURE_CONSTANTS.fullLiftFraction * 0 + .08);
    assert.ok(state.position <= 1.08);
    assert.ok(Math.abs(state.velocity) <= 2.4);
  }
});

test('authored and analyzed sources remain explicit and distinct', () => {
  const interpreter = createDropTowerStructureInterpreter();
  assert.equal(interpreter.accept(frame(6), .1).drive.source, 'analyzed');
  const authoredSnapshot = lookupSnapshot(milestoneSevenZlandAudioMap, { time: 7, duration: 24, playing: true });
  assert.equal(interpreter.accept({ snapshot: authoredSnapshot, events: [] }, .1).drive.source, 'authored');
});

test('AudioWorld forward crossing drives prepared release and nearby boundary cooldown', () => {
  const map = createDropTowerQaZlandAudioMap('nearby-boundaries');
  const world = createAudioWorld(map);
  const interpreter = createDropTowerStructureInterpreter();
  world.read({ time: 7.4, duration: map.duration, playing: true });
  for (let index = 0; index < 25; index += 1) {
    const time = 7.5 + index * .1;
    interpreter.accept(world.read({ time, duration: map.duration, playing: true }), .1);
  }
  const first = interpreter.accept(world.read({ time: 10.01, duration: map.duration, playing: true }), .1).drive;
  assert.equal(first.dropAuthorized, true);
  for (let index = 0; index < 20; index += 1) {
    const time = 10.1 + index * .1;
    interpreter.accept(world.read({ time, duration: map.duration, playing: true }), .1);
  }
  const second = interpreter.accept(world.read({ time: 12.21, duration: map.duration, playing: true }), .1).drive;
  assert.equal(second.dropAuthorized, false);
  assert.ok(second.cooldownRemaining > 0);
});
