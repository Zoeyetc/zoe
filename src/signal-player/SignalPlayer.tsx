import type { AudioPreparationState } from '../audio/AudioPreparationController';
import type { AudioEvent, AudioFrame, TransportState } from '../audio/types';
import type { ControlActions } from '../control/types';
import { SignalConsole, type SignalComposition } from '../signal-console/SignalConsole';
import type { SignalConsoleObservation } from '../signal-console/types';
import { SignalPlayback } from './SignalPlayback';
import './signalPlayer.css';

export type SignalPlayerProps = Readonly<{
  title?: string;
  transport: TransportState;
  preparation: AudioPreparationState;
  actions: ControlActions;
  onChooseAudio(file: File): void;
  onUseFixture(): void;
  observe(): SignalConsoleObservation;
  interpretation: AudioFrame;
  events: readonly AudioEvent[];
  composition?: SignalComposition;
}>;

export function SignalPlayer({ title, transport, preparation, actions, onChooseAudio, onUseFixture,
  observe, interpretation, events, composition }: SignalPlayerProps) {
  return <main className="signal-player" aria-label={title ?? 'Signal player'}>
    {title ? <header className="signal-player-heading"><h1>{title}</h1></header> : null}
    <SignalPlayback transport={transport} preparation={preparation} actions={actions}
      onChooseAudio={onChooseAudio} onUseFixture={onUseFixture} compact={composition === 'performance'} />
    <SignalConsole observe={observe} interpretation={interpretation} events={events} composition={composition} />
  </main>;
}
