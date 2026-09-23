import assert from 'node:assert/strict';
import test from 'node:test';
import { milestoneOneAudioMap, milestoneTwoAudioMap, milestoneTwoBAudioMap, unavailableMelodyAudioMap } from '../src/audio/AudioMap.ts';
import { createAudioWorld, lookupSnapshot } from '../src/audio/AudioWorld.ts';
import type { TransportState } from '../src/audio/types.ts';

const transport = (time: number, playing = true): TransportState => ({ time, duration: 12, playing });

test('snapshot lookup is deterministic and handles unavailable melody', () => {
  assert.deepEqual(lookupSnapshot(milestoneOneAudioMap, transport(1.5)), lookupSnapshot(milestoneOneAudioMap, transport(1.5)));
  assert.equal(lookupSnapshot(milestoneOneAudioMap, transport(1.5)).melody.activeNote?.midi, 60);
  assert.deepEqual(lookupSnapshot(unavailableMelodyAudioMap, transport(1.5)).melody, {
    available: false, active: false, activeNote: null, noteProgress: 0,
    midi: null, pitchHz: null, noteName: null, intensity: 0, confidence: 0,
  });
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
    events.filter(event => event.type === 'kick' || event.type === 'snare' || event.type === 'closed-hat')
      .map(event => event.type),
    ['kick', 'snare', 'closed-hat'],
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
  assert.deepEqual(resumed.filter(event => event.type === 'closed-hat').map(event => event.id), ['hat-return']);
});

test('all six percussion roles use one timeline and multiple crossings deliver once', () => {
  const hits = [
    { id: 'k', time: 0.2, type: 'kick' as const, strength: 0.8 },
    { id: 's', time: 0.3, type: 'snare' as const, strength: 0.7 },
    { id: 'ch', time: 0.4, type: 'closed-hat' as const, strength: 0.5 },
    { id: 'oh', time: 0.5, type: 'open-hat' as const, strength: 0.6 },
    { id: 't', time: 0.6, type: 'tom' as const, strength: 0.75 },
    { id: 'o', time: 0.7, type: 'other-percussion' as const, strength: 0.55 },
  ];
  const map = { ...milestoneOneAudioMap, id: 'six-role-timeline',
    capabilities: { ...milestoneOneAudioMap.capabilities, percussion: true }, percussion: hits };
  const world = createAudioWorld(map);
  world.read(transport(0));
  const frame = world.read(transport(0.8));
  assert.deepEqual(frame.events.map(event => event.type), hits.map(hit => hit.type));
  assert.deepEqual(world.read(transport(0.8)).events, []);
  assert.equal(frame.snapshot.percussion.available, true);
  assert.ok(frame.snapshot.percussion.activity >= 0 && frame.snapshot.percussion.activity <= 1);
});

test('pause does not advance percussion cursor and restart permits beginning events again', () => {
  const world = createAudioWorld(milestoneTwoAudioMap);
  world.read(transport(0));
  assert.deepEqual(world.read(transport(0, false)).events, []);
  assert.equal(world.read(transport(1)).events.filter(event => event.type === 'kick').length, 1);
  world.synchronize(1, transport(0, false));
  assert.equal(world.read(transport(1)).events.filter(event => event.type === 'kick').length, 1);
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

test('authored harmony lookup exposes sustained major/minor regions and final inactivity', () => {
  assert.equal(lookupSnapshot(milestoneTwoBAudioMap, { time: 2, duration: 20, playing: true }).harmony.chord, 'C major');
  assert.deepEqual(lookupSnapshot(milestoneTwoBAudioMap, { time: 6, duration: 20, playing: true }).harmony.pitchClasses, [9, 0, 4]);
  assert.equal(lookupSnapshot(milestoneTwoBAudioMap, { time: 10, duration: 20, playing: true }).harmony.rootPitchClass, 5);
  assert.deepEqual(lookupSnapshot(milestoneTwoBAudioMap, { time: 17, duration: 20, playing: true }).harmony, {
    available: true, active: false, chord: null, rootPitchClass: null, pitchClasses: [], confidence: 0,
  });
});

test('chord changes use timeline crossings and seek does not replay skipped harmony', () => {
  const world = createAudioWorld(milestoneTwoBAudioMap);
  world.read({ time: 0, duration: 20, playing: true });
  const crossed = world.read({ time: 13, duration: 20, playing: true }).events
    .filter(event => event.type === 'chord-change');
  assert.deepEqual(crossed.map(event => event.harmony?.chord), ['A minor', 'F major', 'G major']);
  const seek = world.synchronize(13, { time: 6, duration: 20, playing: false });
  assert.deepEqual(seek.events, [{ type: 'seek', from: 13, to: 6 }]);
  assert.equal(seek.snapshot.harmony.chord, 'A minor');
});

test('authored structure exposes build, hold, release, and settling snapshots', () => {
  const rest = lookupSnapshot(milestoneTwoBAudioMap, { time: 2, duration: 20, playing: true }).structure;
  const build = lookupSnapshot(milestoneTwoBAudioMap, { time: 7, duration: 20, playing: true }).structure;
  const hold = lookupSnapshot(milestoneTwoBAudioMap, { time: 12.5, duration: 20, playing: true }).structure;
  const release = lookupSnapshot(milestoneTwoBAudioMap, { time: 14, duration: 20, playing: true }).structure;
  assert.equal(rest.section, 'rest');
  assert.equal(build.section, 'build');
  assert.ok(build.build > rest.build && build.tension > rest.tension);
  assert.equal(hold.section, 'hold');
  assert.equal(hold.tension, 1);
  assert.equal(release.section, 'release');
  assert.ok(release.energy > hold.energy);
});

test('drop is a discrete crossing and seek after it does not replay release', () => {
  const world = createAudioWorld(milestoneTwoBAudioMap);
  world.read({ time: 12.8, duration: 20, playing: true });
  const crossed = world.read({ time: 13.1, duration: 20, playing: true }).events;
  assert.deepEqual(crossed.filter(event => event.type === 'drop').map(event => event.id), ['major-drop']);
  const seek = world.synchronize(13.1, { time: 15, duration: 20, playing: false });
  assert.deepEqual(seek.events, [{ type: 'seek', from: 13.1, to: 15 }]);
  assert.equal(seek.snapshot.structure.section, 'release');
});

test('Milestone 6A fixture exposes a distinct continuous long-form phrase contour', async () => {
  const { milestoneSixAAudioMap } = await import('../src/audio/AudioMap.ts');
  const early = lookupSnapshot(milestoneSixAAudioMap, { time: 5, duration: 24, playing: true }).structure;
  const crest = lookupSnapshot(milestoneSixAAudioMap, { time: 13.5, duration: 24, playing: true }).structure;
  const release = lookupSnapshot(milestoneSixAAudioMap, { time: 17, duration: 24, playing: true }).structure;
  const ending = lookupSnapshot(milestoneSixAAudioMap, { time: 23.5, duration: 24, playing: true }).structure;
  assert.equal(early.section, 'development');
  assert.equal(crest.section, 'crest');
  assert.ok(crest.tension > early.tension);
  assert.equal(release.section, 'phrase-release');
  assert.ok(release.energy > crest.energy);
  assert.ok(ending.phraseProgress > release.phraseProgress);
  assert.ok(ending.energy < release.energy);
});

test('Milestone 7A fixture exposes authored continuous spectrum evidence', async () => {
  const { milestoneSevenAAudioMap } = await import('../src/audio/AudioMap.ts');
  const calm = lookupSnapshot(milestoneSevenAAudioMap, { time: 2, duration: 24, playing: true }).spectrum;
  const bright = lookupSnapshot(milestoneSevenAAudioMap, { time: 7, duration: 24, playing: true }).spectrum;
  const textured = lookupSnapshot(milestoneSevenAAudioMap, { time: 11, duration: 24, playing: true }).spectrum;
  const settling = lookupSnapshot(milestoneSevenAAudioMap, { time: 23.5, duration: 24, playing: true }).spectrum;
  assert.equal(calm.available, true);
  assert.ok(bright.brightness > calm.brightness);
  assert.ok(textured.texture > bright.texture);
  assert.ok(settling.brightness < bright.brightness);
  assert.ok(settling.texture < textured.texture);
});
