import { useEffect, useRef, useState } from 'react';
import type { AudioPreparationState } from '../contracts.ts';
import type { InstrumentEvent, InstrumentFrame, BrowserTransportState } from '../contracts.ts';
import type { InstrumentActions } from '../contracts.ts';
import { SignalConsole, type SignalComposition } from '../signal-console/SignalConsole';
import type { SignalConsoleObservation } from '../signal-console/types';
import { SignalPlayback } from './SignalPlayback';
import './signalPlayer.css';
import type { LiveInputState } from '../../audio-source-browser/index.ts';
import { createPerformanceFullscreenController, type PerformanceFullscreenState } from './performanceFullscreen';

export type SignalPlayerProps = Readonly<{
  title?: string;
  nameplateDescription?: string;
  transport: BrowserTransportState;
  preparation: AudioPreparationState;
  actions: InstrumentActions;
  onChooseAudio(file: File): void;
  onUseFixture(): void;
  liveInput: LiveInputState;
  onStartLive(deviceId: string | null): void;
  onStopLive(): void;
  onSelectLiveInput(deviceId: string): void;
  observe(): SignalConsoleObservation;
  interpretation: InstrumentFrame;
  events: readonly InstrumentEvent[];
  composition?: SignalComposition;
  performanceFullscreen?: boolean;
}>;

export function SignalPlayer({ title, nameplateDescription, transport, preparation, actions, onChooseAudio, onUseFixture,
  liveInput, onStartLive, onStopLive, onSelectLiveInput,
  observe, interpretation, events, composition, performanceFullscreen = false }: SignalPlayerProps) {
  const rootRef = useRef<HTMLElement>(null);
  const fullscreenRef = useRef<ReturnType<typeof createPerformanceFullscreenController> | null>(null);
  const [fullscreen, setFullscreen] = useState<PerformanceFullscreenState>({ active: false, supported: false, error: null });
  useEffect(() => {
    if (!performanceFullscreen || !rootRef.current) return;
    const controller = createPerformanceFullscreenController(rootRef.current, document, setFullscreen);
    fullscreenRef.current = controller;
    return () => { fullscreenRef.current = null; controller.dispose(); };
  }, [performanceFullscreen]);
  return <main ref={rootRef} className="signal-player" aria-label={title ?? 'Signal player'}
    data-composition={composition} data-fullscreen={fullscreen.active}>
    {title && composition !== 'performance'
      ? <header className="signal-player-heading"><h1>{title}</h1></header> : null}
    <SignalPlayback transport={transport} preparation={preparation} actions={actions}
      onChooseAudio={onChooseAudio} onUseFixture={onUseFixture} liveInput={liveInput}
      onStartLive={onStartLive} onStopLive={onStopLive} onSelectLiveInput={onSelectLiveInput}
      compact={composition === 'performance'}
      fullscreen={performanceFullscreen ? { ...fullscreen, toggle: () => void fullscreenRef.current?.toggle() } : undefined} />
    <SignalConsole observe={observe} interpretation={interpretation} events={events} composition={composition}
      nameplate={composition === 'performance' && title
        ? { name: title, description: nameplateDescription ?? '' } : undefined} />
  </main>;
}
