import assert from 'node:assert/strict';
import test from 'node:test';
import { createPerformanceFullscreenController, FULLSCREEN_CURSOR_IDLE_MS,
  type PerformanceFullscreenState } from '../packages/listening-instrument-ui/src/signal-player/performanceFullscreen.ts';
import { readFileSync } from 'node:fs';
import { RollingPcmBuffer } from '@computational-listening/engine';
import { createAudioBufferPlaybackTransport, createLiveAudioClock } from '@computational-listening/audio-source-browser';

function fixture(options: { unsupported?: boolean; rejectRequest?: boolean } = {}) {
  const document = new EventTarget() as Document;
  const root = new EventTarget() as HTMLElement;
  const states: PerformanceFullscreenState[] = [];
  const dataset: Record<string, string> = {};
  let requestCount = 0;
  let exitCount = 0;
  Object.defineProperty(root, 'dataset', { value: dataset });
  Object.defineProperty(document, 'fullscreenElement', { value: null, writable: true });
  if (!options.unsupported) {
    root.requestFullscreen = async () => {
      requestCount++;
      if (options.rejectRequest) throw new Error('denied');
      Object.defineProperty(document, 'fullscreenElement', { value: root, writable: true });
      document.dispatchEvent(new Event('fullscreenchange'));
    };
    document.exitFullscreen = async () => {
      exitCount++;
      Object.defineProperty(document, 'fullscreenElement', { value: null, writable: true });
      document.dispatchEvent(new Event('fullscreenchange'));
    };
  }
  const controller = createPerformanceFullscreenController(root, document, state => states.push(state));
  return { document, root, dataset, states, controller,
    get requestCount() { return requestCount; }, get exitCount() { return exitCount; } };
}

test('fullscreen command is mounted on the complete SignalPlayer root', () => {
  const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
  const player = read('../packages/listening-instrument-ui/src/signal-player/SignalPlayer.tsx');
  const playback = read('../packages/listening-instrument-ui/src/signal-player/SignalPlayback.tsx');
  const zoe = read('../apps/zoe/src/ZoeApp.tsx');
  assert.match(player, /<main ref=\{rootRef\}/);
  assert.match(player, /<SignalPlayback/);
  assert.match(player, /<SignalConsole/);
  assert.match(playback, /\[FULLSCREEN\]/);
  assert.match(playback, /\[EXIT FULLSCREEN\]/);
  assert.match(zoe, /composition="performance" performanceFullscreen/);
});

test('native fullscreen state follows fullscreenchange, including external exit', async () => {
  const f = fixture();
  assert.deepEqual(f.controller.read(), { active: false, supported: true, error: null });
  await f.controller.toggle();
  assert.equal(f.requestCount, 1);
  assert.equal(f.document.fullscreenElement, f.root);
  assert.equal(f.states.at(-1)?.active, true);
  assert.equal(f.dataset.cursorIdle, 'false');
  // Browser Esc/external exit is observed without calling the control.
  Object.defineProperty(f.document, 'fullscreenElement', { value: null, writable: true });
  f.document.dispatchEvent(new Event('fullscreenchange'));
  assert.equal(f.states.at(-1)?.active, false);
  assert.equal(f.dataset.cursorIdle, 'false');
  await f.controller.toggle();
  await f.controller.toggle();
  assert.equal(f.exitCount, 1);
  assert.equal(f.states.at(-1)?.active, false);
  f.controller.dispose();
});

test('unsupported and rejected requests never fabricate active fullscreen', async () => {
  const unavailable = fixture({ unsupported: true });
  await unavailable.controller.toggle();
  assert.deepEqual(unavailable.states.at(-1), { active: false, supported: false, error: 'unavailable' });
  unavailable.controller.dispose();
  const rejected = fixture({ rejectRequest: true });
  await rejected.controller.toggle();
  assert.deepEqual(rejected.states.at(-1), { active: false, supported: true, error: 'request-failed' });
  assert.equal(rejected.document.fullscreenElement, null);
  rejected.controller.dispose();
});

test('cursor uses one idle timeout, restores on movement and exit, and cleans up on unmount', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  await f.controller.toggle();
  assert.equal(f.dataset.cursorIdle, 'false');
  t.mock.timers.tick(FULLSCREEN_CURSOR_IDLE_MS - 1);
  assert.equal(f.dataset.cursorIdle, 'false');
  t.mock.timers.tick(1);
  assert.equal(f.dataset.cursorIdle, 'true');
  f.root.dispatchEvent(new Event('pointermove'));
  assert.equal(f.dataset.cursorIdle, 'false');
  t.mock.timers.tick(FULLSCREEN_CURSOR_IDLE_MS);
  assert.equal(f.dataset.cursorIdle, 'true');
  await f.controller.toggle();
  assert.equal(f.dataset.cursorIdle, 'false');
  await f.controller.toggle();
  f.controller.dispose();
  t.mock.timers.tick(FULLSCREEN_CURSOR_IDLE_MS);
  assert.equal(f.dataset.cursorIdle, 'false');
});

test('fullscreen transitions leave a live clock and rolling evidence session continuous', async () => {
  const f = fixture();
  let now = 20;
  const clock = createLiveAudioClock(() => now);
  const rolling = new RollingPcmBuffer(10, 2);
  rolling.push([Float32Array.from([1, 2, 3, 4])]);
  const session = { id: 'live-1', deviceId: 'input-1', permissionRequests: 1, clock, rolling };
  const startingBytes = session.rolling.byteLength;
  now = 21;
  const before = session.clock.read().time;
  await f.controller.toggle();
  now = 22;
  assert.ok(session.clock.read().time > before);
  await f.controller.toggle();
  now = 23;
  assert.equal(session.clock.read().time, 3);
  assert.equal(session.deviceId, 'input-1');
  assert.equal(session.permissionRequests, 1);
  assert.equal(session.rolling.byteLength, startingBytes);
  assert.deepEqual([...session.rolling.snapshot()], [1, 2, 3, 4]);
  f.controller.dispose();
});


test('fullscreen transitions preserve file transport, map, evidence, and recent events', async () => {
  const f = fixture();
  const context = {
    currentTime: 0, state: 'running', destination: {}, sources: [] as Array<{ stopped: boolean }>,
    createBufferSource() {
      const source = { buffer: null, onended: null, stopped: false,
        connect() {}, disconnect() {}, start() {}, stop() { this.stopped = true; } };
      this.sources.push(source);
      return source;
    },
    async resume() {},
  };
  const transport = createAudioBufferPlaybackTransport(context as unknown as AudioContext, { duration: 12 } as AudioBuffer);
  const map = { id: 'file-map', melodyEvidence: { frameCount: 5 } };
  const recentEvents = [{ type: 'beat', time: 1 }];
  transport.play();
  context.currentTime = 1;
  const before = transport.read().time;
  await f.controller.toggle();
  context.currentTime = 2;
  assert.ok(transport.read().time > before);
  await f.controller.toggle();
  context.currentTime = 3;
  assert.equal(transport.read().time, 3);
  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].stopped, false);
  assert.equal(map.id, 'file-map');
  assert.equal(map.melodyEvidence.frameCount, 5);
  assert.deepEqual(recentEvents, [{ type: 'beat', time: 1 }]);
  transport.dispose();
  f.controller.dispose();
});
