import type { TransportState } from '../audio/types';
import type { ControlActions } from './types';

export function ControlSurface({ transport, actions }: {
  transport: TransportState;
  actions: ControlActions;
}) {
  return <section aria-labelledby="controls-heading">
    <h2 id="controls-heading">Playback</h2>
      <p>Authored melody, percussion, rhythm, harmony, structure, phrase, and spectrum fixture. Song loading and analysis are not connected yet.</p>
    <div className="buttons">
      <button disabled={transport.playing || transport.time >= transport.duration} onClick={actions.play}>Play</button>
      <button disabled={!transport.playing} onClick={actions.pause}>Pause</button>
      <button onClick={actions.restart}>Restart</button>
    </div>
    <label htmlFor="seek">Position · {transport.time.toFixed(1)} / {transport.duration}s</label>
    <input id="seek" type="range" min="0" max={transport.duration} step="0.1"
      value={transport.time} onChange={event => actions.seek(Number(event.target.value))} />
  </section>;
}
