import type { ReactNode, RefObject } from 'react';
import type { BumperCarsState } from './simulation';

type BumperCarsViewProps = Readonly<{
  state: BumperCarsState;
  debugOverlay?: ReactNode;
  stageContent?: ReactNode;
  stageRef?: RefObject<HTMLDivElement | null>;
}>;

export function BumperCarsView({ state, debugOverlay, stageContent, stageRef }: BumperCarsViewProps) {
  return <section aria-labelledby="bumper-cars-heading">
    <div className="section-heading">
      <div><p className="eyebrow">Percussion actor · six persistent roles</p><h2 id="bumper-cars-heading">BumperCars</h2></div>
      <span className={`status status--${state.mode}`}>{state.mode}</span>
    </div>
    <div className="bumper-stage" ref={stageRef}>
      <svg className="bumper-arena" viewBox={`0 0 ${state.arena.width} ${state.arena.height}`}
        role="img" aria-label={`${state.bodies.length} actor-local collision bodies; ${state.mode}`}>
        <rect className="bumper-boundary" x="4" y="4" width={state.arena.width - 8} height={state.arena.height - 8} rx="18" />
        {state.bodies.map(body => <g key={body.id}
          className={body.id === state.selectedBody ? 'bumper-car bumper-car--selected' : 'bumper-car'}
          transform={`translate(${body.x} ${body.y}) rotate(${body.angle * 180 / Math.PI})`}>
          <rect x={-body.width / 2} y={-body.height / 2} width={body.width} height={body.height} rx="12" />
          <circle cx="0" cy="0" r="4" />
          <text x="0" y="4" textAnchor="middle">{body.role.replace('-percussion', '').replace('-hat', ' hat')}</text>
        </g>)}
        {debugOverlay}
      </svg>
      {stageContent}
    </div>
    <dl className="actor-readout">
      <div><dt>Latest hit</dt><dd>{state.latestPercussion ?? '—'}</dd></div>
      <div><dt>Selected body</dt><dd>{state.selectedBody === null ? '—' : `#${state.selectedBody + 1}`}</dd></div>
      <div><dt>Activity</dt><dd>{Math.round(state.kineticActivity)}</dd></div>
      <div><dt>Shared impacts</dt><dd>{state.sharedCollisionCount}</dd></div>
    </dl>
  </section>;
}
