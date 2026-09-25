import { useEffect, useRef, useState } from 'react';
import { analyzePcmListeningAsync, createListeningTimeline } from '@zoeyetc/computational-listening-engine';
import { createAudioBufferPlaybackTransport, decodeLocalAudioFile, pcmFromAudioBuffer,
  type AudioPlaybackTransport, type BrowserTransportState } from '../../audio-source-browser/index.ts';
import type { InstrumentEvent, InstrumentListeningMap } from '../../instrument-ui/contracts.ts';
import { initialInstrumentMotion, stepInstrumentMotion } from '../../instrument-ui/signal-player/instrumentMotion.ts';
import { initialMaterialMotion, stepMaterialMotion } from '../../instrument-ui/signal-player/materialMotion.ts';
import { initialFieldMotion, stepFieldMotion } from '../../instrument-ui/signal-player/fieldMotion.ts';
import { initialObservatoryMotion, stepObservatoryMotion } from '../../instrument-ui/signal-player/observatoryMotion.ts';
import { selectMotionStudySample, motionStudyTarget } from '../../instrument-ui/signal-player/motionStudyEvidence.ts';
import { MotionMode, MOTION_MODES, MOTION_MODE_NAMES } from '../../instrument-ui/signal-player/MotionMode.ts';
import { motionModeRenderers, type MotionRenderer } from '../../instrument-ui/signal-player/motionModeRenderers.ts';

type Panel = {
  mode: MotionMode;
  root: HTMLElement;
  canvas: HTMLCanvasElement;
  renderer: MotionRenderer | null;
  geometry: ReturnType<MotionRenderer['measure']> | null;
  activity: HTMLOutputElement;
  confirmation: HTMLOutputElement;
};

const initialTransport: BrowserTransportState = { time: 0, duration: 0, playing: false };
const clock = (time: number) => {
  const minutes = Math.floor(time / 60);
  return `${String(minutes).padStart(2, '0')}:${(time - minutes * 60).toFixed(2).padStart(5, '0')}`;
};

function ComparisonPanel({ mode, register }: { mode: MotionMode; register(mode: MotionMode, root: HTMLElement | null): void }) {
  return <section className="comparison-panel" data-mode={mode} ref={root => register(mode, root)}
    aria-label={`${MOTION_MODE_NAMES[mode]} listening mode`}>
    <header><h2>{MOTION_MODE_NAMES[mode]}</h2><span>LISTENING MODE</span></header>
    <div className="comparison-divider signal-console-heading--performance" aria-hidden="true" />
    <div className="comparison-measure">
      <span>CURRENT ACTIVITY</span><output data-activity>0.000</output>
    </div>
    <div className="comparison-divider listening-field-score" aria-hidden="true" />
    <div className="comparison-voice listening-field-voice">EVIDENCE</div>
    <div className="comparison-voice listening-field-voice">SHARED INPUT</div>
    <div className="comparison-divider listening-field-now-rule" aria-hidden="true" />
    <div className="comparison-measure comparison-confirmation">
      <span>CONFIRMATION</span><output data-confirmation>{mode === MotionMode.Observatory ? 'WAITING' : '—'}</output>
    </div>
    <div className="signal-performance-band"><div className="comparison-divider signal-inspect" aria-hidden="true" /></div>
    <div className="signal-system-footer"><div className="comparison-divider signal-inspect" aria-hidden="true" /></div>
    <canvas className="comparison-canvas" aria-hidden="true" data-motion-mode={mode} />
  </section>;
}

export function ListeningComparison() {
  const roots = useRef<Record<MotionMode, HTMLElement | null>>({
    [MotionMode.Instrument]: null, [MotionMode.Material]: null,
    [MotionMode.Field]: null, [MotionMode.Observatory]: null,
  });
  const playback = useRef<AudioPlaybackTransport | null>(null);
  const context = useRef<AudioContext | null>(null);
  const map = useRef<InstrumentListeningMap | null>(null);
  const timeline = useRef<ReturnType<typeof createListeningTimeline> | null>(null);
  const recentEvents = useRef<InstrumentEvent[]>([]);
  const interpretationRevision = useRef(0);
  const requestId = useRef(0);
  const timeOutput = useRef<HTMLOutputElement>(null);
  const range = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState('No audio loaded');
  const [status, setStatus] = useState('Choose one audio file to compare all four modes.');
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const panels: Panel[] = MOTION_MODES.map(mode => {
      const root = roots.current[mode]!;
      const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
      let renderer: MotionRenderer | null;
      try { renderer = motionModeRenderers[mode].create(canvas, root); }
      catch { renderer = null; }
      root.dataset.motionRenderer = renderer ? 'webgl' : 'unavailable';
      return { mode, root, canvas, renderer, geometry: null,
        activity: root.querySelector<HTMLOutputElement>('[data-activity]')!,
        confirmation: root.querySelector<HTMLOutputElement>('[data-confirmation]')! };
    });
    const measure = () => {
      for (const panel of panels) {
        if (!panel.renderer) continue;
        panel.geometry = panel.renderer.measure();
        panel.renderer.resize(panel.geometry);
        panel.canvas.dataset.motionLineCount = String(panel.geometry.lines.length);
      }
    };
    const resize = new ResizeObserver(measure);
    panels.forEach(panel => resize.observe(panel.root));
    measure();

    let instrument = initialInstrumentMotion;
    let material = initialMaterialMotion;
    let field = initialFieldMotion;
    let observatory = initialObservatoryMotion;
    let lastSource = map.current;
    let lastInterpretationRevision = interpretationRevision.current;
    let previousTime = 0;
    let animationFrame = 0;
    const render = (now: number) => {
      const dt = previousTime ? Math.min(.1, (now - previousTime) / 1000) : 1 / 60;
      previousTime = now;
      const currentMap = map.current;
      const transport = playback.current?.read() ?? initialTransport;
      if (timeOutput.current) timeOutput.current.textContent = clock(transport.time);
      if (range.current) range.current.value = String(transport.time);
      if (currentMap !== lastSource || interpretationRevision.current !== lastInterpretationRevision) {
        instrument = initialInstrumentMotion;
        material = initialMaterialMotion;
        field = initialFieldMotion;
        observatory = initialObservatoryMotion;
        lastSource = currentMap;
        lastInterpretationRevision = interpretationRevision.current;
      }
      if (currentMap && timeline.current) {
        const next = timeline.current.read(transport.time);
        if (next.events.length) recentEvents.current = [...recentEvents.current, ...next.events].slice(-8);
        const sample = selectMotionStudySample({ mapRevision: 0, transport, audioMap: currentMap }, recentEvents.current);
        // One retained-evidence sample and one transport timestamp feed every panel in this frame.
        instrument = stepInstrumentMotion(instrument, motionStudyTarget('a', sample), dt);
        material = stepMaterialMotion(material, sample, dt);
        field = stepFieldMotion(field, sample, dt);
        observatory = stepObservatoryMotion(observatory, sample, dt);
        const activities: Record<MotionMode, number> = {
          [MotionMode.Instrument]: instrument.activity,
          [MotionMode.Material]: material.activity,
          [MotionMode.Field]: field.confidence,
          [MotionMode.Observatory]: observatory.activity,
        };
        for (const panel of panels) {
          const activity = activities[panel.mode];
          panel.activity.textContent = activity.toFixed(3);
          panel.canvas.dataset.motionActivity = activity.toFixed(3);
          panel.canvas.dataset.evidenceTime = transport.time.toFixed(3);
          if (panel.mode === MotionMode.Observatory) {
            panel.confirmation.textContent = observatory.confirmed ? 'CONFIRMED' : 'WAITING';
          }
          if (panel.renderer && panel.geometry) panel.renderer.draw(panel.geometry, activity, sample.progress);
        }
      }
      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);
    return () => {
      requestId.current += 1;
      cancelAnimationFrame(animationFrame);
      resize.disconnect();
      panels.forEach(panel => panel.renderer?.dispose());
      playback.current?.dispose();
      void context.current?.close();
    };
  }, []);

  const chooseAudio = async (file: File | undefined) => {
    if (!file) return;
    const generation = ++requestId.current;
    playback.current?.dispose();
    playback.current = null;
    void context.current?.close();
    context.current = null;
    map.current = null;
    timeline.current = null;
    recentEvents.current = [];
    interpretationRevision.current += 1;
    setReady(false);
    setDuration(0);
    setSource(file.name);
    setStatus('Decoding audio…');
    const nextContext = new AudioContext();
    try {
      const buffer = await decodeLocalAudioFile(file, nextContext);
      if (generation !== requestId.current) { void nextContext.close(); return; }
      setStatus('Analyzing retained evidence…');
      const listening = await analyzePcmListeningAsync(pcmFromAudioBuffer(buffer));
      if (generation !== requestId.current) { void nextContext.close(); return; }
      context.current = nextContext;
      playback.current = createAudioBufferPlaybackTransport(nextContext, buffer);
      const nextMap: InstrumentListeningMap = { ...listening, id: `comparison-${generation}` };
      timeline.current = createListeningTimeline(nextMap, nextMap.id);
      recentEvents.current = [];
      map.current = nextMap;
      setDuration(buffer.duration);
      setReady(true);
      setStatus('Ready · identical retained evidence in all four panels');
    } catch (error) {
      void nextContext.close();
      setStatus(error instanceof Error ? error.message : 'Audio could not be prepared.');
    }
  };

  const seek = (time: number) => {
    playback.current?.seek(time);
    timeline.current?.synchronize(time);
    recentEvents.current = [];
    interpretationRevision.current += 1;
  };

  return <main className="comparison-page">
    <header className="comparison-heading"><h1>Zoë · Listening Comparison</h1><p>Development comparison · one source, one timeline</p></header>
    <section className="comparison-transport" aria-label="Shared audio transport">
      <label htmlFor="comparison-audio">AUDIO SOURCE</label>
      <input id="comparison-audio" type="file" onChange={event => void chooseAudio(event.currentTarget.files?.[0])} />
      <strong className="comparison-source">{source}</strong>
      <div className="comparison-actions">
        <button type="button" disabled={!ready} onClick={() => playback.current?.play()}>PLAY</button>
        <button type="button" disabled={!ready} onClick={() => playback.current?.pause()}>PAUSE</button>
        <button type="button" disabled={!ready} onClick={() => seek(0)}>RESTART</button>
      </div>
      <div className="comparison-timeline">
        <output ref={timeOutput} aria-label="Current transport time">00:00.00</output>
        <input ref={range} type="range" min="0" max={duration} step="0.01" defaultValue="0"
          disabled={!ready} aria-label="Shared timeline" onChange={event => seek(Number(event.currentTarget.value))} />
        <output aria-label="Transport duration">{clock(duration)}</output>
      </div>
      <p role="status">{status}</p>
    </section>
    <div className="comparison-grid" aria-label="Synchronized listening modes">
      {MOTION_MODES.map(mode => <ComparisonPanel key={mode} mode={mode}
        register={(item, root) => { roots.current[item] = root; }} />)}
    </div>
  </main>;
}
