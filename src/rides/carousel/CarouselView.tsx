import type { CarouselState } from './simulation';
import { DoodleLine, DoodlePath } from '../../experience/doodle/DoodleSvg';
import type { CSSProperties } from 'react';

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

function Rider({ pose, noteName, displayDegree }: { pose: RiderPose; noteName: string | null; displayDegree: string | null }) {
  const carrierClass = pose.active ? 'carousel-carrier carousel-carrier--active' : 'carousel-carrier';
  return <g className="carousel-rider-assembly" data-rider={pose.index}>
    <line className="carousel-pole" x1={pose.x} y1={pose.poleTopY} x2={pose.x} y2={pose.riderY + 29} />
    <g className={carrierClass} transform={`translate(${pose.x} ${pose.riderY}) scale(${pose.scale})`}>
      <rect className="carousel-carrier-frame" x="-25" y="-18" width="50" height="36" rx="8" />
      <rect className="carousel-carrier-media" x="-18" y="-11" width="36" height="22" rx="4" />
      <line className="carousel-carrier-mount" x1="0" y1="18" x2="0" y2="27" />
      <rect className="carousel-carrier-base" x="-18" y="26" width="36" height="6" rx="3" />
      <text x="0" y={pose.active && noteName ? 1 : 5} textAnchor="middle">{pose.active ? displayDegree ?? pose.index + 1 : pose.index + 1}</text>
      {pose.active && noteName && <text className="carousel-note-label" x="0" y="12" textAnchor="middle">{noteName}</text>}
    </g>
  </g>;
}

export function CarouselView({ state, doodle = false }: { state: CarouselState; doodle?: boolean }) {
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
      <svg className="carousel-machine" viewBox="0 0 560 330" role="img" aria-labelledby="carousel-svg-title carousel-svg-description"
        data-presentation-active={state.presentationActive || undefined}
        data-movement-source={state.movementSource}
        style={{ '--carousel-presence': state.presentationEnvelope } as CSSProperties}>
        <title id="carousel-svg-title">Mechanical carousel</title>
        <desc id="carousel-svg-description">A central mast, rotating platform, eight poles, and abstract media carriers. Melody changes one carrier's vertical position.</desc>
        <ellipse className="carousel-shadow" cx={CENTER_X} cy="300" rx="205" ry="24" />
        {doodle ? <DoodlePath className="carousel-canopy" d="M92 102 Q280 6 468 102 Q280 148 92 102 Z"
          seed="carousel-canopy" roughness={0.9} /> : <path className="carousel-canopy" d="M92 102 Q280 6 468 102 Q280 148 92 102 Z" />}
        {doodle ? <DoodlePath className="carousel-ring carousel-ring--top"
          d="M92 102 C92 74 176 52 280 52 C384 52 468 74 468 102 C468 130 384 152 280 152 C176 152 92 130 92 102 Z"
          seed="carousel-top-ring" roughness={0.75} secondary />
          : <ellipse className="carousel-ring carousel-ring--top" cx={CENTER_X} cy={TOP_Y} rx="188" ry="50" />}
        {doodle ? <DoodleLine className="carousel-mast" x1={CENTER_X} y1={47} x2={CENTER_X} y2={282}
          seed="carousel-mast" roughness={0.55} secondary /> : <line className="carousel-mast" x1={CENTER_X} y1="47" x2={CENTER_X} y2="282" />}
        <circle className="carousel-finial" cx={CENTER_X} cy="40" r="12" />
        <g className="carousel-spokes">
          {poses.map(pose => <line key={pose.index} x1={CENTER_X} y1={PLATFORM_Y} x2={pose.x} y2={pose.platformY} />)}
        </g>
        {doodle ? <DoodlePath className="carousel-platform carousel-platform--back"
          d="M84 250 C84 222 172 199 280 199 C388 199 476 222 476 250 C476 278 388 301 280 301 C172 301 84 278 84 250 Z"
          seed="carousel-platform" roughness={0.8} />
          : <ellipse className="carousel-platform carousel-platform--back" cx={CENTER_X} cy={PLATFORM_Y} rx="196" ry="51" />}
        {poses.filter(pose => pose.depth < 0).map(pose => <Rider pose={pose} noteName={state.activeNoteName} displayDegree={state.displayDegree} key={pose.index} />)}
        <rect className="carousel-hub" x={CENTER_X - 25} y="218" width="50" height="64" rx="10" />
        {state.chromaticMarker.visible && <g className="carousel-chromatic-marker" data-chromatic-marker="true">
          <circle cx={CENTER_X} cy="178" r="22" />
          <text x={CENTER_X} y="174" textAnchor="middle">{state.chromaticMarker.noteName ?? '—'}</text>
          <text className="carousel-chromatic-caption" x={CENTER_X} y="188" textAnchor="middle">
            {state.chromaticMarker.offset === null ? 'no degree' : `chromatic +${state.chromaticMarker.offset}`}
          </text>
        </g>}
        {poses.filter(pose => pose.depth >= 0).map(pose => <Rider pose={pose} noteName={state.activeNoteName} displayDegree={state.displayDegree} key={pose.index} />)}
        {doodle ? <DoodlePath className="carousel-platform carousel-platform--front"
          d="M84 250 Q280 302 476 250 L468 270 Q280 316 92 270 Z" seed="carousel-platform-front" roughness={0.8} />
          : <path className="carousel-platform carousel-platform--front" d="M84 250 A196 51 0 0 0 476 250 L468 270 A188 45 0 0 1 92 270 Z" />}
      </svg>
    </div>
    <dl className="actor-readout">
      <div><dt>Note / MIDI</dt><dd>{state.activeNoteName ?? '—'}{state.activeMidi === null ? '' : ` · ${state.activeMidi}`}</dd></div>
      <div><dt>Degree / carrier</dt><dd>{state.activeDegree === null ? '—' : `${state.displayDegree ?? state.activeDegree} · #${state.activeRider! + 1}`}</dd></div>
      <div><dt>Rider travel</dt><dd>{displayedRider === null ? '—' : `#${displayedRider.index + 1} · ${Math.round(displayedRider.position * 100)}%`}</dd></div>
      <div><dt>Base velocity</dt><dd>{state.baseAngularVelocity.toFixed(2)} rad/s</dd></div>
      <div><dt>Last event</dt><dd>{state.lastEvent ?? '—'}</dd></div>
    </dl>
  </section>;
}
