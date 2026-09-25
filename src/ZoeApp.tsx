import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createAudioBufferPlaybackTransport, createMediaElementPlaybackTransport, createLiveAudioInputController,
  decodeLocalAudioFile, shouldUseIPhoneSafariPlayback, INITIAL_LIVE_INPUT_STATE, pcmFromAudioBuffer,
  type AudioPlaybackTransport, type BrowserTransportState, type LiveInputState,
} from './audio-source-browser/index.ts';
import {
  analyzePcmListeningAsync, createListeningTimeline, lookupListeningSnapshot, selectMelodyEvidenceForTransport,
} from '@zoeyetc/computational-listening-engine';
import {
  SignalPlayer,
  MotionMode,
  type AudioPreparationState, type InstrumentEvent, type InstrumentFrame, type InstrumentListeningMap,
} from './instrument-ui/index.ts';

const emptyMap: InstrumentListeningMap = {
  id: 'zoe-empty', version: 1, duration: 1,
  capabilities: { melody: false, rhythm: false, percussion: false, harmony: false, tonalCenter: false, structure: false, spectrum: false },
  melody: null, percussion: null, rhythm: null, harmony: null, spectrum: null,
  source: { kind: 'fixture', filename: null, mimeType: null },
};
const stopped: BrowserTransportState = { time: 0, duration: 1, playing: false };
const makeFrame = (map: InstrumentListeningMap, transport: BrowserTransportState,
  events: readonly InstrumentEvent[] = []): InstrumentFrame => ({
  snapshot: { ...lookupListeningSnapshot(map, transport.time), mapId: map.id, transport }, events,
});

export function ZoeApp() {
  const [motion, setMotion] = useState<MotionMode>(MotionMode.Instrument);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const mapRef = useRef<InstrumentListeningMap>(emptyMap);
  const fileMapRef = useRef<InstrumentListeningMap>(emptyMap);
  const revisionRef = useRef(0);
  const timelineRef = useRef(createListeningTimeline(emptyMap, emptyMap.id));
  const playbackRef = useRef<AudioPlaybackTransport | null>(null);
  const transportRef = useRef<BrowserTransportState>(stopped);
  const liveRef = useRef<LiveInputState | null>(null);
  const recentRef = useRef<InstrumentEvent[]>([]);
  const [transport, setTransport] = useState(stopped);
  const [frame, setFrame] = useState(() => makeFrame(emptyMap, stopped));
  const [liveState, setLiveState] = useState<LiveInputState>(INITIAL_LIVE_INPUT_STATE);
  const [preparation, setPreparation] = useState<AudioPreparationState>({ sourceMode: 'fixture', filename: null,
    duration: null, decodeState: 'idle', analysisState: 'idle', error: null, requestId: 0 });
  const requestRef = useRef(0);
  const liveControllerRef = useRef<ReturnType<typeof createLiveAudioInputController> | null>(null);
  const restoreFile = useCallback(() => {
    const map = fileMapRef.current;
    const next = playbackRef.current?.read() ?? stopped;
    mapRef.current = map; revisionRef.current += 1;
    timelineRef.current.replaceMap(map, map.id, next.time);
    transportRef.current = next; recentRef.current = [];
    setTransport(next); setFrame(makeFrame(map, next));
  }, []);
  const sync = useCallback((nextTransport: BrowserTransportState, events: readonly InstrumentEvent[] = []) => {
    transportRef.current = nextTransport;
    const generic = timelineRef.current.synchronize(nextTransport.time);
    const next = makeFrame(mapRef.current, nextTransport, [...generic.events, ...events]);
    if (events.length) recentRef.current = [...recentRef.current, ...events].slice(-8);
    setTransport(nextTransport); setFrame(next);
  }, []);
  useEffect(() => {
    const controller = createLiveAudioInputController({
      onState(next) {
        if (liveControllerRef.current !== controller) return;
        const wasActive = liveRef.current?.status === 'REQUESTING' || liveRef.current?.status === 'LIVE';
        liveRef.current = next; setLiveState(next);
        if (wasActive && next.status !== 'REQUESTING' && next.status !== 'LIVE') restoreFile();
      },
      onAnalysis(update) {
        if (liveControllerRef.current !== controller || liveRef.current?.status !== 'LIVE') return;
        const map: InstrumentListeningMap = { ...update.map, id: `live-input-${update.sessionId}`, source: update.source };
        mapRef.current = map; revisionRef.current += 1; transportRef.current = update.transport;
        const generic = timelineRef.current.replaceMap(map, map.id, update.transport.time);
        const next = makeFrame(map, update.transport, update.events);
        recentRef.current = [...recentRef.current, ...generic.events, ...update.events].slice(-8);
        setTransport(update.transport); setFrame(next);
      },
    });
    liveControllerRef.current = controller;
    void controller.refreshDevices();
    return () => {
      liveControllerRef.current = null;
      playbackRef.current?.dispose();
      void controller.dispose();
    };
  }, [restoreFile]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const source = playbackRef.current;
      if (!source || liveRef.current?.status === 'LIVE') return;
      const nextTransport = source.read();
      const generic = timelineRef.current.read(nextTransport.time);
      transportRef.current = nextTransport;
      if (generic.events.length) recentRef.current = [...recentRef.current, ...generic.events].slice(-8);
      setTransport(nextTransport); setFrame(makeFrame(mapRef.current, nextTransport, generic.events));
    }, 42);
    return () => window.clearInterval(timer);
  }, []);
  const chooseAudio = useCallback((file: File) => {
    const requestId = ++requestRef.current;
    setPreparation({ sourceMode: 'real-audio', filename: file.name, duration: null, decodeState: 'decoding', analysisState: 'idle', error: null, requestId });
    const stopLive = liveRef.current?.status === 'LIVE' || liveRef.current?.status === 'REQUESTING'
      ? liveControllerRef.current?.stop() : Promise.resolve();
    void stopLive?.then(async () => {
      const context = new AudioContext();
      try {
        const buffer = await decodeLocalAudioFile(file, context);
        if (requestId !== requestRef.current) { void context.close(); return; }
        setPreparation(p => ({ ...p, duration: buffer.duration, decodeState: 'ready', analysisState: 'analyzing' }));
        const listening = await analyzePcmListeningAsync(pcmFromAudioBuffer(buffer));
        if (requestId !== requestRef.current) { void context.close(); return; }
        const map: InstrumentListeningMap = { ...listening, id: `zoe-file-${requestId}`,
          source: { kind: 'real-audio', filename: file.name, mimeType: file.type || 'application/octet-stream' } };
        playbackRef.current?.dispose();
        if (shouldUseIPhoneSafariPlayback(navigator.userAgent)) {
          const url = URL.createObjectURL(file);
          const element = new Audio(url);
          element.preload = 'auto';
          playbackRef.current = createMediaElementPlaybackTransport(element, buffer.duration,
            () => URL.revokeObjectURL(url));
          void context.close();
        } else {
          playbackRef.current = createAudioBufferPlaybackTransport(context, buffer);
        }
        fileMapRef.current = map; mapRef.current = map; revisionRef.current += 1;
        timelineRef.current.replaceMap(map, map.id, 0);
        setPreparation(p => ({ ...p, analysisState: 'ready' })); sync(playbackRef.current.read());
      } catch (error) {
        void context.close();
        setPreparation(p => ({ ...p, decodeState: p.decodeState === 'decoding' ? 'error' : p.decodeState,
          analysisState: p.analysisState === 'analyzing' ? 'error' : p.analysisState,
          error: error instanceof Error ? error.message : 'Audio preparation failed' }));
      }
    });
  }, [sync]);
  const actions = {
    play() { playbackRef.current?.play(); }, pause() { playbackRef.current?.pause(); },
    seek(time: number) { const from = transportRef.current.time; playbackRef.current?.seek(time); const next = playbackRef.current?.read() ?? transportRef.current; sync(next, [{ type: 'seek', from, to: next.time }]); },
    restart() { const from = transportRef.current.time; playbackRef.current?.restart(); const next = playbackRef.current?.read() ?? transportRef.current; sync(next, [{ type: 'seek', from, to: next.time }]); },
  };
  const useReference = useCallback(() => {
    requestRef.current += 1;
    playbackRef.current?.dispose(); playbackRef.current = null;
    if (liveRef.current?.status === 'LIVE' || liveRef.current?.status === 'REQUESTING') {
      void liveControllerRef.current?.stop();
    }
    fileMapRef.current = emptyMap; mapRef.current = emptyMap; revisionRef.current += 1;
    timelineRef.current.replaceMap(emptyMap, emptyMap.id, 0);
    recentRef.current = [];
    setPreparation({ sourceMode: 'fixture', filename: null, duration: null, decodeState: 'idle',
      analysisState: 'idle', error: null, requestId: requestRef.current });
    sync(stopped);
  }, [sync]);
  const startLive = (deviceId: string | null) => { playbackRef.current?.pause(); void liveControllerRef.current?.start(deviceId); };
  const stopLive = () => { void liveControllerRef.current?.stop(); };
  return <SignalPlayer title="Zoë" nameplateDescription="Computational Listening Instrument"
    transport={transport} preparation={preparation} actions={actions}
    onChooseAudio={chooseAudio} onUseFixture={useReference} liveInput={liveState}
    onStartLive={startLive} onStopLive={stopLive} onSelectLiveInput={deviceId => startLive(deviceId || null)}
    observe={() => ({ mapRevision: revisionRef.current, transport: transportRef.current, audioMap: mapRef.current,
      melodyEvidence: selectMelodyEvidenceForTransport(mapRef.current.melodyEvidence, transportRef.current),
      live: liveRef.current?.status === 'LIVE' || liveRef.current?.status === 'REQUESTING' ? liveRef.current : null })}
    interpretation={frame} events={recentRef.current} composition="performance" performanceFullscreen
    motion={motion} onMotionChange={setMotion}
    motionEnabled={motionEnabled} onMotionEnabledChange={setMotionEnabled} />;
}
