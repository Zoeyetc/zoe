import assert from 'node:assert/strict';
import test from 'node:test';
import { createAnchoredContentParticipant } from '../src/physics/AnchoredContentParticipant.ts';
import { createPhysicsWorld } from '../src/physics/PhysicsWorld.ts';
import { createDomSpatialAdapter, domRectToWorldMeasurement } from '../src/physics/adapters/dom.ts';
import type { PhysicsImpact } from '../src/physics/types.ts';

const impact = (overrides: Partial<PhysicsImpact> = {}): PhysicsImpact => ({
  id: 'content-impact', sourceId: 'bumper-cars', sourceType: 'collision',
  position: { x: 0.5, y: 0.55 }, direction: { x: 0, y: 1 },
  strength: 0.9, radius: 0.45, timestamp: 2, ...overrides,
});

const content = (reducedMotion = false) => createAnchoredContentParticipant({
  id: 'content-card', bounds: { x: 0.4, y: 0.7, width: 0.2, height: 0.1 },
  maxDisplacement: 0.035, maxRotation: 0.06, reducedMotion,
});

test('content participant exposes only a PhysicsWorld receiver and ignores percussion data', () => {
  const participant = content();
  const before = participant.read();
  const percussion = { type: 'kick', id: 'audio-only', time: 1, strength: 1 } as const;
  assert.equal(percussion.type, 'kick');
  assert.equal('accept' in participant, false);
  assert.deepEqual(participant.read(), before);
});

test('nearby PhysicsWorld impact changes anchored response while distant impact does not', () => {
  const world = createPhysicsWorld();
  world.registerSource('bumper-cars');
  const participant = content();
  world.registerReceiver(participant.registration);
  world.publishImpact(impact());
  participant.step(0.05);
  assert.ok(participant.read().displacement > 0);
  const distant = content();
  const distantWorld = createPhysicsWorld();
  distantWorld.registerSource('bumper-cars');
  distantWorld.registerReceiver(distant.registration);
  const before = distant.read();
  distantWorld.publishImpact(impact({ id: 'distant', position: { x: 0, y: 0 }, radius: 0.1 }));
  distant.step(0.05);
  assert.deepEqual(distant.read().offset, before.offset);
});

test('content response remains bounded and recovers to zero', () => {
  const participant = content();
  for (let index = 0; index < 20; index += 1) {
    participant.registration.receive(impact({ id: `impact-${index}` }), 1, 0.1);
    participant.step(0.05);
  }
  assert.ok(participant.read().displacement <= 0.035 + 1e-9);
  assert.ok(Math.abs(participant.read().rotation) <= 0.06 + 1e-9);
  for (let index = 0; index < 180; index += 1) participant.step(0.05);
  assert.deepEqual(participant.read().offset, { x: 0, y: 0 });
  assert.equal(participant.read().springState, 'settled');
});

test('layout anchor change preserves response velocity and recovery targets the new layout', () => {
  const participant = content();
  participant.registration.receive(impact(), 1, 0.1);
  participant.step(0.05);
  const before = participant.read();
  const nextBounds = { x: 0.12, y: 0.18, width: 0.32, height: 0.12 };
  participant.updateLayout(nextBounds);
  const moved = participant.read();
  assert.deepEqual(moved.velocity, before.velocity);
  assert.deepEqual(moved.offset, before.offset);
  assert.deepEqual(moved.anchor, { x: 0.28, y: 0.24 });
  for (let index = 0; index < 180; index += 1) participant.step(0.05);
  const settled = participant.read();
  assert.deepEqual(settled.worldPosition, settled.anchor);
  assert.deepEqual(settled.bounds, nextBounds);
});

test('restart clears response state without replacing authored layout', () => {
  const participant = content();
  const nextBounds = { x: 0.2, y: 0.3, width: 0.25, height: 0.14 };
  participant.updateLayout(nextBounds);
  participant.registration.receive(impact(), 1, 0.1);
  participant.step(0.05);
  participant.reset();
  const state = participant.read();
  assert.deepEqual(state.bounds, nextBounds);
  assert.deepEqual(state.worldPosition, state.anchor);
  assert.deepEqual(state.velocity, { x: 0, y: 0 });
  assert.equal(state.rotation, 0);
});

test('reduced motion preserves impact causality with much smaller displacement', () => {
  const full = content(false);
  const reduced = content(true);
  full.registration.receive(impact(), 1, 0.1);
  reduced.registration.receive(impact(), 1, 0.1);
  full.step(0.05);
  reduced.step(0.05);
  assert.ok(reduced.read().receivedImpactCount === 1);
  assert.ok(reduced.read().displacement < full.read().displacement * 0.2);
});

test('DOM spatial adapter converts current layout and never measures from read()', () => {
  let contentReads = 0;
  let worldReads = 0;
  const measurements = [];
  const adapter = createDomSpatialAdapter({
    measureContent: () => { contentReads += 1; return { left: 150, top: 180, width: 200, height: 80 }; },
    measureWorld: () => { worldReads += 1; return { left: 50, top: 100, width: 500, height: 400 }; },
    onMeasure: value => measurements.push(value),
  });
  adapter.measure();
  adapter.read();
  adapter.read();
  assert.equal(contentReads, 1);
  assert.equal(worldReads, 1);
  assert.equal(measurements.length, 1);
  assert.deepEqual(adapter.read().measurement?.bounds, { x: 0.2, y: 0.2, width: 0.4, height: 0.2 });
});

test('shared viewport movement cancels out and cannot create a false layout delta', () => {
  const before = domRectToWorldMeasurement(
    { left: 150, top: 180, width: 200, height: 80 },
    { left: 50, top: 100, width: 500, height: 400 },
  );
  const afterScroll = domRectToWorldMeasurement(
    { left: 150, top: 80, width: 200, height: 80 },
    { left: 50, top: 0, width: 500, height: 400 },
  );
  assert.deepEqual(afterScroll, before);
});

test('paused transport and seek semantics cannot gate or synthesize content response', () => {
  const participant = content();
  const transport = { playing: false, seekTo: 8 };
  assert.equal(transport.playing, false);
  assert.deepEqual(participant.read().offset, { x: 0, y: 0 });
  participant.registration.receive(impact({ id: 'post-pause' }), 1, 0.1);
  participant.step(0.05);
  assert.ok(participant.read().displacement > 0);
  const afterPhysicalImpact = participant.read().receivedImpactCount;
  void transport.seekTo;
  assert.equal(participant.read().receivedImpactCount, afterPhysicalImpact);
});
