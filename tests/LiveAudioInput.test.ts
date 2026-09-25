import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RollingPcmBuffer } from '@computational-listening/engine';
import {
  createLiveAudioClock, createLiveAudioInputController, createLiveRollingAnalyzer,
  LIVE_EVENT_BUFFER_CAP, LIVE_INPUT_WINDOW_SECONDS,
} from '../src/audio-source-browser/index.ts';

test('rolling PCM uses arithmetic-mean channels and remains strictly bounded', () => {
  const buffer = new RollingPcmBuffer(10, 1);
  buffer.push([Float32Array.from({ length: 15 }, (_, index) => index),
    Float32Array.from({ length: 15 }, (_, index) => index + 2)]);
  assert.equal(buffer.capacity, 10);
  assert.equal(buffer.length, 10);
  assert.equal(buffer.byteLength, 40);
  assert.deepEqual([...buffer.snapshot()], [6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  assert.equal(buffer.totalDuration, 1.5);
});

test('live clock is monotonic, freezes on stop, and a new session starts at zero', () => {
  let now = 10;
  const clock = createLiveAudioClock(() => now);
  assert.deepEqual(clock.read(), { time: 0, duration: 1, playing: true });
  now = 13.25;
  assert.equal(clock.read().time, 3.25);
  clock.stop(); now = 20;
  assert.deepEqual(clock.read(), { time: 3.25, duration: 3.25, playing: false });
  const next = createLiveAudioClock(() => now);
  assert.equal(next.read().time, 0);
});

test('deterministic injected PCM produces bounded rolling evidence without live Structure', async () => {
  const sampleRate = 12_000;
  const duration = 2.5;
  const pcm = Float32Array.from({ length: sampleRate * duration }, (_, index) =>
    Math.sin(2 * Math.PI * 440 * index / sampleRate) * 0.35);
  let resolveUpdate!: (value: Parameters<Parameters<typeof createLiveRollingAnalyzer>[0]['onUpdate']>[0]) => void;
  const update = new Promise<Parameters<Parameters<typeof createLiveRollingAnalyzer>[0]['onUpdate']>[0]>(resolve => {
    resolveUpdate = resolve;
  });
  const analyzer = createLiveRollingAnalyzer({
    sampleRate, sessionId: 'test', deviceId: 'known', deviceLabel: 'Test input', channelCount: 1,
    baseLatency: 0.01, outputLatency: null,
    readTransport: () => ({ time: duration, duration: duration + 1, playing: true }),
    onUpdate: resolveUpdate,
  });
  analyzer.push([pcm]);
  const result = await update;
  assert.equal(result.source.kind, 'live-input');
  assert.equal(result.map.structureAnalysis, null);
  assert.equal(result.map.capabilities.structure, false);
  assert.equal(result.state.listeners.structure.state, 'UNAVAILABLE_LIVE');
  assert.ok(result.map.amplitude?.length);
  assert.ok(result.map.spectrum?.length);
  assert.ok(result.map.melodyEvidence?.frameCount);
  assert.ok(result.state.rollingPcmBytes <= sampleRate * LIVE_INPUT_WINDOW_SECONDS * 4);
  assert.ok(result.state.retainedEventCount <= LIVE_EVENT_BUFFER_CAP);
  assert.equal(result.map.analysis?.downmix, 'arithmetic-mean');
  analyzer.stop();
});

test('backpressure retains at most running work plus one newest rerun request', async () => {
  let release!: () => void;
  const wait = new Promise<void>(resolve => { release = resolve; });
  const updates: unknown[] = [];
  const analyzer = createLiveRollingAnalyzer({
    sampleRate: 10, sessionId: 'pressure', deviceId: null, deviceLabel: null, channelCount: 1,
    baseLatency: null, outputLatency: null,
    readTransport: () => ({ time: 2, duration: 3, playing: true }),
    analyze: async () => {
      await wait;
      return {
        version: 1, id: 'empty', duration: 1,
        capabilities: { melody: false, rhythm: false, percussion: false, harmony: false,
          tonalCenter: false, structure: false, spectrum: true },
        melody: null, percussion: null, rhythm: null, harmony: null, structure: null, drops: null,
        spectrum: [], amplitude: [],
      };
    },
    onUpdate: update => updates.push(update),
  });
  analyzer.push([new Float32Array(6)]);
  analyzer.push([new Float32Array(6)]);
  analyzer.push([new Float32Array(6)]);
  assert.ok(analyzer.diagnostics().droppedAnalysisRequests >= 1);
  assert.equal(analyzer.diagnostics().rollingPcmBytes, 10 * LIVE_INPUT_WINDOW_SECONDS * 4);
  release();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(updates.length <= 2);
  analyzer.stop();
});

test('permission lifecycle, device replacement, stop, and device loss clean up capture', async () => {
  const listeners = new Map<string, EventListener>();
  const tracks: Array<{ stopped: boolean; label: string; deviceId: string }> = [];
  let devices = [{ kind: 'audioinput', deviceId: 'a', label: '' },
    { kind: 'audioinput', deviceId: 'b', label: 'Loopback' }];
  const mediaDevices = {
    async enumerateDevices() { return devices as MediaDeviceInfo[]; },
    async getUserMedia(constraints: MediaStreamConstraints) {
      const exact = (constraints.audio as MediaTrackConstraints).deviceId as ConstrainDOMStringParameters | undefined;
      const deviceId = typeof exact === 'object' && exact?.exact ? String(exact.exact) : 'a';
      const track = { stopped: false, label: deviceId === 'b' ? 'Loopback' : '', deviceId,
        stop() { this.stopped = true; }, getSettings() { return { deviceId, channelCount: 2 }; } };
      tracks.push(track);
      return { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
    },
    addEventListener(type: string, listener: EventListener) { listeners.set(type, listener); },
    removeEventListener(type: string) { listeners.delete(type); },
  };
  const contexts: Array<{ closed: boolean }> = [];
  const states: string[] = [];
  let emitAnalysis: Parameters<typeof createLiveRollingAnalyzer>[0]['onUpdate'] | null = null;
  const controller = createLiveAudioInputController({
    secureContext: true, mediaDevices: mediaDevices as unknown as MediaDevices,
    createContext: () => {
      const record = { closed: false }; contexts.push(record);
      return { sampleRate: 48_000, state: 'running', baseLatency: 0.012,
        audioWorklet: { addModule: async () => undefined },
        createMediaStreamSource: () => ({ channelCount: 2, connect() {}, disconnect() {} }),
        close: async () => { record.closed = true; }, resume: async () => undefined,
      } as unknown as AudioContext;
    },
    createCaptureNode: () => ({ port: { onmessage: null }, disconnect() {} } as unknown as AudioWorkletNode),
    createAnalyzer: ((analyzerOptions: Parameters<typeof createLiveRollingAnalyzer>[0]) => {
      emitAnalysis = analyzerOptions.onUpdate;
      return { push() {}, analyzeNow: async () => undefined,
        diagnostics: () => ({ capacitySamples: 1, bufferedSamples: 0, rollingPcmBytes: 4,
          retainedEventCount: 0, droppedAnalysisRequests: 0 }), stop() {} };
    }) as typeof createLiveRollingAnalyzer,
    onState: state => states.push(state.status), onAnalysis() {},
  });
  await controller.refreshDevices();
  assert.equal(controller.read().devices[0].labelAvailable, false);
  await controller.start('a');
  assert.equal(controller.read().status, 'LIVE');
  await controller.selectDevice('b');
  assert.equal(tracks[0].stopped, true);
  assert.equal(contexts[0].closed, true);
  assert.equal(controller.read().deviceLabel, 'Loopback');
  const listenersBeforeLoss = { ...controller.read().listeners,
    rhythm: { state: 'SEARCHING' as const, elapsed: 5, required: 4 } };
  emitAnalysis?.({
    sessionId: '2', source: { kind: 'live-input', filename: null, mimeType: 'audio/x-live-input' },
    map: { version: 1, duration: 5,
      capabilities: { melody: false, rhythm: false, percussion: false, harmony: false,
        tonalCenter: false, structure: false, spectrum: true },
      melody: null, percussion: null, rhythm: null, harmony: null,
      spectrum: [], amplitude: [] },
    transport: { time: 5, duration: 6, playing: true }, events: [],
    state: { ...controller.read(), listeners: listenersBeforeLoss },
  });
  devices = [{ kind: 'audioinput', deviceId: 'a', label: 'Built-in' }];
  listeners.get('devicechange')?.(new Event('devicechange'));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(controller.read().status, 'DEVICE_LOST');
  assert.equal(controller.read().listeners.rhythm.state, 'SEARCHING');
  assert.equal(tracks[1].stopped, true);
  assert.ok(states.includes('REQUESTING'));
  await controller.dispose();
});

test('permission denial remains explicit and never retries capture automatically', async () => {
  let requests = 0;
  const mediaDevices = {
    async enumerateDevices() { return []; },
    async getUserMedia() { requests += 1; throw new DOMException('Permission denied', 'NotAllowedError'); },
    addEventListener() {}, removeEventListener() {},
  };
  const controller = createLiveAudioInputController({
    secureContext: true, mediaDevices: mediaDevices as unknown as MediaDevices,
    createCaptureNode: () => ({} as AudioWorkletNode), onState() {}, onAnalysis() {},
  });
  await controller.start(null);
  assert.equal(controller.read().status, 'DENIED');
  assert.equal(requests, 1);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(requests, 1);
  await controller.dispose();
});

test('stopping during permission request discards a late microphone stream', async () => {
  let resolveCapture: ((stream: MediaStream) => void) | undefined;
  let stopped = false;
  const mediaDevices = {
    async enumerateDevices() { return []; },
    getUserMedia() { return new Promise<MediaStream>(resolve => { resolveCapture = resolve; }); },
    addEventListener() {}, removeEventListener() {},
  };
  const controller = createLiveAudioInputController({
    secureContext: true, mediaDevices: mediaDevices as unknown as MediaDevices,
    createCaptureNode: () => ({} as AudioWorkletNode), onState() {}, onAnalysis() {},
  });
  const starting = controller.start(null);
  await Promise.resolve();
  assert.equal(controller.read().status, 'REQUESTING');
  await controller.stop();
  assert.equal(controller.read().status, 'STOPPED');
  assert.ok(resolveCapture);
  resolveCapture({ getTracks: () => [{ stop() { stopped = true; } }] } as unknown as MediaStream);
  await starting;
  assert.equal(stopped, true);
  assert.equal(controller.read().status, 'STOPPED');
  await controller.dispose();
});

test('SignalPlayer exposes truthful compact live grammar without file transport controls', () => {
  const playback = readFileSync(new URL('../src/instrument-ui/signal-player/SignalPlayback.tsx', import.meta.url), 'utf8');
  const player = readFileSync(new URL('../src/instrument-ui/signal-player/SignalPlayer.tsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/ZoeApp.tsx', import.meta.url), 'utf8');
  const telemetry = readFileSync(new URL('../src/instrument-ui/signal-console/signalTelemetry.ts', import.meta.url), 'utf8');
  assert.match(playback, /audio\.input\(/);
  assert.match(playback, /\[LIVE\]/);
  assert.match(playback, /\[STOP\]/);
  assert.match(playback, /liveMode \? <button[\s\S]*\[STOP\][\s\S]*: <>[\s\S]*\[PLAY\][\s\S]*\[PAUSE\][\s\S]*\[RESTART\]/);
  assert.match(playback, /aria-label="Input device"/);
  assert.match(playback, /aria-label="Live session time"/);
  const worklet = readFileSync(new URL('../src/audio-source-browser/live/livePcmWorklet.ts', import.meta.url), 'utf8');
  assert.match(worklet, /this\.inFlight = true/);
  assert.match(worklet, /type === 'consumed'/);
  assert.doesNotMatch(playback, /SYSTEM AUDIO|Spotify|Apple Music/);
  assert.match(player, /liveInput: LiveInputState/);
  assert.match(app, /createLiveAudioInputController/);
  assert.match(app, /fileMapRef/);
  assert.match(telemetry, /UNAVAILABLE LIVE/);
  assert.match(telemetry, /WARMING UP/);
  assert.match(telemetry, /ROLLING 12\.0 S/);
});
