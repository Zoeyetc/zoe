import assert from 'node:assert/strict';
import test from 'node:test';
import { lookupSnapshot } from '../src/audio/AudioWorld.ts';
import { milestoneSevenAAudioMap } from '../src/audio/AudioMap.ts';
import { createParkPulse, PARK_PULSE_SOURCE_ID } from '../src/physics/ParkPulse.ts';
import type { AudioFrame } from '../src/audio/types.ts';

function frame(time: number, beatPhase: number, playing = true, events: AudioFrame['events'] = []): AudioFrame {
  const snapshot = lookupSnapshot(milestoneSevenAAudioMap, {
    time, duration: milestoneSevenAAudioMap.duration, playing,
  });
  return {
    events,
    snapshot: {
      ...snapshot,
      rhythm: { ...snapshot.rhythm, available: true, bpm: 120, beatPhase, confidence: 0.9 },
    },
  };
}

test('Park Pulse interprets rhythm and exposes a bounded shared source', () => {
  const pulse = createParkPulse();
  pulse.accept(frame(0.4, 0.8), 0.1);
  pulse.accept(frame(0.5, 0), 0.1);
  const state = pulse.read();
  assert.equal(state.available, true);
  assert.equal(state.bpm, 120);
  assert.equal(state.pulseCount, 1);
  assert.equal(state.lastBeatTime, 0.5);
  assert.ok(state.sourceStrength > 0 && state.sourceStrength < 0.04);
  assert.equal(pulse.toPhysicsPulse(4).sourceId, PARK_PULSE_SOURCE_ID);
});

test('pause stops generation and seek resolves phase without replaying beat history', () => {
  const pulse = createParkPulse();
  pulse.accept(frame(0.4, 0.8), 0.1);
  pulse.accept(frame(0.5, 0, false), 0.1);
  assert.equal(pulse.read().pulseCount, 0);
  assert.equal(pulse.read().active, false);
  pulse.accept(frame(8, 0.1, true, [{ type: 'seek', from: 0.5, to: 8 }]), 0);
  assert.equal(pulse.read().pulseCount, 0);
  assert.equal(pulse.read().beatPhase, 0.1);
});

test('unavailable rhythm produces no fake pulse evidence', () => {
  const pulse = createParkPulse();
  const unavailable = frame(1, 0.1);
  pulse.accept({ snapshot: { ...unavailable.snapshot, rhythm: { ...unavailable.snapshot.rhythm, available: false, bpm: null } }, events: [] }, 0.1);
  assert.deepEqual(pulse.read(), {
    available: false, bpm: null, beatPhase: 0, rhythmConfidence: 0,
    envelope: 0, sourceStrength: 0, position: { x: 0.5, y: 0.54 }, radius: 0.78,
    lastBeatTime: null, pulseCount: 0, active: false, movementSource: 'none',
  });
});

test('reset clears pulse history and transient source state', () => {
  const pulse = createParkPulse();
  pulse.accept(frame(0.4, 0.8), 0.1);
  pulse.accept(frame(0.5, 0), 0.1);
  assert.equal(pulse.read().pulseCount, 1);
  pulse.reset();
  assert.equal(pulse.read().pulseCount, 0);
  assert.equal(pulse.read().lastBeatTime, null);
  assert.equal(pulse.read().active, false);
  assert.equal(pulse.read().sourceStrength, 0);
});
