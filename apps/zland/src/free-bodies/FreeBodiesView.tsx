import type { FreeBodiesState } from './simulation';

export function FreeBodiesView({ state }: { state: FreeBodiesState }) {
  const selected = state.bodies.find(body => body.id === state.selectedBodyId) ?? state.bodies[0];
  return <section aria-labelledby="free-bodies-heading">
    <div className="section-heading">
      <div><p className="eyebrow">Atmosphere actor · free dynamic participants</p>
        <h2 id="free-bodies-heading">Free Bodies / Orb</h2></div>
      <span className={`status status--${state.activeCount ? 'active' : 'resting'}`}>
        {state.activeCount ? `${state.activeCount} active` : 'resting'}
      </span>
    </div>
    <div className="free-bodies-stage">
      <svg className="free-bodies-field" viewBox="0 0 560 280" role="img"
        aria-label={`${state.bodies.length} free dynamic Orb bodies; brightness ${state.brightness.toFixed(2)}; texture ${state.texture.toFixed(2)}`}>
        <rect className="free-bodies-boundary" x="4" y="4" width="552" height="272" rx="18" />
        {state.bodies.map(body => <g key={body.id}
          className={body.id === state.selectedBodyId ? 'free-body free-body--selected' : 'free-body'}
          transform={`translate(${body.position.x * 560} ${body.position.y * 280})`}>
          <circle r={Math.max(6, body.radius * 560)} />
          <line x1="0" y1="0" x2={body.velocity.x * 150} y2={body.velocity.y * 150} />
        </g>)}
      </svg>
    </div>
    <dl className="actor-readout">
      <div><dt>Brightness / texture</dt><dd>{state.brightness.toFixed(2)} / {state.texture.toFixed(2)}</dd></div>
      <div><dt>Average / max speed</dt><dd>{state.averageSpeed.toFixed(3)} / {state.maxSpeed.toFixed(3)}</dd></div>
      <div><dt>Active / sleeping</dt><dd>{state.activeCount} / {state.sleepingCount}</dd></div>
      <div><dt>Selected body</dt><dd>{selected?.id ?? '—'}</dd></div>
    </dl>
  </section>;
}
