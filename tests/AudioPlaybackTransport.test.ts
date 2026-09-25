import assert from 'node:assert/strict';
import test from 'node:test';
import { createAudioBufferPlaybackTransport, createMediaElementPlaybackTransport,
  shouldUseIPhoneSafariPlayback } from '../src/audio-source-browser/index.ts';

class MockSource {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;
  starts: Array<[number, number]> = [];
  stopped = 0;
  connected = false;
  destinations: unknown[] = [];
  start(when: number, offset: number) { this.starts.push([when, offset]); }
  stop() { this.stopped += 1; }
  connect(destination: unknown) { this.connected = true; this.destinations.push(destination); }
  disconnect() { this.connected = false; }
}

class MockContext {
  currentTime = 0;
  state: AudioContextState = 'running';
  destination = {};
  sources: MockSource[] = [];
  resumeCalls = 0;
  createBufferSource() { const source = new MockSource(); this.sources.push(source); return source; }
  async resume() { this.resumeCalls += 1; this.state = 'running'; }
}

const setup = (duration = 4) => {
  const context = new MockContext();
  const transport = createAudioBufferPlaybackTransport(
    context as unknown as AudioContext,
    { duration } as AudioBuffer,
  );
  return { context, transport };
};

test('play, pause, resume, seek and restart use fresh one-shot sources and exact offsets', () => {
  const { context, transport } = setup();
  transport.play();
  assert.equal(context.sources.length, 1);
  assert.deepEqual(context.sources[0].starts, [[0, 0]]);
  context.currentTime = 1.25;
  assert.equal(transport.read().time, 1.25);
  transport.pause();
  assert.deepEqual(transport.read(), { time: 1.25, duration: 4, playing: false });
  assert.equal(context.sources[0].stopped, 1);

  transport.play();
  assert.equal(context.sources.length, 2);
  assert.deepEqual(context.sources[1].starts, [[0, 1.25]]);
  context.currentTime = 1.75;
  transport.seek(3);
  assert.equal(context.sources.length, 3);
  assert.deepEqual(context.sources[2].starts, [[0, 3]]);
  assert.equal(context.sources.filter(source => source.connected).length, 1);
  assert.ok(context.sources.every(source => source.destinations.length === 1
    && source.destinations[0] === context.destination));

  transport.restart();
  assert.equal(context.sources.length, 4);
  assert.deepEqual(context.sources[3].starts, [[0, 0]]);
  assert.equal(transport.read().playing, true);
});

test('a suspended context cannot start a stale source after pause', async () => {
  const { context, transport } = setup();
  context.state = 'suspended';
  let resume!: () => void;
  (context as unknown as { resume: () => Promise<void> }).resume = () => new Promise<void>(resolve => {
    resume = () => { context.state = 'running'; resolve(); };
  });
  transport.play();
  transport.pause();
  resume();
  await Promise.resolve();
  assert.equal(context.sources.length, 0);
  assert.equal(transport.read().playing, false);
});

test('seek while paused preserves pause and natural completion stops without wrapping', () => {
  const { context, transport } = setup(2);
  transport.seek(0.75);
  assert.deepEqual(transport.read(), { time: 0.75, duration: 2, playing: false });
  transport.play();
  const active = context.sources.at(-1)!;
  active.onended?.();
  assert.deepEqual(transport.read(), { time: 2, duration: 2, playing: false });
  assert.equal(transport.diagnostics().sourceNodeState, 'ended');
  transport.play();
  assert.equal(context.sources.length, 1);
});

test('clock-observed completion clears playback intent before a paused restart', () => {
  const { context, transport } = setup(2);
  transport.play();
  context.currentTime = 2.1;
  assert.deepEqual(transport.read(), { time: 2, duration: 2, playing: false });
  transport.restart();
  assert.deepEqual(transport.read(), { time: 0, duration: 2, playing: false });
  assert.equal(context.sources.length, 1);
});

test('dispose disconnects the current source and prevents future playback', () => {
  const { context, transport } = setup();
  transport.play();
  transport.dispose();
  assert.equal(context.sources[0].connected, false);
  assert.equal(transport.diagnostics().sourceNodeState, 'disposed');
  transport.play();
  assert.equal(context.sources.length, 1);
});

test('iPhone Safari uses native media playback with the audible element clock', async () => {
  const media = {
    currentTime: 0, paused: true, ended: false, src: 'blob:test', playCalls: 0, loadCalls: 0,
    play() { this.playCalls += 1; this.paused = false; return Promise.resolve(); },
    pause() { this.paused = true; },
    removeAttribute(name: string) { if (name === 'src') this.src = ''; },
    load() { this.loadCalls += 1; },
  };
  let released = 0;
  const transport = createMediaElementPlaybackTransport(media as unknown as HTMLAudioElement, 8,
    () => { released += 1; });
  transport.play();
  assert.equal(media.playCalls, 1);
  media.currentTime = 2.4;
  assert.deepEqual(transport.read(), { time: 2.4, duration: 8, playing: true });
  transport.pause();
  assert.deepEqual(transport.read(), { time: 2.4, duration: 8, playing: false });
  transport.seek(5);
  assert.equal(media.currentTime, 5);
  transport.restart();
  assert.equal(media.currentTime, 0);
  transport.dispose();
  transport.dispose();
  assert.equal(media.src, '');
  assert.equal(media.loadCalls, 1);
  assert.equal(released, 1);
  transport.play();
  assert.equal(media.playCalls, 1);
});

test('native playback is limited to iPhone Safari; desktop keeps Web Audio', () => {
  assert.equal(shouldUseIPhoneSafariPlayback('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'), true);
  assert.equal(shouldUseIPhoneSafariPlayback('Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/605.1.15 Safari/605.1.15'), false);
  assert.equal(shouldUseIPhoneSafariPlayback('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/126.0 Mobile/15E148 Safari/604.1'), false);
});

test('a rejected media play request never reports playback', async () => {
  const media = {
    currentTime: 0, paused: true, ended: false,
    play: () => Promise.reject(new Error('gesture required')),
    pause() {}, removeAttribute() {}, load() {},
  };
  const transport = createMediaElementPlaybackTransport(media as unknown as HTMLAudioElement, 3, () => {});
  transport.play();
  await Promise.resolve();
  assert.equal(transport.read().playing, false);
});
