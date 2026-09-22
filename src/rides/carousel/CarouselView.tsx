import type { CarouselState } from './simulation';

const TAU = Math.PI * 2;
const CENTER_X = 280;
const TOP_Y = 102;
const PLATFORM_Y = 250;
const ORBIT_X = 176;
const ORBIT_Y = 36;
const RIDER_TRAVEL = 54;

type RiderPose = Readonly<{
  index: number;
  x: number;
  platformY: number;
  poleTopY: number;
  riderY: number;
  depth: number;
  scale: number;
  active: boolean;
}>;

function riderPoses(state: CarouselState): RiderPose[] {
  return state.riders
    .map(rider => {
      const theta = state.baseAngle + (rider.index / state.riders.length) * TAU;
      const depth = Math.sin(theta);
      const x = CENTER_X + Math.cos(theta) * ORBIT_X;
      const platformY = PLATFORM_Y + depth * ORBIT_Y;
      return {
        index: rider.index,
        x,
        platformY,
        poleTopY: TOP_Y + depth * 13,
        riderY: platformY - 38 - rider.position * RIDER_TRAVEL,
        depth,
        scale: 0.88 + (depth + 1) * 0.08,
        active: rider.active,
      };
    })
    .sort((a, b) => a.depth - b.depth);
}

function Rider({ pose }: { pose: RiderPose }) {
  const carrierClass = pose.active ? 'carousel-carrier carousel-carrier--active' : 'carousel-carrier';
  return <g className="carousel-rider-assembly" data-rider={pose.index}>
    <line className="carousel-pole" x1={pose.x} y1={pose.poleTopY} x2={pose.x} y2={pose.riderY + 29} />
    <g className={carrierClass} transform={`translate(${pose.x} ${pose.riderY}) scale(${pose.scale})`}>
      <rect className="carousel-carrier-frame" x="-25" y="-18" width="50" height="36" rx="8" />
      <rect className="carousel-carrier-media" x="-18" y="-11" width="36" height="22" rx="4" />
      <line className="carousel-carrier-mount" x1="0" y1="18" x2="0" y2="27" />
      <rect className="carousel-carrier-base" x="-18" y="26" width="36" height="6" rx="3" />
      <text x="0" y="5" textAnchor="middle">{pose.index + 1}</text>
    </g>
  </g>;
}

export function CarouselView({ state }: { state: CarouselState }) {
  const poses = riderPoses(state);
  const highestRider = state.riders.reduce((highest, rider) =>
    rider.position > highest.position ? rider : highest, state.riders[0]);
  const displayedRider = state.activeRider === null
    ? (highestRider.position > 0.01 ? highestRider : null)
    : state.riders[state.activeRider];
  return <section className="carousel-panel" aria-labelledby="carousel-heading">
    <div className="section-heading">
      <div><p className="eyebrow">Melody actor · mechanical pass</p><h2 id="carousel-heading">Carousel</h2></div>
      <span className={`status status--${state.mode}`}>{state.mode}</span>
    </div>
    <div className="carousel-stage" aria-label={`Mechanical carousel ${state.mode}; active MIDI note ${state.activeMidi ?? 'none'}`}>
      <svg className="carousel-machine" viewBox="0 0 560 330" role="img" aria-labelledby="carousel-svg-title carousel-svg-description">
        <title id="carousel-svg-title">Mechanical carousel</title>
        <desc id="carousel-svg-description">A central mast, rotating platform, eight poles, and abstract media carriers. Melody changes one carrier's vertical position.</desc>
        <ellipse className="carousel-shadow" cx={CENTER_X} cy="300" rx="205" ry="24" />
        <path className="carousel-canopy" d="M92 102 Q280 6 468 102 Q280 148 92 102 Z" />
        <ellipse className="carousel-ring carousel-ring--top" cx={CENTER_X} cy={TOP_Y} rx="188" ry="50" />
        <line className="carousel-mast" x1={CENTER_X} y1="47" x2={CENTER_X} y2="282" />
        <circle className="carousel-finial" cx={CENTER_X} cy="40" r="12" />
        <g className="carousel-spokes">
          {poses.map(pose => <line key={pose.index} x1={CENTER_X} y1={PLATFORM_Y} x2={pose.x} y2={pose.platformY} />)}
        </g>
        <ellipse className="carousel-platform carousel-platform--back" cx={CENTER_X} cy={PLATFORM_Y} rx="196" ry="51" />
        {poses.filter(pose => pose.depth < 0).map(pose => <Rider pose={pose} key={pose.index} />)}
        <rect className="carousel-hub" x={CENTER_X - 25} y="218" width="50" height="64" rx="10" />
        {poses.filter(pose => pose.depth >= 0).map(pose => <Rider pose={pose} key={pose.index} />)}
        <path className="carousel-platform carousel-platform--front" d="M84 250 A196 51 0 0 0 476 250 L468 270 A188 45 0 0 1 92 270 Z" />
      </svg>
    </div>
    <dl className="actor-readout">
      <div><dt>MIDI</dt><dd>{state.activeMidi ?? '—'}</dd></div>
      <div><dt>Rider travel</dt><dd>{displayedRider === null ? '—' : `#${displayedRider.index + 1} · ${Math.round(displayedRider.position * 100)}%`}</dd></div>
      <div><dt>Base velocity</dt><dd>{state.baseAngularVelocity.toFixed(2)} rad/s</dd></div>
      <div><dt>Last event</dt><dd>{state.lastEvent ?? '—'}</dd></div>
    </dl>
  </section>;
}
