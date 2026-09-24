import type { FerrisWheelState } from './simulation';
import { DoodleCircle, DoodleLine, DoodlePath } from '../../experience/doodle/DoodleSvg';

const TAU = Math.PI * 2;
const CENTER_X = 280;
const CENTER_Y = 210;
const RADIUS = 146;
const PITCH_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export function FerrisWheelView({ state, doodle = false }: { state: FerrisWheelState; doodle?: boolean }) {
  const wheelDegrees = state.wheelAngle * 180 / Math.PI;
  const targetDegrees = state.targetWheelAngle * 180 / Math.PI;
  return <section data-actor="ferris-wheel" aria-labelledby="ferris-wheel-heading"
    data-cabin-order={state.cabins.map(cabin => PITCH_NAMES[cabin.pitchClass]).join(' ')}
    data-wheel-angle={state.wheelAngle} data-target-angle={state.targetWheelAngle}
    data-angular-velocity={state.wheelAngularVelocity}>
    <div className="section-heading">
      <div><p className="eyebrow">Harmony actor · chord membership + tonal orientation</p><h2 id="ferris-wheel-heading">FerrisWheel</h2></div>
      <span className={`status status--${state.mode}`}>{state.mode}</span>
    </div>
    <div className="ferris-stage">
      <svg className="ferris-machine" viewBox="0 0 560 470" role="img"
        aria-label={`Ferris wheel; chord ${state.chord ?? 'none'}; ${state.mode}`}>
        {doodle ? <DoodlePath className="ferris-support" d="M170 448 L250 230 M390 448 L310 230 M125 448 H435"
          seed="ferris-support" roughness={0.85} secondary /> : <path className="ferris-support" d="M170 448 L250 230 M390 448 L310 230 M125 448 H435" />}
        {doodle ? <DoodleCircle className="ferris-ring" cx={CENTER_X} cy={CENTER_Y} r={RADIUS}
          seed="ferris-ring" roughness={0.75} secondary /> : <circle className="ferris-ring" cx={CENTER_X} cy={CENTER_Y} r={RADIUS} />}
        <g className="ferris-spokes">
          {state.cabins.map(cabin => {
            const theta = state.wheelAngle + cabin.id * TAU / state.cabins.length;
            const x2 = CENTER_X + Math.cos(theta) * RADIUS;
            const y2 = CENTER_Y + Math.sin(theta) * RADIUS;
            return doodle ? <DoodleLine key={cabin.id} x1={CENTER_X} y1={CENTER_Y} x2={x2} y2={y2}
              seed={`ferris-spoke-${cabin.id}`} roughness={0.42} />
              : <line key={cabin.id} x1={CENTER_X} y1={CENTER_Y} x2={x2} y2={y2} />;
          })}
        </g>
        <circle className="ferris-hub" cx={CENTER_X} cy={CENTER_Y} r="12" />
        <g className="ferris-boarding" aria-hidden="true">
          <line x1={CENTER_X - 24} y1={CENTER_Y + RADIUS + 47} x2={CENTER_X + 24} y2={CENTER_Y + RADIUS + 47} />
          <text x={CENTER_X} y={CENTER_Y + RADIUS + 64} textAnchor="middle">BOARDING / TONIC</text>
        </g>
        <g className="ferris-cabins">
          {state.cabins.map(cabin => {
            const theta = state.wheelAngle + cabin.id * TAU / state.cabins.length;
            const x = CENTER_X + Math.cos(theta) * RADIUS;
            const y = CENTER_Y + Math.sin(theta) * RADIUS;
            const swingDegrees = cabin.worldOrientation * 180 / Math.PI;
            const evidenceClass = cabin.active ? 'ferris-cabin ferris-cabin--active' : 'ferris-cabin';
            const tonicClass = cabin.pitchClass === state.tonicCabinId ? ' ferris-cabin--tonic' : '';
            return <g key={cabin.id} className={`${evidenceClass}${tonicClass}`}
              transform={`translate(${x} ${y}) rotate(${swingDegrees})`} data-slot={cabin.id}
              data-pitch-class={cabin.pitchClass} data-active={cabin.active}>
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
      <div><dt>Tonal center</dt><dd>{state.tonalCenterLabel ?? '—'} · {state.targetFifthsIndex ?? '—'}</dd></div>
      <div><dt>Angle / target</dt><dd>{wheelDegrees.toFixed(1)}° / {targetDegrees.toFixed(1)}°</dd></div>
      <div><dt>Velocity / acceleration</dt><dd>{state.wheelAngularVelocity.toFixed(3)} / {state.wheelAngularAcceleration.toFixed(3)}</dd></div>
    </dl>
  </section>;
}
