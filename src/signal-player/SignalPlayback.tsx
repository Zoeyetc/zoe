import { useId } from 'react';
import type { AudioPreparationState } from '../audio/AudioPreparationController';
import type { TransportState } from '../audio/types';
import type { ControlActions } from '../control/types';

export type SignalPlaybackProps = Readonly<{
  transport: TransportState;
  preparation: AudioPreparationState;
  actions: ControlActions;
  onChooseAudio(file: File): void;
  onUseFixture(): void;
}>;

export function SignalPlayback({ transport, preparation, actions, onChooseAudio, onUseFixture }: SignalPlaybackProps) {
  const inputId = useId();
  const seekId = useId();
  const preparing = preparation.decodeState === 'decoding' || preparation.analysisState === 'analyzing';
  const source = preparation.sourceMode === 'fixture'
    ? 'Reference analysis source'
    : preparation.filename ?? 'Local audio';
  return <section className="signal-playback" aria-labelledby={`${inputId}-heading`}>
    <header>
      <h1 id={`${inputId}-heading`}>Audio</h1>
      <p>{source}</p>
    </header>
    <div className="signal-playback-source">
      <label htmlFor={inputId}>Load audio file</label>
      <input id={inputId} type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a"
        disabled={preparing} onChange={event => {
          const file = event.currentTarget.files?.[0];
          if (file) onChooseAudio(file);
          event.currentTarget.value = '';
        }} />
      {preparation.sourceMode === 'real-audio'
        ? <button type="button" onClick={onUseFixture}>Use reference source</button>
        : null}
      <span role="status">Decode: {preparation.decodeState} · Analysis: {preparation.analysisState}
        {preparation.duration !== null ? ` · ${preparation.duration.toFixed(2)}s` : ''}
        {preparation.error ? ` · ${preparation.error}` : ''}</span>
    </div>
    <div className="signal-playback-actions">
      <button disabled={preparing || transport.playing || transport.time >= transport.duration}
        onClick={actions.play}>Play</button>
      <button disabled={!transport.playing} onClick={actions.pause}>Pause</button>
      <button onClick={actions.restart}>Restart</button>
    </div>
    <label className="signal-playback-position" htmlFor={seekId}>Position · {transport.time.toFixed(1)} / {transport.duration}s</label>
    <input id={seekId} className="signal-playback-range" type="range" min="0" max={transport.duration} step="0.1"
      value={transport.time} onChange={event => actions.seek(Number(event.target.value))} />
  </section>;
}
