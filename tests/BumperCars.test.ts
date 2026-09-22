import assert from 'node:assert/strict';
import test from 'node:test';
import type { AudioEvent, PercussionKind } from '../src/audio/types.ts';
import type { BumperCarsInput } from '../src/rides/bumper-cars/adapter.ts';
import {
  BUMPER_MAX_SPEED,
  createBumperCarsSimulation,
  createInitialBumperBodies,
  type BumperBodyState,
} from '../src/rides/bumper-cars/simulation.ts';

const percussion = (type: PercussionKind, strength = 0.8, id = `${type}-test`): AudioEvent => ({
  type, strength, id, time: 1,
});
const input = (events: readonly AudioEvent[] = [], playing = true): BumperCarsInput => ({
  percussionAvailable: true, transportPlaying: playing, events,
});
const body = (overrides: Partial<BumperBodyState> = {}): BumperBodyState => ({
  id: 0, x: 100, y: 100, width: 54, height: 34,
  vx: 0, vy: 0, angle: 0, angularVelocity: 0, ...overrides,
});

test('kick produces a strong bounded actor-local impulse', () => {
  const simulation = createBumperCarsSimulation({ initialBodies: [body()] });
  simulation.accept(input([percussion('kick', 1)]), 0);
  const state = simulation.read();
  assert.equal(state.latestPercussion, 'kick');
  assert.equal(state.selectedBody, 0);
  assert.ok(Math.hypot(state.bodies[0].vx, state.bodies[0].vy) > 100);
  assert.ok(Math.hypot(state.bodies[0].vx, state.bodies[0].vy) <= BUMPER_MAX_SPEED);
});

test('snare has a distinct lateral and stronger angular impulse class', () => {
  const kick = createBumperCarsSimulation({ initialBodies: [body()] });
  const snare = createBumperCarsSimulation({ initialBodies: [body()] });
  kick.accept(input([percussion('kick')]), 0);
  snare.accept(input([percussion('snare')]), 0);
  assert.ok(Math.abs(snare.read().bodies[0].angularVelocity) > Math.abs(kick.read().bodies[0].angularVelocity));
  assert.ok(Math.hypot(snare.read().bodies[0].vx, snare.read().bodies[0].vy)
    < Math.hypot(kick.read().bodies[0].vx, kick.read().bodies[0].vy));
});

test('hat produces a smaller perturbation than kick', () => {
  const kick = createBumperCarsSimulation({ initialBodies: [body()] });
  const hat = createBumperCarsSimulation({ initialBodies: [body()] });
  kick.accept(input([percussion('kick')]), 0);
  hat.accept(input([percussion('hat')]), 0);
  assert.ok(hat.read().kineticActivity < kick.read().kineticActivity);
});

test('repeated impulses remain speed limited', () => {
  const simulation = createBumperCarsSimulation({ initialBodies: [body()] });
  for (let index = 0; index < 20; index += 1) {
    simulation.accept(input([percussion('kick', 1, `kick-${index}`)]), 0);
  }
  assert.ok(simulation.read().bodies.every(item => Math.hypot(item.vx, item.vy) <= BUMPER_MAX_SPEED + 1e-9));
});

test('body collision corrects overlap and changes both velocities', () => {
  const simulation = createBumperCarsSimulation({ initialBodies: [
    body({ id: 0, x: 100, y: 100, vx: 70 }),
    body({ id: 1, x: 148, y: 104, vx: 0 }),
  ] });
  simulation.accept(input(), 0.02);
  const [first, second] = simulation.read().bodies;
  assert.ok(first.vx < 70);
  assert.ok(second.vx > 0);
  assert.ok(simulation.read().collisionCount > 0);
  assert.ok(Math.abs(second.x - first.x) >= 54);
});

test('wall collision keeps bodies inside the arena', () => {
  const simulation = createBumperCarsSimulation({ initialBodies: [body({ x: 20, y: 20, vx: -120, vy: -90 })] });
  simulation.accept(input(), 0.1);
  const result = simulation.read().bodies[0];
  assert.ok(result.x >= 33 && result.x <= 527);
  assert.ok(result.y >= 23 && result.y <= 257);
  assert.ok(result.vx >= 0 && result.vy >= 0);
});

test('damping reduces kinetic activity over time', () => {
  const simulation = createBumperCarsSimulation({ initialBodies: [body({ vx: 100, vy: 30, angularVelocity: 1 })] });
  const before = simulation.read().kineticActivity;
  for (let index = 0; index < 20; index += 1) simulation.accept(input(), 0.1);
  assert.ok(simulation.read().kineticActivity < before);
});

test('seek preserves physical state and does not apply skipped percussion', () => {
  const simulation = createBumperCarsSimulation({ initialBodies: [body({ vx: 40 })] });
  const before = simulation.read().bodies[0];
  simulation.accept(input([{ type: 'seek', from: 2, to: 10 }]), 0);
  assert.deepEqual(simulation.read().bodies[0], before);
  assert.equal(simulation.read().latestPercussion, null);
});

test('pause blocks new impulses while existing physical energy advances', () => {
  const simulation = createBumperCarsSimulation({ initialBodies: [body()] });
  simulation.accept(input([percussion('kick')]), 0);
  const kicked = simulation.read();
  simulation.accept(input([percussion('snare', 1)], false), 0.1);
  const paused = simulation.read();
  assert.equal(paused.latestPercussion, 'kick');
  assert.notEqual(paused.bodies[0].x, kicked.bodies[0].x);
  assert.ok(paused.kineticActivity < kicked.kineticActivity);
});

test('restart seek restores deterministic initial state', () => {
  const initial = createInitialBumperBodies();
  const simulation = createBumperCarsSimulation({ seed: 72, initialBodies: initial });
  simulation.accept(input([percussion('kick')]), 0.1);
  simulation.accept(input([{ type: 'seek', from: 4, to: 0 }], false), 0);
  assert.deepEqual(simulation.read().bodies, initial);
  assert.equal(simulation.read().mode, 'resting');
  assert.equal(simulation.read().latestPercussion, null);
});

test('same seed and input sequence reproduce actor state', () => {
  const first = createBumperCarsSimulation({ seed: 991 });
  const second = createBumperCarsSimulation({ seed: 991 });
  const sequence = [percussion('kick'), percussion('snare', 0.7), percussion('hat', 0.4)];
  for (const event of sequence) {
    first.accept(input([event]), 0.1);
    second.accept(input([event]), 0.1);
  }
  assert.deepEqual(first.read(), second.read());
});

test('reduced motion preserves event identity with restrained activity', () => {
  const full = createBumperCarsSimulation({ initialBodies: [body()] });
  const reduced = createBumperCarsSimulation({ initialBodies: [body()], reducedMotion: true });
  full.accept(input([percussion('snare')]), 0);
  reduced.accept(input([percussion('snare')]), 0);
  assert.equal(reduced.read().latestPercussion, 'snare');
  assert.ok(reduced.read().kineticActivity < full.read().kineticActivity * 0.1);
});
