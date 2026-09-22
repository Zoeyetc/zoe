import type { FerrisWheelState } from './simulation';

const TAU = Math.PI * 2;
const CENTER_X = 280;
const CENTER_Y = 210;
const RADIUS = 146;
const PITCH_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export function FerrisWheelView({ state }: { state: FerrisWheelState }) {
  const wheelDegrees = state.wheelAngle * 180 / Math.PI;
  return <section data-actor="ferris-wheel" aria-labelledby="ferris-wheel-heading">
    <div className="section-heading">
      <div><p className="eyebrow">Harmony actor · sustained relationship pass</p><h2 id="ferris-wheel-heading">FerrisWheel</h2></div>
      <span className={`status status--${state.mode}`}>{state.mode}</span>
    </div>
    <div className="ferris-stage">
      <svg className="ferris-machine" viewBox="0 0 560 470" role="img"
        aria-label={`Ferris wheel; chord ${state.chord ?? 'none'}; ${state.mode}`}>
        <path className="ferris-support" d="M170 448 L250 230 M390 448 L310 230 M125 448 H435" />
        <circle className="ferris-ring" cx={CENTER_X} cy={CENTER_Y} r={RADIUS} />
        <g className="ferris-spokes">
          {state.cabins.map(cabin => {
            const theta = state.wheelAngle + cabin.id * TAU / state.cabins.length;
            return <line key={cabin.id} x1={CENTER_X} y1={CENTER_Y}
              x2={CENTER_X + Math.cos(theta) * RADIUS}
              y2={CENTER_Y + Math.sin(theta) * RADIUS} />;
          })}
        </g>
        <circle className="ferris-hub" cx={CENTER_X} cy={CENTER_Y} r="12" />
        <g className="ferris-cabins">
          {state.cabins.map(cabin => {
            const theta = state.wheelAngle + cabin.id * TAU / state.cabins.length;
            const x = CENTER_X + Math.cos(theta) * RADIUS;
            const y = CENTER_Y + Math.sin(theta) * RADIUS;
            const swingDegrees = cabin.worldOrientation * 180 / Math.PI;
            return <g key={cabin.id} className={cabin.active ? 'ferris-cabin ferris-cabin--active' : 'ferris-cabin'}
              transform={`translate(${x} ${y}) rotate(${swingDegrees})`} data-pitch-class={cabin.pitchClass}>
              <line className="ferris-suspension" x1="0" y1="0" x2="0" y2="15" />
              <rect className="ferris-carrier" x="-18" y="14" width="36" height="26" rx="9" />
              <rect className="ferris-carrier-media" x="-12" y="19" width="24" height="15" rx="5"
                opacity={0.2 + cabin.emphasis * 0.8} />
              <text x="0" y="31" textAnchor="middle">{PITCH_NAMES[cabin.pitchClass]}</text>
            </g>;
          })}
        </g>
      </svg>
    </div>
    <dl className="actor-readout">
      <div><dt>Chord</dt><dd>{state.chord ?? '—'}</dd></div>
      <div><dt>Root</dt><dd>{state.rootPitchClass === null ? '—' : PITCH_NAMES[state.rootPitchClass]}</dd></div>
      <div><dt>Active carriers</dt><dd>{state.activeCabinIds.length ? state.activeCabinIds.map(id => PITCH_NAMES[id]).join(' · ') : '—'}</dd></div>
      <div><dt>Angle / velocity</dt><dd>{wheelDegrees.toFixed(1)}° / {state.wheelAngularVelocity.toFixed(3)}</dd></div>
    </dl>
  </section>;
}
