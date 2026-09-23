import assert from 'node:assert/strict';
import test from 'node:test';
import { lookupSnapshot } from '../src/audio/AudioWorld.ts';
import { milestoneSevenAAudioMap } from '../src/audio/AudioMap.ts';
import {
  ATTENTION_ACTOR_IDS, ATTENTION_MINIMUM_PRIMARY_HOLD, ATTENTION_SWITCH_MARGIN,
  createAttentionController, resolveAttentionRoles, type AttentionEvidence,
} from '../src/experience/attention.ts';
import { scoreStructuralAttention, STRUCTURAL_ATTENTION_CONFIG } from '../src/experience/attention/StructuralAttentionPolicy.ts';
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

function structuralEvidence(time: number, structure: Partial<AttentionEvidence['snapshot']['structure']>,
  overrides: Partial<AttentionEvidence> = {}): AttentionEvidence {
  const input = evidence(time, overrides);
  return { ...input, snapshot: { ...input.snapshot, structure: {
    ...input.snapshot.structure, source: 'analysis', available: true,
    segmentId: 'segment-a', label: 'A', recurrenceGroup: 'A', confidence: 0.9,
    energy: 0.35, contrast: 0.2, importance: 0.35, ...structure,
  } } };
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

test('structural attention keeps one primary, enforces hold, and ignores unavailable percussion', () => {
  let wallTime = 0;
  const attention = createAttentionController(() => wallTime);
  const first = attention.update(structuralEvidence(1, { segmentId: 'a', contrast: 0 }), 1);
  assert.ok(first.primaryActorId);
  const heldInput = structuralEvidence(2, {
    segmentId: 'b', contrast: 1, importance: 1,
  }, { percussionStrength: 1 });
  const held = attention.update({ ...heldInput, snapshot: { ...heldInput.snapshot,
    percussion: { available: false } } }, 2);
  assert.equal(held.primaryActorId, first.primaryActorId);
  assert.equal(held.roles.bumperCars, 'resting');
  const switched = attention.update(structuralEvidence(4.1, {
    segmentId: 'c', contrast: 1, importance: 1,
  }, { percussionStrength: 1 }), 4.1);
  assert.equal(switched.primaryActorId, 'dropTower');
  assert.equal(Object.values(switched.roles).filter(role => role === 'primary').length, 1);
  assert.equal(ATTENTION_MINIMUM_PRIMARY_HOLD, 3);
});

test('authored DropTower and RollerCoaster evidence remain valid structural candidates', () => {
  const attention = createAttentionController(() => 0);
  const initial = attention.update(evidence(1), 1).primaryActorId;
  assert.ok(initial);
  assert.equal(attention.update(evidence(5, { dropTowerPhase: 'HOLDING', seek: true }), 5).primaryActorId, 'dropTower');
  assert.equal(attention.update(evidence(9, { rollerCoasterReleaseActive: true, seek: true }), 9).primaryActorId, 'rollerCoaster');
});

test('manual focus overrides presentation and survives playback, seek, and restart updates', () => {
  let wallTime = 0;
  const attention = createAttentionController(() => wallTime);
  attention.update(evidence(2), 2);
  attention.focus('ferrisWheel');
  const focusedSnapshot = evidence(15).snapshot;
  attention.update({ ...evidence(15), snapshot: focusedSnapshot, rollerCoasterReleaseActive: true, seek: true }, 15);
  assert.equal(attention.read().focusActorId, 'ferrisWheel');
  assert.equal(attention.read().primaryActorId, 'rollerCoaster');
  attention.update({ ...evidence(0), seek: true }, 0);
  assert.equal(attention.read().focusActorId, 'ferrisWheel');
  assert.equal(attention.read().mode, 'focus');
  attention.overview();
  assert.equal(attention.read().focusActorId, null);
  assert.equal(attention.read().mode, 'overview');
  assert.ok(attention.read().primaryActorId);
});

test('hysteresis rejects a small lead but permits a strong valid candidate after hold', () => {
  const attention = createAttentionController(() => 0);
  assert.equal(attention.update(structuralEvidence(1, { segmentId: 'a' }), 1).primaryActorId, 'ferrisWheel');
  const marginal = structuralEvidence(1, { segmentId: 'b' });
  const marginalHarmony = { ...marginal.snapshot.harmony, confidence: 0.1 };
  const retained = attention.update({ ...marginal, snapshot: { ...marginal.snapshot, harmony: marginalHarmony } }, 5);
  assert.equal(retained.primaryActorId, 'ferrisWheel');
  assert.match(retained.diagnostics.decision, /score margin/);
  const strong = structuralEvidence(9, { segmentId: 'c' });
  const switched = attention.update({ ...strong, snapshot: { ...strong.snapshot,
    harmony: { ...strong.snapshot.harmony, available: false, active: false } } }, 9);
  assert.equal(switched.primaryActorId, 'carousel');
  assert.equal(ATTENTION_SWITCH_MARGIN, 0.08);
});

test('same-section note and chord changes cannot cause beat-scale primary switching', () => {
  const attention = createAttentionController(() => 0);
  const initial = attention.update(structuralEvidence(1, { segmentId: 'stable' }), 1).primaryActorId;
  const changed = structuralEvidence(8, { segmentId: 'stable', energy: 1 });
  const state = attention.update({ ...changed, snapshot: { ...changed.snapshot,
    harmony: { ...changed.snapshot.harmony, active: false, confidence: 0 },
  } }, 8);
  assert.equal(state.primaryActorId, initial);
  assert.match(state.diagnostics.decision, /stable section/);
});

test('seek resolves the destination directly, pause holds, and no historical transitions are replayed', () => {
  const attention = createAttentionController(() => 0);
  attention.update(structuralEvidence(1, { segmentId: 'a' }), 1);
  const destination = structuralEvidence(18, { segmentId: 'c', contrast: 1, importance: 1 }, { seek: true });
  const sought = attention.update(destination, 18);
  assert.equal(sought.primaryActorId, 'dropTower');
  assert.match(sought.diagnostics.decision, /direct seek resolution/);
  const paused = { ...structuralEvidence(19, { segmentId: 'd' }), snapshot: {
    ...destination.snapshot, transport: { ...destination.snapshot.transport, time: 19, playing: false },
    structure: { ...destination.snapshot.structure, segmentId: 'd', contrast: 0 },
  } };
  assert.equal(attention.update(paused, 19).primaryActorId, 'dropTower');
  assert.match(attention.read().diagnostics.decision, /paused/);
});

test('persistent seek diagnostics resolve once and do not replay historical attention changes', () => {
  const attention = createAttentionController(() => 0);
  attention.update(structuralEvidence(1, { segmentId: 'a' }), 1);
  const destination = structuralEvidence(17, { segmentId: 'release', contrast: 1, importance: 1 },
    { seekToken: '1:17' });
  assert.equal(attention.update(destination, 17).primaryActorId, 'dropTower');
  const repeated = attention.update({ ...destination, snapshot: { ...destination.snapshot,
    transport: { ...destination.snapshot.transport, playing: false } } }, 17);
  assert.equal(repeated.primaryActorId, 'dropTower');
  assert.match(repeated.diagnostics.decision, /paused/);
});

test('structure-unavailable snapshots preserve the validated fallback policy', () => {
  const attention = createAttentionController(() => 0);
  const state = attention.update(evidence(1), 1);
  const unavailable = { ...evidence(1), snapshot: { ...evidence(1).snapshot,
    structure: { ...evidence(1).snapshot.structure, available: false, source: null } } };
  const fallback = createAttentionController(() => 0).update(unavailable, 1);
  assert.equal(fallback.diagnostics.source, 'fallback');
  assert.equal(fallback.primaryActorId, 'carousel');
  assert.ok(state.primaryActorId);
});

test('recurrence labels are neutral and cannot hard-code an actor', () => {
  const a = structuralEvidence(5, { segmentId: 'a', label: 'A', recurrenceGroup: 'A' });
  const b = structuralEvidence(5, { segmentId: 'b', label: 'B', recurrenceGroup: 'B' });
  assert.equal(scoreStructuralAttention(a, null).leadingActorId, scoreStructuralAttention(b, null).leadingActorId);
  assert.equal(STRUCTURAL_ATTENTION_CONFIG.boundaryAnticipationWindow, 1.5);
});

test('candidate diagnostics are finite and explain availability, activity, structure, and continuity', () => {
  const state = createAttentionController(() => 0).update(structuralEvidence(5, { segmentId: 'a' }), 5);
  for (const diagnostic of Object.values(state.diagnostics.scores)) {
    assert.ok(Number.isFinite(diagnostic.score));
    assert.ok(Number.isFinite(diagnostic.baseActivity));
    assert.ok(Number.isFinite(diagnostic.structuralBias));
    assert.ok(Number.isFinite(diagnostic.continuity));
    assert.ok(diagnostic.reason.length > 0);
  }
});

test('attention composition has no AudioClock or simulation ownership', () => {
  const source = readFileSync(new URL('../src/experience/attention.ts', import.meta.url), 'utf8')
    + readFileSync(new URL('../src/experience/attention/StructuralAttentionPolicy.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from ['"][^'"]*(AudioClock|simulation|physics)[^'"]*['"]/i);
  assert.doesNotMatch(source, /createAudioWorld|create[A-Z][A-Za-z]+Simulation/);
  const frame = evidence(6);
  const timeBefore = frame.snapshot.transport.time;
  const attention = createAttentionController(() => 0);
  attention.update(frame, timeBefore);
  attention.focus('carousel');
  assert.equal(frame.snapshot.transport.time, timeBefore);
});

test('automatic candidate set excludes infrastructure, atmosphere, gate, and content', () => {
  assert.deepEqual(ATTENTION_ACTOR_IDS, [
    'carousel', 'ferrisWheel', 'pirateShip', 'bumperCars', 'dropTower', 'rollerCoaster',
  ]);
  assert.ok(!ATTENTION_ACTOR_IDS.includes('parkTrain' as never));
  assert.ok(!ATTENTION_ACTOR_IDS.includes('freeBodies' as never));
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
