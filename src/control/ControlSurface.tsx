import type { AudioSnapshot, TransportState } from '../audio/types';
import type { ControlActions } from './types';
import type { AudioPreparationState } from '../audio/AudioPreparationController';

export function ControlSurface({ transport, melody, rhythm, percussion, percussionEventCount, harmony, tonalCenter, structure, structureSegmentCount,
  actions, preparation, onChooseAudio, onUseFixture }: {
  transport: TransportState;
  melody: AudioSnapshot['melody'];
  rhythm: AudioSnapshot['rhythm'];
  percussion: AudioSnapshot['percussion'];
  percussionEventCount: number | null;
  harmony: AudioSnapshot['harmony'];
  tonalCenter: AudioSnapshot['tonalCenter'];
  structure: AudioSnapshot['structure'];
  structureSegmentCount: number | null;
  actions: ControlActions;
  preparation: AudioPreparationState;
  onChooseAudio(file: File): void;
  onUseFixture(): void;
}) {
  const preparing = preparation.decodeState === 'decoding' || preparation.analysisState === 'analyzing';
  return <section aria-labelledby="controls-heading">
    <h2 id="controls-heading">Playback</h2>
    <p>{preparation.sourceMode === 'fixture'
      ? 'Authored deterministic fixture.'
      : `${preparation.filename ?? 'Local audio'} · ${preparation.analysisState === 'ready' ? 'ready' : preparing ? 'preparing' : preparation.error ? 'error' : 'selected'}`}</p>
    <div className="audio-source-controls">
      <label htmlFor="audio-file">Choose local audio file</label>
      <input id="audio-file" type="file" accept="audio/mpeg,audio/wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a"
        disabled={preparing} onChange={event => {
          const file = event.currentTarget.files?.[0];
          if (file) onChooseAudio(file);
          event.currentTarget.value = '';
        }} />
      {preparation.sourceMode === 'real-audio' && <button type="button" onClick={onUseFixture}>Use authored fixture</button>}
      <span role="status">Decode: {preparation.decodeState} · Analysis: {preparation.analysisState}
        {preparation.duration !== null ? ` · ${preparation.duration.toFixed(2)}s` : ''}
        {preparation.error ? ` · ${preparation.error}` : ''}</span>
      {preparation.analysisState === 'ready' && <span data-rhythm-status>Rhythm: {rhythm.available && rhythm.bpm !== null
        ? `${rhythm.bpm.toFixed(1)} BPM · confidence ${rhythm.confidence.toFixed(2)}`
        : `unavailable · confidence ${rhythm.confidence.toFixed(2)}`}</span>}
      {preparation.analysisState === 'ready' && <span data-percussion-status>Percussion: {percussion.available
        ? `ready · confidence ${percussion.confidence.toFixed(2)} · ${percussionEventCount ?? 0} events`
        : `unavailable · confidence ${percussion.confidence.toFixed(2)}`}</span>}
      {preparation.analysisState === 'ready' && <span data-melody-status>Melody: {melody.available
        ? `ready · ${melody.noteName ?? 'rest'} · confidence ${melody.confidence.toFixed(2)}`
        : 'unavailable'}</span>}
      {preparation.analysisState === 'ready' && <span data-degree-status>Melody Degree: {melody.scaleDegree.available
        ? `${melody.scaleDegree.displayDegree ?? melody.scaleDegree.degree} · confidence ${melody.scaleDegree.confidence.toFixed(2)}`
        : melody.active ? 'unavailable · absolute note retained' : 'unavailable'}</span>}
      {preparation.analysisState === 'ready' && <span data-harmony-status>Harmony: {harmony.available
        ? `ready · ${harmony.chord ?? 'no chord'} · confidence ${harmony.confidence.toFixed(2)}`
        : 'unavailable'}</span>}
      {preparation.analysisState === 'ready' && <span data-tonal-center-status>Tonal Center: {tonalCenter.available
        ? `ready · ${tonalCenter.label ?? '—'} · confidence ${tonalCenter.confidence.toFixed(2)}`
        : 'unavailable'}</span>}
      {preparation.analysisState === 'ready' && <span data-structure-status>Structure: {structure.available
        ? `ready · ${structure.label ?? '—'} · confidence ${structure.confidence.toFixed(2)} · ${structureSegmentCount ?? 0} sections`
        : 'unavailable'}</span>}
    </div>
    <div className="buttons">
      <button disabled={preparing || transport.playing || transport.time >= transport.duration} onClick={actions.play}>Play</button>
      <button disabled={!transport.playing} onClick={actions.pause}>Pause</button>
      <button onClick={actions.restart}>Restart</button>
    </div>
    <label htmlFor="seek">Position · {transport.time.toFixed(1)} / {transport.duration}s</label>
    <input id="seek" type="range" min="0" max={transport.duration} step="0.1"
      value={transport.time} onChange={event => actions.seek(Number(event.target.value))} />
  </section>;
}
