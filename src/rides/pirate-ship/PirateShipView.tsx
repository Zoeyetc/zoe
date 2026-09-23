import type { PirateShipState } from './simulation';

const PIVOT_X = 280;
const PIVOT_Y = 46;
const ARM_LENGTH = 176;

export function PirateShipView({ state, districtFit = false }: {
  state: PirateShipState;
  districtFit?: boolean;
}) {
  const degrees = state.angle * 180 / Math.PI;
  return <section aria-labelledby="pirate-ship-heading">
    <div className="section-heading">
      <div><p className="eyebrow">Groove actor · continuous phase pass</p><h2 id="pirate-ship-heading">PirateShip</h2></div>
      <span className={`status status--${state.mode}`}>{state.mode}</span>
    </div>
    <div className="pirate-stage">
      <svg className="pirate-machine" viewBox="0 0 560 300"
        preserveAspectRatio={districtFit ? 'none' : 'xMidYMid meet'}
        data-district-fit={districtFit || undefined} role="img"
        aria-label={`Pendulum actor at ${degrees.toFixed(1)} degrees; ${state.mode}`}>
        <path className="pirate-support" d={`M90 282 L${PIVOT_X} ${PIVOT_Y} L470 282 M70 282 H490`} />
        <circle className="pirate-pivot" cx={PIVOT_X} cy={PIVOT_Y} r="9" />
        <g className="pirate-swing" transform={`translate(${PIVOT_X} ${PIVOT_Y}) rotate(${degrees})`}>
          <path className="pirate-arm" d={`M0 0 L-94 ${ARM_LENGTH} M0 0 L94 ${ARM_LENGTH}`} />
          <path className="pirate-carrier" d={`M-114 ${ARM_LENGTH - 6} Q0 ${ARM_LENGTH + 42} 114 ${ARM_LENGTH - 6} L96 ${ARM_LENGTH + 28} H-96 Z`} />
          <rect className="pirate-media-slot" x="-70" y={ARM_LENGTH + 2} width="140" height="25" rx="8" />
        </g>
      </svg>
    </div>
    <dl className="actor-readout">
      <div><dt>BPM</dt><dd>{state.bpm ?? '—'}</dd></div>
      <div><dt>Beat phase</dt><dd>{state.beatPhase.toFixed(2)}</dd></div>
      <div><dt>Swing / groove</dt><dd>{state.swing.toFixed(2)} / {state.groove.toFixed(2)}</dd></div>
      <div><dt>Angle / velocity</dt><dd>{degrees.toFixed(1)}° / {state.angularVelocity.toFixed(2)}</dd></div>
    </dl>
  </section>;
}
