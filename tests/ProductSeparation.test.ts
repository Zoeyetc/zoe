import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createListeningTimeline, type ListeningMap } from '@computational-listening/engine';
import { createExperience } from '../apps/zland/src/createExperience.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const zoe = read('../apps/zoe/src/ZoeApp.tsx');
const zlandApp = read('../apps/zland/src/App.tsx');
const zlandExperience = read('../apps/zland/src/createExperience.ts');
const instrumentUi = [
  read('../packages/listening-instrument-ui/src/signal-player/SignalPlayer.tsx'),
  read('../packages/listening-instrument-ui/src/signal-console/SignalConsole.tsx'),
  read('../packages/listening-instrument-ui/src/contracts.ts'),
].join('\n');

const emptyListeningMap: ListeningMap = {
  version: 1,
  duration: 2,
  capabilities: { melody: false, rhythm: false, percussion: false, harmony: false,
    tonalCenter: false, structure: false, spectrum: false },
  melody: null,
  percussion: null,
  rhythm: null,
  harmony: null,
  spectrum: null,
};

test('Zoë composes file, live, timeline, and Instrument UI without Z.land', () => {
  assert.match(zoe, /analyzePcmListeningAsync/);
  assert.match(zoe, /createAudioBufferPlaybackTransport/);
  assert.match(zoe, /createLiveAudioInputController/);
  assert.match(zoe, /createListeningTimeline/);
  assert.match(zoe, /<SignalPlayer/);
  assert.match(zoe, /selectMelodyEvidenceForTransport/);
  assert.doesNotMatch(zoe, /AudioWorld|ZlandListeningAdapter|ZlandAuthoredOverlay|rides|PhysicsWorld|apps\/zland/);
  const timeline = createListeningTimeline(emptyListeningMap, 'zoe-test');
  assert.deepEqual(timeline.read(0.5).snapshot.capabilities, emptyListeningMap.capabilities);
});

test('Instrument UI owns generic listening presentation without either product', () => {
  assert.doesNotMatch(instrumentUi, /apps\/(?:zoe|zland)|AudioWorld|ZlandListeningAdapter|ZlandAuthoredOverlay|rides|PhysicsWorld/);
});

test('Z.land composes rides and authored listening without loading Zoë', () => {
  assert.match(zlandApp, /CarouselView/);
  assert.match(zlandApp, /FerrisWheelView/);
  assert.match(zlandApp, /DropTowerView/);
  assert.match(zlandApp, /RollerCoasterView/);
  assert.match(zlandExperience, /createAudioWorld/);
  assert.doesNotMatch(zlandApp + zlandExperience, /apps\/zoe|@computational-listening\/zoe|ZoeApp/);
  const experience = createExperience(() => 0, true);
  const state = experience.read();
  assert.ok(state.carousel && state.ferrisWheel && state.dropTower && state.rollerCoaster && state.physics);
  experience.dispose();
});
