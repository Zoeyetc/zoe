import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createAudioBufferPlaybackTransport, createLiveAudioInputController, decodeLocalAudioFile,
  INITIAL_LIVE_INPUT_STATE, pcmFromAudioBuffer,
  type AudioPlaybackTransport, type BrowserTransportState, type LiveInputState,
} from '@computational-listening/audio-source-browser';
import {
  analyzePcmListeningAsync, createListeningTimeline, lookupListeningSnapshot, selectMelodyEvidenceForTransport,
} from '@computational-listening/engine';
import {
  SignalPlayer,
  type AudioPreparationState, type InstrumentEvent, type InstrumentFrame, type InstrumentListeningMap,
} from '@computational-listening/instrument-ui';

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
  const mapRef = useRef<InstrumentListeningMap>(emptyMap);
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
  const [live] = useState(() => createLiveAudioInputController({
    onState(next) { liveRef.current = next; setLiveState(next); },
    onAnalysis(update) {
      const map: InstrumentListeningMap = { ...update.map, id: `live-input-${update.sessionId}`, source: update.source };
      mapRef.current = map; revisionRef.current += 1; transportRef.current = update.transport;
      const generic = timelineRef.current.replaceMap(map, map.id, update.transport.time);
      const next = makeFrame(map, update.transport, update.events);
      recentRef.current = [...recentRef.current, ...generic.events, ...update.events].slice(-8);
      setTransport(update.transport); setFrame(next);
    },
  }));
  const sync = useCallback((nextTransport: BrowserTransportState, events: readonly InstrumentEvent[] = []) => {
    transportRef.current = nextTransport;
    const generic = timelineRef.current.synchronize(nextTransport.time);
    const next = makeFrame(mapRef.current, nextTransport, [...generic.events, ...events]);
    if (events.length) recentRef.current = [...recentRef.current, ...events].slice(-8);
    setTransport(nextTransport); setFrame(next);
  }, []);
  useEffect(() => {
    void live.refreshDevices();
  }, [live]);
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
  useEffect(() => () => { playbackRef.current?.dispose(); void live.dispose(); }, [live]);
  const chooseAudio = useCallback((file: File) => {
    const requestId = ++requestRef.current;
    setPreparation({ sourceMode: 'real-audio', filename: file.name, duration: null, decodeState: 'decoding', analysisState: 'idle', error: null, requestId });
    void live.stop().then(async () => {
      const context = new AudioContext();
      try {
        const buffer = await decodeLocalAudioFile(file, context);
        if (requestId !== requestRef.current) return;
        setPreparation(p => ({ ...p, duration: buffer.duration, decodeState: 'ready', analysisState: 'analyzing' }));
        const listening = await analyzePcmListeningAsync(pcmFromAudioBuffer(buffer));
        if (requestId !== requestRef.current) return;
        const map: InstrumentListeningMap = { ...listening, id: `zoe-file-${requestId}`,
          source: { kind: 'real-audio', filename: file.name, mimeType: file.type || 'application/octet-stream' } };
        playbackRef.current?.dispose(); playbackRef.current = createAudioBufferPlaybackTransport(context, buffer);
        mapRef.current = map; revisionRef.current += 1; timelineRef.current.replaceMap(map, map.id, 0);
        setPreparation(p => ({ ...p, analysisState: 'ready' })); sync(playbackRef.current.read());
      } catch (error) {
        setPreparation(p => ({ ...p, decodeState: p.decodeState === 'decoding' ? 'error' : p.decodeState,
          analysisState: p.analysisState === 'analyzing' ? 'error' : p.analysisState,
          error: error instanceof Error ? error.message : 'Audio preparation failed' }));
      }
    });
  }, [live, sync]);
  const actions = {
    play() { playbackRef.current?.play(); }, pause() { playbackRef.current?.pause(); },
    seek(time: number) { const from = transportRef.current.time; playbackRef.current?.seek(time); const next = playbackRef.current?.read() ?? transportRef.current; sync(next, [{ type: 'seek', from, to: next.time }]); },
    restart() { const from = transportRef.current.time; playbackRef.current?.restart(); const next = playbackRef.current?.read() ?? transportRef.current; sync(next, [{ type: 'seek', from, to: next.time }]); },
  };
  const useReference = useCallback(() => {
    requestRef.current += 1;
    playbackRef.current?.dispose(); playbackRef.current = null;
    void live.stop();
    mapRef.current = emptyMap; revisionRef.current += 1;
    timelineRef.current.replaceMap(emptyMap, emptyMap.id, 0);
    recentRef.current = [];
    setPreparation({ sourceMode: 'fixture', filename: null, duration: null, decodeState: 'idle',
      analysisState: 'idle', error: null, requestId: requestRef.current });
    sync(stopped);
  }, [live, sync]);
  const startLive = (deviceId: string | null) => { playbackRef.current?.pause(); void live.start(deviceId); };
  const stopLive = () => { void live.stop(); };
  return <SignalPlayer title="Zoë" transport={transport} preparation={preparation} actions={actions}
    onChooseAudio={chooseAudio} onUseFixture={useReference} liveInput={liveState}
    onStartLive={startLive} onStopLive={stopLive} onSelectLiveInput={deviceId => startLive(deviceId || null)}
    observe={() => ({ mapRevision: revisionRef.current, transport: transportRef.current, audioMap: mapRef.current,
      melodyEvidence: selectMelodyEvidenceForTransport(mapRef.current.melodyEvidence, transportRef.current), live: liveRef.current })}
    interpretation={frame} events={recentRef.current} composition="performance" />;
}
