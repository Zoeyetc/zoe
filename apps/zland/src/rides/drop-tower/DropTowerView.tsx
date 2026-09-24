import type { DropTowerState } from './simulation';
import { DoodleLine } from '../../experience/doodle/DoodleSvg';

const TOP_Y = 54;
const REST_Y = 382;
const CARRIAGE_WIDTH = 220;

export function DropTowerView({ state, districtFit = false, doodle = false }: {
  state: DropTowerState;
  districtFit?: boolean;
  doodle?: boolean;
}) {
  const carriageY = TOP_Y + (REST_Y - TOP_Y) * state.position;
  return <section data-actor="drop-tower" aria-labelledby="drop-tower-heading">
    <div className="section-heading">
      <div><p className="eyebrow">Structure actor · build / tension / major drop</p><h2 id="drop-tower-heading">DropTower</h2></div>
      <span className={`status status--${state.mode}`}>{state.phase.toLowerCase()}</span>
    </div>
    <div className="drop-tower-stage">
      <svg className="drop-tower-machine" viewBox="0 0 560 450"
        preserveAspectRatio={districtFit ? 'none' : 'xMidYMid meet'}
        data-district-fit={districtFit || undefined} role="img"
        aria-label={`Drop tower ${state.phase.toLowerCase()}; carriage position ${state.position.toFixed(2)}`}>
        {doodle ? <DoodleLine className="drop-tower-guide" x1={280} y1={36} x2={280} y2={420}
          seed="drop-tower-guide" roughness={0.45} secondary /> : <line className="drop-tower-guide" x1="280" y1="36" x2="280" y2="420" />}
        <line className="drop-tower-bound" x1="250" y1={TOP_Y} x2="310" y2={TOP_Y} />
        <line className="drop-tower-bound" x1="236" y1={REST_Y + 35} x2="324" y2={REST_Y + 35} />
        <rect className="drop-tower-cap" x="273" y="28" width="14" height="14" rx="2" />
        <g className="drop-tower-carriage" transform={`translate(280 ${carriageY})`}>
          <rect x={-CARRIAGE_WIDTH / 2} y="-22" width={CARRIAGE_WIDTH} height="44" rx="7" />
          <rect className="drop-tower-media" x="-82" y="-13" width="164" height="26" rx="5" />
          <text x="0" y="5" textAnchor="middle">BUILD · HOLD · RELEASE</text>
        </g>
      </svg>
    </div>
    <dl className="actor-readout">
      <div><dt>Section</dt><dd>{state.section ?? '—'}</dd></div>
      <div><dt>Build / tension</dt><dd>{state.build.toFixed(2)} / {state.tension.toFixed(2)}</dd></div>
      <div><dt>Position / velocity</dt><dd>{state.position.toFixed(3)} / {state.velocity.toFixed(3)}</dd></div>
      <div><dt>Lift target / drop</dt><dd>{state.liftTarget.toFixed(3)} / {state.latestDropEvent ?? '—'}</dd></div>
      <div><dt>Drive / source</dt><dd>{state.drive.source} / {state.movementProvenance}</dd></div>
    </dl>
  </section>;
}
