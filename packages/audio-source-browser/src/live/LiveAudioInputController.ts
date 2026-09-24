import { createLiveAudioClock } from './LiveAudioClock.ts';
import { createLiveRollingAnalyzer } from './LiveRollingAnalyzer.ts';
import { createLivePcmWorkletUrl, LIVE_PCM_PROCESSOR_NAME } from './livePcmWorklet.ts';
import {
  INITIAL_LIVE_INPUT_STATE, emptyLiveListeners, type LiveAnalysisUpdate,
  type LiveInputDevice, type LiveInputState, type LiveInputStatus,
} from './types.ts';

type MediaDevicesPort = Pick<MediaDevices, 'getUserMedia' | 'enumerateDevices' | 'addEventListener' | 'removeEventListener'>;
type AnalyzerPort = ReturnType<typeof createLiveRollingAnalyzer>;
type ControllerOptions = Readonly<{
  onState(state: LiveInputState): void;
  onAnalysis(update: LiveAnalysisUpdate): void;
  now?: () => number;
  mediaDevices?: MediaDevicesPort | null;
  createContext?: () => AudioContext;
  createCaptureNode?: (context: AudioContext) => AudioWorkletNode;
  createAnalyzer?: typeof createLiveRollingAnalyzer;
  secureContext?: boolean;
}>;

const devicesFrom = (items: readonly MediaDeviceInfo[]): LiveInputDevice[] => items
  .filter(device => device.kind === 'audioinput')
  .map(device => ({ deviceId: device.deviceId, label: device.label, labelAvailable: device.label.length > 0 }));

const classifyError = (error: unknown): { status: LiveInputStatus; message: string } => {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : 'Live input failed';
  if (name === 'NotAllowedError' || name === 'SecurityError') return { status: 'DENIED', message };
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return { status: 'NO_DEVICE', message };
  return { status: 'ERROR', message };
};

export function createLiveAudioInputController(options: ControllerOptions) {
  const now = options.now ?? (() => performance.now() / 1000);
  const mediaDevices = options.mediaDevices === undefined ? navigator.mediaDevices : options.mediaDevices;
  const createContext = options.createContext ?? (() => new AudioContext());
  const createCaptureNode = options.createCaptureNode ?? (context => new AudioWorkletNode(context,
    LIVE_PCM_PROCESSOR_NAME, { numberOfInputs: 1, numberOfOutputs: 0, channelCountMode: 'explicit' }));
  const createAnalyzer = options.createAnalyzer ?? createLiveRollingAnalyzer;
  const secure = options.secureContext ?? globalThis.isSecureContext;
  let state: LiveInputState = INITIAL_LIVE_INPUT_STATE;
  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let capture: AudioWorkletNode | null = null;
  let analyzer: AnalyzerPort | null = null;
  let clock: ReturnType<typeof createLiveAudioClock> | null = null;
  let workletUrl: string | null = null;
  let session = 0;
  let disposed = false;

  const publish = (next: LiveInputState) => { state = Object.freeze(next); options.onState(state); };
  const refreshDevices = async () => {
    if (!mediaDevices) { publish({ ...state, status: 'ERROR', error: 'Media devices are unavailable' }); return []; }
    try {
      const devices = devicesFrom(await mediaDevices.enumerateDevices());
      publish({ ...state, devices });
      return devices;
    } catch (error) {
      const failure = classifyError(error); publish({ ...state, status: failure.status, error: failure.message }); return [];
    }
  };
  const cleanup = async () => {
    analyzer?.stop(); analyzer = null;
    if (capture) { capture.port.onmessage = null; capture.disconnect(); capture = null; }
    if (source) { source.disconnect(); source = null; }
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
    clock?.stop();
    if (context && context.state !== 'closed') await context.close();
    context = null;
    if (workletUrl) URL.revokeObjectURL(workletUrl);
    workletUrl = null;
  };
  const stop = async (status: LiveInputStatus = 'STOPPED') => {
    const frozen = clock?.read().time ?? state.sessionTime;
    const finalListeners = state.listeners;
    await cleanup();
    publish({ ...state, status, sessionTime: frozen, rollingPcmBytes: 0, retainedEvidenceBytes: 0,
      retainedEventCount: 0, listeners: finalListeners, error: null });
  };
  const start = async (deviceId: string | null = state.selectedDeviceId) => {
    if (disposed) return;
    if (!secure) {
      publish({ ...state, status: 'ERROR', error: 'Live input requires HTTPS or localhost' }); return;
    }
    if (!mediaDevices?.getUserMedia || !globalThis.AudioWorkletNode && !options.createCaptureNode) {
      publish({ ...state, status: 'ERROR', error: 'AudioWorklet live capture is unavailable' }); return;
    }
    await cleanup();
    publish({ ...state, status: 'REQUESTING', selectedDeviceId: deviceId, sessionTime: 0,
      listeners: emptyLiveListeners(), error: null });
    try {
      const constraints: MediaTrackConstraints = {
        echoCancellation: false, noiseSuppression: false, autoGainControl: false,
        ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      };
      stream = await mediaDevices.getUserMedia({ audio: constraints, video: false });
      context = createContext();
      if (context.state === 'suspended') await context.resume();
      workletUrl = createLivePcmWorkletUrl();
      await context.audioWorklet.addModule(workletUrl);
      source = context.createMediaStreamSource(stream);
      capture = createCaptureNode(context);
      source.connect(capture);
      clock = createLiveAudioClock(now);
      session += 1;
      const track = stream.getAudioTracks()[0];
      const settings = track?.getSettings();
      const devices = await refreshDevices();
      const activeDeviceId = settings?.deviceId ?? deviceId;
      const exposed = devices.find(item => item.deviceId === activeDeviceId);
      const deviceLabel = track?.label || exposed?.label || null;
      analyzer = createAnalyzer({
        sampleRate: context.sampleRate, sessionId: String(session), deviceId: activeDeviceId ?? null,
        deviceLabel, channelCount: settings?.channelCount ?? source.channelCount,
        baseLatency: Number.isFinite(context.baseLatency) ? context.baseLatency : null,
        outputLatency: 'outputLatency' in context && Number.isFinite(context.outputLatency)
          ? context.outputLatency : null,
        readTransport: () => clock!.read(), now,
        onUpdate(update) {
          const mergedState = { ...update.state, devices: state.devices, status: 'LIVE' as const };
          publish(mergedState); options.onAnalysis({ ...update, state: mergedState });
        },
      });
      capture.port.onmessage = event => {
        const channels = (event.data as { channels?: Float32Array[] }).channels;
        if (channels?.length) analyzer?.push(channels);
        capture?.port.postMessage({ type: 'consumed' });
      };
      publish({ ...state, status: 'LIVE', devices, selectedDeviceId: activeDeviceId ?? null,
        deviceLabel, sampleRate: context.sampleRate, channelCount: settings?.channelCount ?? source.channelCount,
        sessionTime: 0, baseLatency: Number.isFinite(context.baseLatency) ? context.baseLatency : null,
        outputLatency: 'outputLatency' in context && Number.isFinite(context.outputLatency) ? context.outputLatency : null,
        rollingPcmBytes: 0, retainedEvidenceBytes: 0, retainedEventCount: 0,
        droppedAnalysisRequests: 0, lastAnalysisLatency: null, listeners: emptyLiveListeners(), error: null });
    } catch (error) {
      await cleanup(); const failure = classifyError(error);
      publish({ ...state, status: failure.status, error: failure.message });
    }
  };
  const deviceChange = async () => {
    const devices = await refreshDevices();
    if (state.status === 'LIVE' && state.selectedDeviceId
      && !devices.some(device => device.deviceId === state.selectedDeviceId)) await stop('DEVICE_LOST');
  };
  mediaDevices?.addEventListener('devicechange', deviceChange);

  return {
    read: () => state,
    readTransport: () => clock?.read() ?? {
      time: state.sessionTime, duration: state.sessionTime, playing: false,
    },
    refreshDevices,
    start,
    selectDevice: (deviceId: string) => start(deviceId),
    stop: () => stop('STOPPED'),
    async dispose() {
      disposed = true; mediaDevices?.removeEventListener('devicechange', deviceChange); await cleanup();
    },
  };
}
