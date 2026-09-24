import assert from 'node:assert/strict';
import test from 'node:test';
import type { PercussionKind, PercussionHit } from '@computational-listening/engine';
import type { AudioEvent } from '../apps/zland/src/audio/types.ts';
import type { BumperCarsInput } from '../apps/zland/src/rides/bumper-cars/adapter.ts';
import {
  BUMPER_MAX_ANGULAR_SPEED, BUMPER_MAX_SPEED, createBumperCarsSimulation,
  createInitialBumperBodies, type BumperBodyState,
} from '../apps/zland/src/rides/bumper-cars/simulation.ts';

const roles: readonly PercussionKind[] = ['kick', 'snare', 'closed-hat', 'open-hat', 'tom', 'other-percussion'];
const percussion = (type: PercussionKind, strength = 0.8, id = `${type}-test`): AudioEvent => {
  const hit: PercussionHit = { type, strength, id, time: 1, confidence: 0.8 };
  return { type, strength, id, time: 1, confidence: 0.8, hit };
};
const input = (events: readonly AudioEvent[] = [], playing = true): BumperCarsInput => ({
  percussionAvailable: true, transportPlaying: playing, events,
});
const body = (overrides: Partial<BumperBodyState> = {}): BumperBodyState => ({
  id: 0, role: 'kick', x: 100, y: 100, width: 54, height: 34,
  vx: 0, vy: 0, angle: 0, angularVelocity: 0, musicalImpulseEnvelope: 0,
  lastPercussionEvent: null, lastImpulseStrength: 0, collisionCount: 0, ...overrides,
});

test('exactly six persistent semantic role cars exist', () => {
  const bodies = createInitialBumperBodies();
  assert.equal(bodies.length, 6);
  assert.deepEqual(bodies.map(item => item.role), roles);
  assert.equal(new Set(bodies.map(item => item.id)).size, 6);
});

for (const role of roles) {
  test(`${role} routes only to its stable semantic car`, () => {
    const simulation = createBumperCarsSimulation();
    simulation.accept(input([percussion(role)]), 0);
    const changed = simulation.read().bodies.filter(item => item.lastPercussionEvent !== null);
    assert.equal(changed.length, 1);
    assert.equal(changed[0].role, role);
    assert.equal(simulation.read().latestPercussion, role);
    assert.equal(simulation.read().collisionCount, 0);
    assert.equal(simulation.drainCollisions().length, 0);
  });
}

test('kick and snare retain distinct bounded actor-local physical character', () => {
  const kick = createBumperCarsSimulation();
  const snare = createBumperCarsSimulation();
  kick.accept(input([percussion('kick', 1)]), 0);
  snare.accept(input([percussion('snare', 1)]), 0);
  const kickBody = kick.read().bodies.find(item => item.role === 'kick')!;
  const snareBody = snare.read().bodies.find(item => item.role === 'snare')!;
  assert.ok(Math.hypot(kickBody.vx, kickBody.vy) > Math.hypot(snareBody.vx, snareBody.vy));
  assert.ok(Math.abs(snareBody.angularVelocity) > Math.abs(kickBody.angularVelocity));
  assert.ok(Math.hypot(kickBody.vx, kickBody.vy) <= BUMPER_MAX_SPEED);
});

test('event intensity and confidence remain distinct bounded impulse influences', () => {
  const weak = createBumperCarsSimulation();
  const strong = createBumperCarsSimulation();
  weak.accept(input([percussion('tom', 0.2, 'weak')]), 0);
  strong.accept(input([percussion('tom', 1, 'strong')]), 0);
  const speed = (simulation: ReturnType<typeof createBumperCarsSimulation>) => {
    const item = simulation.read().bodies.find(candidate => candidate.role === 'tom')!;
    return Math.hypot(item.vx, item.vy);
  };
  assert.ok(speed(strong) > speed(weak));
  assert.ok(strong.read().bodies.every(item => item.lastImpulseStrength >= 0 && item.lastImpulseStrength <= 1));
});

test('dense events remain speed and angular-velocity bounded', () => {
  const simulation = createBumperCarsSimulation();
  for (let index = 0; index < 100; index += 1) {
    simulation.accept(input([percussion('closed-hat', 1, `hat-${index}`)]), 0.005);
  }
  assert.ok(simulation.read().bodies.every(item => Math.hypot(item.vx, item.vy) <= BUMPER_MAX_SPEED + 1e-9));
  assert.ok(simulation.read().bodies.every(item => Math.abs(item.angularVelocity) <= BUMPER_MAX_ANGULAR_SPEED + 1e-9));
});

test('body collision corrects overlap and produces a real collision result', () => {
  const simulation = createBumperCarsSimulation({ initialBodies: [
    body({ id: 0, role: 'kick', x: 100, y: 100, vx: 70 }),
    body({ id: 1, role: 'snare', x: 148, y: 104, vx: 0 }),
  ] });
  simulation.accept(input(), 0.02);
  const [first, second] = simulation.read().bodies;
  assert.ok(first.vx < 70 && second.vx > 0);
  assert.ok(simulation.read().collisionCount > 0);
  assert.ok(simulation.drainCollisions().length > 0);
});

test('no collision produces no shared impact candidate', () => {
  const simulation = createBumperCarsSimulation();
  simulation.accept(input([percussion('closed-hat', 0.2)]), 0);
  assert.equal(simulation.drainCollisions().length, 0);
  assert.equal(simulation.read().sharedCollisionCount, 0);
});

test('wall bounds and damping remain active', () => {
  const simulation = createBumperCarsSimulation({ initialBodies: [body({ x: 20, y: 20, vx: -120, vy: -90 })] });
  simulation.accept(input(), 0.1);
  const bounded = simulation.read().bodies[0];
  assert.ok(bounded.x >= 33 && bounded.y >= 23 && bounded.vx >= 0 && bounded.vy >= 0);
  const before = simulation.read().kineticActivity;
  for (let index = 0; index < 20; index += 1) simulation.accept(input(), 0.1);
  assert.ok(simulation.read().kineticActivity < before);
});

test('seek preserves physical state and does not replay skipped percussion', () => {
  const initial = createInitialBumperBodies().map(item => item.role === 'kick' ? { ...item, vx: 40 } : item);
  const simulation = createBumperCarsSimulation({ initialBodies: initial });
  const before = simulation.read().bodies;
  simulation.accept(input([{ type: 'seek', from: 2, to: 10 }]), 0);
  assert.deepEqual(simulation.read().bodies, before);
  assert.equal(simulation.read().latestPercussion, null);
});

test('pause blocks new impulses while existing physical energy advances', () => {
  const simulation = createBumperCarsSimulation();
  simulation.accept(input([percussion('kick')]), 0);
  const kicked = simulation.read();
  simulation.accept(input([percussion('snare', 1)], false), 0.1);
  const paused = simulation.read();
  assert.equal(paused.latestPercussion, 'kick');
  assert.notEqual(paused.bodies[0].x, kicked.bodies[0].x);
  assert.ok(paused.kineticActivity < kicked.kineticActivity);
});

test('restart restores deterministic role identities and initial state', () => {
  const initial = createInitialBumperBodies();
  const simulation = createBumperCarsSimulation({ seed: 72, initialBodies: initial });
  simulation.accept(input([percussion('kick')]), 0.1);
  simulation.accept(input([{ type: 'seek', from: 4, to: 0 }], false), 0);
  assert.deepEqual(simulation.read().bodies, initial);
  assert.equal(simulation.read().mode, 'resting');
});

test('same seed and events reproduce actor state', () => {
  const first = createBumperCarsSimulation({ seed: 991 });
  const second = createBumperCarsSimulation({ seed: 991 });
  for (const event of [percussion('kick'), percussion('snare'), percussion('closed-hat')]) {
    first.accept(input([event]), 0.1); second.accept(input([event]), 0.1);
  }
  assert.deepEqual(first.read(), second.read());
});

test('focus/attention is absent from the actor input contract', () => {
  assert.deepEqual(Object.keys(input()).sort(), ['events', 'percussionAvailable', 'transportPlaying']);
});

test('reduced motion preserves role identity with restrained activity', () => {
  const full = createBumperCarsSimulation();
  const reduced = createBumperCarsSimulation({ reducedMotion: true });
  full.accept(input([percussion('snare')]), 0);
  reduced.accept(input([percussion('snare')]), 0);
  assert.equal(reduced.read().latestPercussion, 'snare');
  assert.deepEqual(reduced.read().bodies.map(item => item.role), full.read().bodies.map(item => item.role));
  assert.ok(reduced.read().kineticActivity < full.read().kineticActivity * 0.1);
});
