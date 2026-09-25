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
import { MotionLayer } from './MotionStudy';
import { MotionMode } from './MotionMode';
import { motionModeRenderers } from './motionModeRenderers';

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
  motion?: MotionMode;
  onMotionChange?(mode: MotionMode): void;
  motionEnabled?: boolean;
  onMotionEnabledChange?(enabled: boolean): void;
}>;

export function SignalPlayer({ title, nameplateDescription, transport, preparation, actions, onChooseAudio, onUseFixture,
  liveInput, onStartLive, onStopLive, onSelectLiveInput,
  observe, interpretation, events, composition, performanceFullscreen = false, motion = MotionMode.Instrument, onMotionChange,
  motionEnabled = true, onMotionEnabledChange }: SignalPlayerProps) {
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
    data-composition={composition} data-fullscreen={fullscreen.active} data-motion-mode={motion} data-motion-enabled={motionEnabled}
    data-motion-dividers={motionEnabled && motionModeRenderers[motion].replacesDividers ? 'replace' : 'preserve'}>
    {title && composition !== 'performance'
      ? <header className="signal-player-heading"><h1>{title}</h1></header> : null}
    <SignalPlayback transport={transport} preparation={preparation} actions={actions}
      onChooseAudio={onChooseAudio} onUseFixture={onUseFixture} liveInput={liveInput}
      onStartLive={onStartLive} onStopLive={onStopLive} onSelectLiveInput={onSelectLiveInput}
      compact={composition === 'performance'}
      motion={onMotionChange && onMotionEnabledChange
        ? { mode: motion, enabled: motionEnabled, select: onMotionChange, setEnabled: onMotionEnabledChange } : undefined}
      fullscreen={performanceFullscreen ? { ...fullscreen, toggle: () => void fullscreenRef.current?.toggle() } : undefined} />
    <SignalConsole observe={observe} interpretation={interpretation} events={events} composition={composition}
      nameplate={composition === 'performance' && title
        ? { name: title, description: nameplateDescription ?? '' } : undefined} />
    {!motionEnabled ? null : <MotionLayer rootRef={rootRef} mode={motion} observe={observe} events={events} />}
  </main>;
}
