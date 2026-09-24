import type { AudioPreparationState } from '../contracts.ts';
import type { InstrumentEvent, InstrumentFrame, BrowserTransportState } from '../contracts.ts';
import type { InstrumentActions } from '../contracts.ts';
import { SignalConsole, type SignalComposition } from '../signal-console/SignalConsole';
import type { SignalConsoleObservation } from '../signal-console/types';
import { SignalPlayback } from './SignalPlayback';
import './signalPlayer.css';
import type { LiveInputState } from '@computational-listening/audio-source-browser';

export type SignalPlayerProps = Readonly<{
  title?: string;
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
}>;

export function SignalPlayer({ title, transport, preparation, actions, onChooseAudio, onUseFixture,
  liveInput, onStartLive, onStopLive, onSelectLiveInput,
  observe, interpretation, events, composition }: SignalPlayerProps) {
  return <main className="signal-player" aria-label={title ?? 'Signal player'} data-composition={composition}>
    {title ? <header className="signal-player-heading"><h1>{title}</h1></header> : null}
    <SignalPlayback transport={transport} preparation={preparation} actions={actions}
      onChooseAudio={onChooseAudio} onUseFixture={onUseFixture} liveInput={liveInput}
      onStartLive={onStartLive} onStopLive={onStopLive} onSelectLiveInput={onSelectLiveInput}
      compact={composition === 'performance'} />
    <SignalConsole observe={observe} interpretation={interpretation} events={events} composition={composition} />
  </main>;
}
