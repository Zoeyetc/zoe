import assert from 'node:assert/strict';
import test from 'node:test';
import { milestoneOneAudioMap, milestoneTwoAudioMap, milestoneTwoBAudioMap, unavailableMelodyAudioMap } from '../src/audio/AudioMap.ts';
import { createAudioWorld, lookupSnapshot } from '../src/audio/AudioWorld.ts';
import type { TransportState } from '../src/audio/types.ts';

const transport = (time: number, playing = true): TransportState => ({ time, duration: 12, playing });

test('snapshot lookup is deterministic and handles unavailable melody', () => {
  assert.deepEqual(lookupSnapshot(milestoneOneAudioMap, transport(1.5)), lookupSnapshot(milestoneOneAudioMap, transport(1.5)));
  assert.equal(lookupSnapshot(milestoneOneAudioMap, transport(1.5)).melody.activeNote?.midi, 60);
  assert.deepEqual(lookupSnapshot(unavailableMelodyAudioMap, transport(1.5)).melody, { available: false, active: false, activeNote: null, noteProgress: 0 });
});

test('timeline crossing delivers each note event once even across a skipped frame', () => {
  const world = createAudioWorld(milestoneOneAudioMap);
  world.read(transport(0));
  const crossed = world.read(transport(2.4)).events;
  assert.deepEqual(crossed.map(event => event.type), ['note-on', 'note-off', 'note-on']);
  assert.deepEqual(world.read(transport(2.4)).events, []);
});

test('seek synchronizes without replaying historical note events', () => {
  const world = createAudioWorld(milestoneOneAudioMap);
  world.read(transport(0));
  const seek = world.synchronize(0, transport(6.5, false));
  assert.deepEqual(seek.events, [{ type: 'seek', from: 0, to: 6.5 }]);
  assert.equal(seek.snapshot.melody.activeNote?.id, 'g4-2');
  assert.deepEqual(world.read(transport(6.5, false)).events, []);
  assert.deepEqual(world.read(transport(7.3)).events.map(event => event.type), ['note-off']);
});

test('percussion events use timeline crossings and expose domain availability', () => {
  const world = createAudioWorld(milestoneTwoAudioMap);
  assert.equal(world.read(transport(0)).snapshot.percussion.available, true);
  const events = world.read(transport(3.4)).events;
  assert.deepEqual(
    events.filter(event => event.type === 'kick' || event.type === 'snare' || event.type === 'hat')
      .map(event => event.type),
    ['kick', 'snare', 'hat'],
  );
  assert.deepEqual(world.read(transport(3.4)).events, []);
});

test('seek across percussion skips history and resumes future events', () => {
  const world = createAudioWorld(milestoneTwoAudioMap);
  world.read(transport(0));
  assert.deepEqual(world.synchronize(0, transport(7.5, false)).events, [
    { type: 'seek', from: 0, to: 7.5 },
  ]);
  const resumed = world.read(transport(7.7)).events;
  assert.deepEqual(resumed.filter(event => event.type === 'hat').map(event => event.id), ['hat-return']);
});

test('rhythm snapshot separates steady BPM from authored groove and swing', () => {
  const straight = lookupSnapshot(milestoneTwoBAudioMap, { time: 2.125, duration: 20, playing: true }).rhythm;
  const transition = lookupSnapshot(milestoneTwoBAudioMap, { time: 6.125, duration: 20, playing: true }).rhythm;
  const swung = lookupSnapshot(milestoneTwoBAudioMap, { time: 10.125, duration: 20, playing: true }).rhythm;
  assert.equal(straight.bpm, 120);
  assert.equal(transition.bpm, 120);
  assert.equal(swung.bpm, 120);
  assert.equal(straight.beatPhase, transition.beatPhase);
  assert.equal(transition.beatPhase, swung.beatPhase);
  assert.ok(straight.swing < transition.swing && transition.swing < swung.swing);
  assert.ok(straight.groove < transition.groove && transition.groove < swung.groove);
  assert.equal(lookupSnapshot(milestoneTwoBAudioMap, { time: 15, duration: 20, playing: true }).rhythm.bpm, null);
});
