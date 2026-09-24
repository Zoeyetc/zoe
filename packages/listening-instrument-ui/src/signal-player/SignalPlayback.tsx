import { useId } from 'react';
import type { AudioPreparationState } from '../contracts.ts';
import type { BrowserTransportState } from '../contracts.ts';
import type { InstrumentActions } from '../contracts.ts';
import type { LiveInputState } from '@computational-listening/audio-source-browser';

export type SignalPlaybackProps = Readonly<{
  transport: BrowserTransportState;
  preparation: AudioPreparationState;
  actions: InstrumentActions;
  onChooseAudio(file: File): void;
  onUseFixture(): void;
  liveInput: LiveInputState;
  onStartLive(deviceId: string | null): void;
  onStopLive(): void;
  onSelectLiveInput(deviceId: string): void;
  compact?: boolean;
}>;

function clockTime(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = value - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${seconds.toFixed(3).padStart(6, '0')}`;
}

export function SignalPlayback({ transport, preparation, actions, onChooseAudio, onUseFixture,
  liveInput, onStartLive, onStopLive, onSelectLiveInput, compact = false }: SignalPlaybackProps) {
  const inputId = useId();
  const seekId = useId();
  const preparing = preparation.decodeState === 'decoding' || preparation.analysisState === 'analyzing';
  const source = preparation.sourceMode === 'fixture'
    ? 'Reference analysis source'
    : preparation.filename ?? 'Local audio';
  const sourceArgument = preparation.sourceMode === 'fixture' ? 'reference' : preparation.filename ?? '—';
  const transportState = transport.time >= transport.duration ? 'ended' : transport.playing ? 'playing' : 'paused';
  const progress = transport.duration > 0 ? Math.min(1, Math.max(0, transport.time / transport.duration)) : 0;
  const liveMode = liveInput.status === 'LIVE' || liveInput.status === 'REQUESTING';
  const liveLabel = liveInput.deviceLabel ?? 'label unavailable';
  const chooseAudio = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) onChooseAudio(file);
    event.currentTarget.value = '';
  };
  const deviceSelector = <select className="signal-input-device" aria-label="Input device"
    value={liveInput.selectedDeviceId ?? ''} disabled={liveMode && liveInput.status === 'REQUESTING'}
    onChange={event => onSelectLiveInput(event.currentTarget.value)}>
    <option value="">Input label unavailable</option>
    {liveInput.devices.map((device, index) => <option value={device.deviceId} key={device.deviceId || `input-${index}`}>
      {device.labelAvailable ? device.label : `Label unavailable · input ${index + 1}`}
    </option>)}
  </select>;

  if (compact) return <section className="signal-playback signal-playback--compact"
    aria-label="Audio transport" data-transport-state={liveMode ? 'live' : transportState}
    data-source-mode={liveMode ? 'live-input' : 'file'}>
    <div className="signal-playback-command">
      <label className="signal-load-command" htmlFor={inputId}>
        <span>{liveMode ? 'audio.input(' : 'audio.load('}</span>
        <strong>&quot;{liveMode ? liveLabel : sourceArgument}&quot;</strong><span>)</span>
      </label>
      <input className="signal-load-input" id={inputId} type="file"
        accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a"
        disabled={preparing} onChange={chooseAudio} aria-label={`Load audio file; current source ${source}`} />
      <div className="signal-playback-actions" aria-label="Playback controls">
        {liveMode ? <button disabled={liveInput.status === 'REQUESTING'} onClick={onStopLive}>[STOP]</button> : <>
        <button disabled={preparing || transport.playing || transport.time >= transport.duration}
          onClick={actions.play}>[PLAY]</button>
        <button disabled={!transport.playing} onClick={actions.pause}>[PAUSE]</button>
        <button onClick={actions.restart}>[RESTART]</button>
        </>}
        {!liveMode ? <button onClick={() => onStartLive(liveInput.selectedDeviceId)}>[LIVE]</button> : null}
        {preparation.sourceMode === 'real-audio'
          ? <button className="signal-reference-action" type="button" onClick={onUseFixture}>[REFERENCE]</button>
          : null}
      </div>
      {deviceSelector}
      <span className="signal-sr-only" role="status">Decode: {preparation.decodeState}; Analysis: {preparation.analysisState}
        {preparation.error ? `; ${preparation.error}` : ''}; Live input: {liveInput.status}
        {liveInput.error ? `; ${liveInput.error}` : ''}</span>
    </div>
    {liveMode ? <div className="signal-live-command" aria-label="Live listening session">
      <strong>LIVE</strong><output aria-label="Live session time">{clockTime(transport.time)}</output>
    </div> : <div className="signal-progress-command">
      <output aria-label="Current transport time">{clockTime(transport.time)}</output>
      <div className="signal-progress-track" aria-hidden="true">
        <span className="signal-progress-played" style={{ inlineSize: `${progress * 100}%` }} />
        <span className="signal-progress-playhead" style={{ insetInlineStart: `${progress * 100}%` }} />
      </div>
      <output aria-label="Transport duration">{clockTime(transport.duration)}</output>
      <label className="signal-sr-only" htmlFor={seekId}>Seek position</label>
      <input id={seekId} className="signal-playback-range signal-playback-range--compact" type="range"
        min="0" max={transport.duration} step="0.1" value={transport.time}
        aria-label={`Seek position ${clockTime(transport.time)} of ${clockTime(transport.duration)}`}
        onChange={event => actions.seek(Number(event.target.value))} />
    </div>}
  </section>;

  if (liveMode) return <section className="signal-playback" aria-label="Live input">
    <header><h1>Live input</h1><p>{liveLabel}</p></header>
    <div className="signal-playback-source">{deviceSelector}</div>
    <div className="signal-playback-actions"><button onClick={onStopLive}>Stop</button></div>
    <output aria-label="Live session time">LIVE {clockTime(transport.time)}</output>
  </section>;

  return <section className="signal-playback" aria-labelledby={`${inputId}-heading`}>
    <header>
      <h1 id={`${inputId}-heading`}>Audio</h1>
      <p>{source}</p>
    </header>
    <div className="signal-playback-source">
      <label htmlFor={inputId}>Load audio file</label>
      <input id={inputId} type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a"
        disabled={preparing} onChange={chooseAudio} />
      {preparation.sourceMode === 'real-audio'
        ? <button type="button" onClick={onUseFixture}>Use reference source</button>
        : null}
      {deviceSelector}
      <button type="button" onClick={() => onStartLive(liveInput.selectedDeviceId)}>Use live input</button>
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
