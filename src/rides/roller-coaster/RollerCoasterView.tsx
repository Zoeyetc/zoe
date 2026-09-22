import type { RollerCoasterState } from './simulation';
import { rollerCoasterRoute } from './route';
import type { Route, Vec3 } from './types';

const WIDTH = 720;
const HEIGHT = 310;

type Projection = Readonly<{ minX: number; minY: number; scale: number }>;
const project = (point: Vec3, projection: Projection) => ({
  x: 28 + (point.x - projection.minX) * projection.scale,
  y: 26 + (point.y - projection.minY) * projection.scale - point.z * projection.scale * 0.18,
});

function routeDrawing(route: Route) {
  const samples = route.pieces.flatMap(piece => Array.from({ length: 25 }, (_, index) =>
    piece.geometry.samplePosition(piece.geometry.length * index / 24)));
  const minX = Math.min(...samples.map(point => point.x));
  const maxX = Math.max(...samples.map(point => point.x));
  const minY = Math.min(...samples.map(point => point.y - point.z * 0.18));
  const maxY = Math.max(...samples.map(point => point.y - point.z * 0.18));
  const scale = Math.min((WIDTH - 56) / Math.max(1, maxX - minX), (HEIGHT - 54) / Math.max(1, maxY - minY));
  const projection = { minX, minY, scale };
  return {
    projection,
    pieces: route.pieces.map(piece => {
      const sampleCount = Math.max(3, Math.ceil(piece.geometry.length / 16));
      return {
      hidden: piece.connector !== undefined,
      kind: piece.segment?.kind ?? 'Connector',
      d: Array.from({ length: sampleCount }, (_, index) => {
        const point = project(piece.geometry.samplePosition(piece.geometry.length * index / (sampleCount - 1)), projection);
        return `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`;
      }).join(' '),
    };}),
  };
}

export function RollerCoasterView({ state }: { state: RollerCoasterState }) {
  const route = rollerCoasterRoute;
  const drawing = routeDrawing(route);
  const rider = project(state.riderPosition, drawing.projection);
  const ahead = project({
    x: state.riderPosition.x + state.riderForward.x * 28,
    y: state.riderPosition.y + state.riderForward.y * 28,
    z: state.riderPosition.z + state.riderForward.z * 28,
  }, drawing.projection);
  const angle = Math.atan2(ahead.y - rider.y, ahead.x - rider.x) * 180 / Math.PI;
  return <section data-actor="roller-coaster" aria-labelledby="roller-coaster-heading">
    <p className="eyebrow">Phrase actor · energy / tension / release</p>
    <h2 id="roller-coaster-heading">RollerCoaster</h2>
    <p>{state.mode} · {state.currentSegment}</p>
    <div className="roller-stage">
      <svg className="roller-machine" viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img" aria-label={`Open segmented roller coaster; Orb on ${state.currentSegment}; route progress ${(state.routeProgress * 100).toFixed(1)} percent`}>
        <g className="roller-track">
          {drawing.pieces.map((piece, index) => <path key={index} d={piece.d}
            className={piece.hidden ? 'roller-connector' : `roller-segment roller-segment--${piece.kind.toLowerCase()}`} />)}
        </g>
        <g className="roller-orb" transform={`translate(${rider.x} ${rider.y}) rotate(${angle})`}>
          <line x1="-17" y1="0" x2="-7" y2="0" />
          <circle r="8" />
          <path d="M4 -4 L13 0 L4 4 Z" />
        </g>
      </svg>
    </div>
    <dl className="actor-readout">
      <div><dt>Phrase / section</dt><dd>{state.phraseProgress.toFixed(2)} · {state.section ?? '—'}</dd></div>
      <div><dt>Segment</dt><dd>{state.currentSegment}</dd></div>
      <div><dt>Distance / route</dt><dd>{state.routeDistance.toFixed(1)} / {state.routeLength.toFixed(1)}</dd></div>
      <div><dt>Velocity / acceleration</dt><dd>{state.velocity.toFixed(1)} / {state.acceleration.toFixed(1)}</dd></div>
    </dl>
  </section>;
}
