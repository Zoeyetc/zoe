import assert from 'node:assert/strict';
import test from 'node:test';
import { milestoneTwoBZlandAudioMap } from '../apps/zland/src/audio/ZlandAudioMaps.ts';
import { lookupSnapshot } from '../apps/zland/src/audio/AudioWorld.ts';
import type { AudioFrame } from '../apps/zland/src/audio/types.ts';
import { toPirateShipInput, type PirateShipInput } from '../apps/zland/src/rides/pirate-ship/adapter.ts';
import {
  PIRATE_MAX_ANGLE,
  PIRATE_MAX_ANGULAR_VELOCITY,
  createPirateShipSimulation,
  warpBeatPhase,
} from '../apps/zland/src/rides/pirate-ship/simulation.ts';

const rhythmInput = (overrides: Partial<PirateShipInput> = {}): PirateShipInput => ({
  rhythmAvailable: true,
  bpm: 120,
  beatPhase: 0.25,
  barPhase: 0.3,
  groove: 0.4,
  swing: 0.1,
  transportPlaying: true,
  seek: false,
  restart: false,
  ...overrides,
});

test('adapter consumes continuous rhythm snapshot and ignores percussion events', () => {
  const snapshot = lookupSnapshot(milestoneTwoBZlandAudioMap, { time: 2.125, duration: 20, playing: true });
  const withoutEvent: AudioFrame = { snapshot, events: [] };
  const withKick: AudioFrame = {
    snapshot,
    events: [{ type: 'kick', time: 2.125, id: 'ignored-kick', strength: 1 }],
  };
  assert.deepEqual(toPirateShipInput(withKick), toPirateShipInput(withoutEvent));
  assert.equal(toPirateShipInput(withKick).beatPhase, snapshot.rhythm.beatPhase);
});

test('same BPM with different swing and groove produces different continuous drive', () => {
  const straight = createPirateShipSimulation();
  const swung = createPirateShipSimulation();
  straight.accept(rhythmInput({ beatPhase: 0.62, groove: 0.18, swing: 0.04 }), 0.1);
  swung.accept(rhythmInput({ beatPhase: 0.62, groove: 0.82, swing: 0.68 }), 0.1);
  assert.equal(straight.read().bpm, swung.read().bpm);
  assert.notEqual(straight.read().targetPhase, swung.read().targetPhase);
  assert.notEqual(straight.read().driveTorque, swung.read().driveTorque);
});

test('beat phase changes target and torque without directly assigning angle', () => {
  const early = createPirateShipSimulation();
  const late = createPirateShipSimulation();
  early.accept(rhythmInput({ beatPhase: 0.2 }), 0.05);
  late.accept(rhythmInput({ beatPhase: 0.7 }), 0.05);
  assert.notEqual(early.read().targetPhase, late.read().targetPhase);
  assert.notEqual(early.read().driveTorque, late.read().driveTorque);
  assert.notEqual(early.read().angle, early.read().targetPhase);
});

test('swing phase warp is continuous and temporally asymmetric', () => {
  assert.equal(warpBeatPhase(0, 0.8), 0);
  assert.ok(warpBeatPhase(0.5, 0.8) < 0.5);
  assert.ok(warpBeatPhase(0.9, 0.8) > 0.5);
  assert.ok(warpBeatPhase(0.999999, 0.8) < 1);
});

test('pendulum angle and angular velocity remain bounded', () => {
  const simulation = createPirateShipSimulation({ initialAngle: 2, initialAngularVelocity: 20 });
  for (let index = 0; index < 300; index += 1) {
    simulation.accept(rhythmInput({ beatPhase: (index * 0.071) % 1, groove: 1, swing: 1 }), 0.05);
  }
  assert.ok(Math.abs(simulation.read().angle) <= PIRATE_MAX_ANGLE + 1e-9);
  assert.ok(Math.abs(simulation.read().angularVelocity) <= PIRATE_MAX_ANGULAR_VELOCITY + 1e-9);
});

test('damping reduces motion when musical drive is absent', () => {
  const simulation = createPirateShipSimulation({ initialAngle: 0.42, initialAngularVelocity: 1.2 });
  const before = Math.abs(simulation.read().angle) + Math.abs(simulation.read().angularVelocity);
  for (let index = 0; index < 120; index += 1) {
    simulation.accept(rhythmInput({ rhythmAvailable: false, bpm: null, transportPlaying: false }), 0.05);
  }
  const after = Math.abs(simulation.read().angle) + Math.abs(simulation.read().angularVelocity);
  assert.ok(after < before);
});

test('pause removes musical drive while physical motion continues', () => {
  const simulation = createPirateShipSimulation();
  for (let index = 0; index < 12; index += 1) {
    simulation.accept(rhythmInput({ beatPhase: (index * 0.2) % 1 }), 0.05);
  }
  const active = simulation.read();
  simulation.accept(rhythmInput({ transportPlaying: false }), 0.1);
  const paused = simulation.read();
  assert.equal(paused.mode, 'settling');
  assert.notEqual(paused.angle, active.angle);
  assert.ok(paused.driveAmplitude < active.driveAmplitude);
});

test('seek updates rhythm target without replaying or teleporting physical state', () => {
  const simulation = createPirateShipSimulation({ initialAngle: 0.2, initialAngularVelocity: 0.4 });
  const before = simulation.read();
  simulation.accept(rhythmInput({ beatPhase: 0.78, swing: 0.6, seek: true }), 0);
  const after = simulation.read();
  assert.equal(after.angle, before.angle);
  assert.equal(after.angularVelocity, before.angularVelocity);
  assert.equal(after.targetPhase, warpBeatPhase(0.78, 0.6));
});

test('restart restores deterministic actor-local initial state', () => {
  const simulation = createPirateShipSimulation();
  simulation.accept(rhythmInput(), 0.1);
  simulation.accept(rhythmInput({ beatPhase: 0, barPhase: 0, seek: true, restart: true }), 0);
  const state = simulation.read();
  assert.equal(state.angle, 0);
  assert.equal(state.angularVelocity, 0);
  assert.equal(state.driveTorque, 0);
  assert.equal(state.driveAmplitude, 0);
});

test('reduced motion substantially limits angular travel while preserving phase identity', () => {
  const full = createPirateShipSimulation();
  const reduced = createPirateShipSimulation({ reducedMotion: true });
  for (let index = 0; index < 160; index += 1) {
    const current = rhythmInput({ beatPhase: (index * 0.09) % 1, groove: 0.8, swing: 0.65 });
    full.accept(current, 0.05);
    reduced.accept(current, 0.05);
  }
  assert.equal(reduced.read().targetPhase, full.read().targetPhase);
  assert.ok(Math.abs(reduced.read().angle) < PIRATE_MAX_ANGLE * 0.15);
  assert.ok(reduced.read().driveAmplitude < full.read().driveAmplitude * 0.15);
});

test('bounded substeps produce comparable state under reasonable dt sizes', () => {
  const fine = createPirateShipSimulation();
  const coarse = createPirateShipSimulation();
  for (let time = 0; time < 2 - 1e-9; time += 0.01) {
    fine.accept(rhythmInput({ beatPhase: (time * 2) % 1 }), 0.01);
  }
  for (let time = 0; time < 2 - 1e-9; time += 0.02) {
    coarse.accept(rhythmInput({ beatPhase: (time * 2) % 1 }), 0.02);
  }
  assert.ok(Math.abs(fine.read().angle - coarse.read().angle) < 0.05);
  assert.ok(Math.abs(fine.read().angularVelocity - coarse.read().angularVelocity) < 0.12);
});
