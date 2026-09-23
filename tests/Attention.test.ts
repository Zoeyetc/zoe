import assert from 'node:assert/strict';
import test from 'node:test';
import { lookupSnapshot } from '../src/audio/AudioWorld.ts';
import { milestoneSevenAAudioMap } from '../src/audio/AudioMap.ts';
import {
  ATTENTION_ACTOR_IDS, ATTENTION_MINIMUM_PRIMARY_HOLD,
  createAttentionController, resolveAttentionRoles, type AttentionEvidence,
} from '../src/experience/attention.ts';
import {
  PARK_ACTOR_ANCHORS, PARK_FOCUS_BOUNDS, PARK_OVERVIEW_VIEWPORT, focusViewport,
} from '../src/experience/park/config.ts';
import { readFileSync } from 'node:fs';

function evidence(time: number, overrides: Partial<AttentionEvidence> = {}): AttentionEvidence {
  return {
    snapshot: lookupSnapshot(milestoneSevenAAudioMap, {
      time, duration: milestoneSevenAAudioMap.duration, playing: true,
    }),
    dropTowerPhase: 'RESTING',
    rollerCoasterReleaseActive: false,
    percussionStrength: 0,
    ...overrides,
  };
}

test('attention roles are deterministic and do not add or remove musical evidence', () => {
  const input = evidence(6);
  const first = resolveAttentionRoles(input, 'ferrisWheel');
  const second = resolveAttentionRoles(input, 'ferrisWheel');
  assert.deepEqual(first, second);
  assert.deepEqual(input.snapshot.harmony.pitchClasses, [9, 0, 4]);
  assert.equal(first.ferrisWheel, 'primary');
  assert.deepEqual(input.snapshot.harmony.pitchClasses, [9, 0, 4]);
  assert.equal(input.snapshot.melody.activeNote?.id, evidence(6).snapshot.melody.activeNote?.id);
});

test('minimum hold prevents rapid primary switching and ignores small percussion as a primary trigger', () => {
  let wallTime = 0;
  const attention = createAttentionController(() => wallTime);
  assert.equal(attention.update(evidence(1), 1).primaryActorId, 'carousel');
  assert.equal(attention.update(evidence(2, { percussionStrength: 0.12 }), 2).primaryActorId, 'carousel');
  assert.equal(attention.update(evidence(2.9), 2.9).primaryActorId, 'carousel');
  assert.equal(attention.update(evidence(4.1), 4.1).primaryActorId, 'ferrisWheel');
  assert.equal(ATTENTION_MINIMUM_PRIMARY_HOLD, 3);
});

test('DropTower hold and RollerCoaster release become stable primary candidates', () => {
  const attention = createAttentionController(() => 0);
  assert.equal(attention.update(evidence(1), 1).primaryActorId, 'carousel');
  assert.equal(attention.update(evidence(5, { dropTowerPhase: 'HOLDING' }), 5).primaryActorId, 'dropTower');
  assert.equal(attention.update(evidence(6, { rollerCoasterReleaseActive: true }), 6).primaryActorId, 'dropTower');
  assert.equal(attention.update(evidence(8.1, { rollerCoasterReleaseActive: true }), 8.1).primaryActorId, 'rollerCoaster');
});

test('manual focus overrides presentation and survives playback, seek, and restart updates', () => {
  let wallTime = 0;
  const attention = createAttentionController(() => wallTime);
  attention.update(evidence(2), 2);
  attention.focus('ferrisWheel');
  const focusedSnapshot = evidence(15).snapshot;
  attention.update({ ...evidence(15), snapshot: focusedSnapshot, rollerCoasterReleaseActive: true }, 15);
  assert.equal(attention.read().focusActorId, 'ferrisWheel');
  assert.equal(attention.read().primaryActorId, 'rollerCoaster');
  attention.update(evidence(0), 0);
  assert.equal(attention.read().focusActorId, 'ferrisWheel');
  assert.equal(attention.read().mode, 'focus');
  attention.overview();
  assert.equal(attention.read().focusActorId, null);
  assert.equal(attention.read().mode, 'overview');
  assert.equal(attention.read().primaryActorId, 'carousel');
});

test('attention composition has no AudioClock or simulation ownership', () => {
  const source = readFileSync(new URL('../src/experience/attention.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /AudioClock|createAudioWorld|create[A-Z][A-Za-z]+Simulation|PhysicsWorld/);
  const frame = evidence(6);
  const timeBefore = frame.snapshot.transport.time;
  const attention = createAttentionController(() => 0);
  attention.update(frame, timeBefore);
  attention.focus('carousel');
  assert.equal(frame.snapshot.transport.time, timeBefore);
});

test('focus changes presentation only and leaves snapshot and actor truth untouched', () => {
  const attention = createAttentionController(() => 0);
  const frame = evidence(6);
  const actorTruth = Object.freeze({ activeCarrierId: 'carrier-4', activeCabinIds: [0, 4, 9] as const });
  const snapshotBefore = JSON.stringify(frame.snapshot);
  const actorBefore = JSON.stringify(actorTruth);
  attention.update(frame, 6);
  attention.focus('carousel');
  assert.equal(JSON.stringify(frame.snapshot), snapshotBefore);
  assert.equal(JSON.stringify(actorTruth), actorBefore);
});

test('every musical actor has explicit focus bounds and overview restores identity transform', () => {
  assert.deepEqual(Object.keys(PARK_FOCUS_BOUNDS).sort(), [...ATTENTION_ACTOR_IDS].sort());
  assert.deepEqual(PARK_OVERVIEW_VIEWPORT, { scale: 1, x: 0, y: 0 });
  for (const id of ATTENTION_ACTOR_IDS) {
    const bounds = PARK_FOCUS_BOUNDS[id];
    const canonicalBefore = { ...PARK_ACTOR_ANCHORS[id] };
    const transform = focusViewport(bounds);
    assert.ok(transform.scale > 1);
    assert.deepEqual(PARK_ACTOR_ANCHORS[id], canonicalBefore);
  }
});

test('reduced motion keeps focus functional and settles the viewport transition immediately', () => {
  const attention = createAttentionController(() => 0, true);
  attention.update(evidence(2), 2);
  const state = attention.focus('dropTower');
  assert.equal(state.mode, 'focus');
  assert.equal(state.focusActorId, 'dropTower');
  assert.equal(state.transition, 'stable');
  assert.equal(state.reducedMotion, true);
});
