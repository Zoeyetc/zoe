import { useEffect, type CSSProperties, type RefObject } from 'react';
import type { ExperienceState } from '../createExperience';
import { CarouselView } from '../../rides/carousel/CarouselView';
import { FerrisWheelView } from '../../rides/ferris-wheel/FerrisWheelView';
import { PirateShipView } from '../../rides/pirate-ship/PirateShipView';
import { DropTowerView } from '../../rides/drop-tower/DropTowerView';
import { rollerCoasterRouteForwardToWorld, rollerCoasterRoutePointToWorld } from '../../physics/adapters/rollerCoaster';
import { PhysicsDebugOverlay } from '../../physics/PhysicsDebugOverlay';
import { AnchoredContentView } from '../../physics/AnchoredContentView';
import type { WorldBounds } from '../../physics/AnchoredContentParticipant';
import { bumperArenaPointToWorld } from '../../physics/adapters/bumperCars';
import { ParkTrain } from './ParkTrain';
import { DoodleCircle, DoodlePath } from '../doodle/DoodleSvg';
import { LiveAnnotationSystem } from '../annotations/LiveAnnotationSystem';
import type { AttentionActorId, AttentionRole, AttentionState } from '../attention';
import {
  PARK_ACTOR_ANCHORS, PARK_BUMPER_CARS_BOUNDS, PARK_CONTENT_BOUNDS,
  PARK_DISTRICT_CONTOURS, PARK_DROP_TOWER_RENDERER, PARK_FREE_BODY_QUIET_ZONES, PARK_GATE_BOUNDS, PARK_PATHS,
  PARK_FREE_BODY_PRESENTATION,
  PARK_PIRATE_SHIP_RENDERER,
  PARK_FOCUS_BOUNDS, PARK_OVERVIEW_VIEWPORT, focusViewport,
  PARK_ROLLER_COASTER_BOUNDS, PARK_VIEWBOX,
  boundsStyle, pointInBounds, worldToPark,
} from './config';

type ParkMapProps = Readonly<{
  state: ExperienceState;
  worldRef: RefObject<HTMLDivElement | null>;
  showPhysicsDebug: boolean;
  onContentLayout(bounds: WorldBounds): void;
  attention: AttentionState;
  onFocus(actorId: AttentionActorId): void;
  onOverview(): void;
}>;

function ParkRollerCoaster({ state, trackMap, role, focused }: {
  state: ExperienceState['rollerCoaster']; trackMap: ExperienceState['rollerCoasterTrackMap']; role: AttentionRole; focused: boolean;
}) {
  const pieces = trackMap.route.pieces.map(piece => {
    const sampleCount = Math.max(3, Math.ceil(piece.geometry.length / 16));
    const samples = Array.from({ length: sampleCount }, (_, index) => worldToPark(
      rollerCoasterRoutePointToWorld(
        piece.geometry.samplePosition(piece.geometry.length * index / (sampleCount - 1)),
        trackMap, PARK_ROLLER_COASTER_BOUNDS,
      ),
    ));
    return {
      hidden: piece.connector !== undefined,
      kind: piece.segment?.kind ?? 'Connector',
      d: samples.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' '),
      samples,
    };
  });
  const riderWorld = rollerCoasterRoutePointToWorld(state.riderPosition, trackMap, PARK_ROLLER_COASTER_BOUNDS);
  const rider = worldToPark(riderWorld);
  const forwardWorld = rollerCoasterRouteForwardToWorld(state.riderForward, trackMap, PARK_ROLLER_COASTER_BOUNDS);
  const ahead = worldToPark({
    x: riderWorld.x + forwardWorld.x * 0.03,
    y: riderWorld.y + forwardWorld.y * 0.03,
  });
  const angle = Math.atan2(ahead.y - rider.y, ahead.x - rider.x) * 180 / Math.PI;
  return <g data-park-actor="roller-coaster" data-spatial-role="musical-actor"
    data-attention-role={role}
    data-focused={focused || undefined}
    data-world-x={riderWorld.x} data-world-y={riderWorld.y}
    aria-label={`RollerCoaster ${state.currentSegment}`}>
    <g className="park-roller-track roller-track">
      {pieces.map((piece, index) => piece.hidden
        ? <path key={index} d={piece.d} className="roller-connector" />
        : <g key={index} className={`park-track-piece park-track-piece--${piece.kind.toLowerCase()}`}
          data-track-segment={piece.kind}>
          <DoodlePath d={piece.d} seed={`coaster-${piece.kind}-${index}-bed`} roughness={0.72} className="park-track-bed" />
          <DoodlePath d={piece.d} seed={`coaster-${piece.kind}-${index}-rail`} roughness={0.48}
            secondary className={`park-track-rail roller-segment roller-segment--${piece.kind.toLowerCase()}`} />
          {piece.samples.filter((_, sampleIndex) => sampleIndex % 5 === 2).map((point, sampleIndex, samples) => {
            const previous = samples[Math.max(0, sampleIndex - 1)] ?? point;
            const next = samples[Math.min(samples.length - 1, sampleIndex + 1)] ?? point;
            const dx = next.x - previous.x;
            const dy = next.y - previous.y;
            const length = Math.max(1, Math.hypot(dx, dy));
            const nx = -dy / length * 5;
            const ny = dx / length * 5;
            return <line key={sampleIndex} className="park-track-tie"
              x1={point.x - nx} y1={point.y - ny} x2={point.x + nx} y2={point.y + ny} />;
          })}
          {piece.kind !== 'Station' && <text className="park-track-label"
            x={piece.samples[Math.floor(piece.samples.length / 2)].x + 7}
            y={piece.samples[Math.floor(piece.samples.length / 2)].y - 7}>{piece.kind}</text>}
          {piece.kind === 'Lift' && <text className="park-track-label park-track-label--crest"
            x={piece.samples[piece.samples.length - 1].x + 7}
            y={piece.samples[piece.samples.length - 1].y - 7}>Crest</text>}
        </g>)}
    </g>
    <g className="park-roller-orb roller-orb" transform={`translate(${rider.x} ${rider.y}) rotate(${angle})`}>
      <line x1="-14" y1="0" x2="-6" y2="0" />
      <circle r="7" />
      <path d="M4 -4 L12 0 L4 4 Z" />
    </g>
  </g>;
}

function ParkBumperCars({ state, role, focused }: {
  state: ExperienceState['bumperCars']; role: AttentionRole; focused: boolean;
}) {
  return <g data-park-actor="bumper-cars" data-spatial-role="musical-actor"
    data-attention-role={role}
    data-focused={focused || undefined}
    aria-label={`BumperCars ${state.mode}`}>
    <rect className="park-bumper-boundary"
      x={PARK_BUMPER_CARS_BOUNDS.x * PARK_VIEWBOX.width}
      y={PARK_BUMPER_CARS_BOUNDS.y * PARK_VIEWBOX.height}
      width={PARK_BUMPER_CARS_BOUNDS.width * PARK_VIEWBOX.width}
      height={PARK_BUMPER_CARS_BOUNDS.height * PARK_VIEWBOX.height} rx="18" />
    <text className="park-map-label" x={PARK_BUMPER_CARS_BOUNDS.x * PARK_VIEWBOX.width + 10}
      y={PARK_BUMPER_CARS_BOUNDS.y * PARK_VIEWBOX.height + 17}>BUMPER CARS</text>
    {state.bodies.map(body => {
      const world = bumperArenaPointToWorld(body, state.arena, PARK_BUMPER_CARS_BOUNDS);
      const point = worldToPark(world);
      const width = body.width / state.arena.width * PARK_BUMPER_CARS_BOUNDS.width * PARK_VIEWBOX.width;
      const height = body.height / state.arena.height * PARK_BUMPER_CARS_BOUNDS.height * PARK_VIEWBOX.height;
      return <g key={body.id} className={body.id === state.selectedBody ? 'bumper-car bumper-car--selected' : 'bumper-car'}
        data-world-x={world.x} data-world-y={world.y}
        transform={`translate(${point.x} ${point.y}) rotate(${body.angle * 180 / Math.PI})`}>
        <rect x={-width / 2} y={-height / 2} width={width} height={height} rx="6" />
        <circle r="3.5" />
      </g>;
    })}
  </g>;
}

function ParkFreeBodies({ state }: { state: ExperienceState['freeBodies'] }) {
  return <g data-park-actor="free-bodies" data-spatial-role="global-atmosphere"
    style={{
      '--park-free-body-opacity': PARK_FREE_BODY_PRESENTATION.opacity,
      '--park-free-body-selected-opacity': PARK_FREE_BODY_PRESENTATION.selectedOpacity,
      '--park-free-body-quiet-opacity': PARK_FREE_BODY_PRESENTATION.quietOpacity,
    } as CSSProperties}
    aria-label={`${state.bodies.length} Free Bodies`}>
    {state.bodies.map(body => {
      const point = worldToPark(body.position);
      const quiet = PARK_FREE_BODY_QUIET_ZONES.some(bounds => pointInBounds(body.position, bounds));
      return <g key={body.id} className={body.id === state.selectedBodyId ? 'free-body free-body--selected' : 'free-body'}
        data-free-body-id={body.id} data-world-x={body.position.x} data-world-y={body.position.y}
        data-density={quiet ? 'quiet' : 'open'}
        transform={`translate(${point.x} ${point.y})`}>
        <DoodleCircle cx={0} cy={0} r={Math.min(PARK_FREE_BODY_PRESENTATION.maximumRadius,
          Math.max(quiet ? 2.5 : 4, body.radius * (quiet ? 150 : 280)))}
          seed={`free-body-${body.id}`} roughness={quiet ? 0.28 : 0.55} secondary={body.id === state.selectedBodyId} />
        {body.id === state.selectedBodyId && <line x1="0" y1="0"
          x2={body.velocity.x * 150} y2={body.velocity.y * 150} />}
      </g>;
    })}
  </g>;
}

const ACTOR_LABELS: Record<AttentionActorId, string> = {
  carousel: 'Carousel', ferrisWheel: 'FerrisWheel', pirateShip: 'PirateShip',
  bumperCars: 'BumperCars', dropTower: 'DropTower', rollerCoaster: 'RollerCoaster',
};

export function ParkMap({
  state, worldRef, showPhysicsDebug, onContentLayout, attention, onFocus, onOverview,
}: ParkMapProps) {
  const focusBounds = attention.focusActorId ? PARK_FOCUS_BOUNDS[attention.focusActorId] : null;
  const viewport = focusBounds ? focusViewport(focusBounds) : PARK_OVERVIEW_VIEWPORT;
  const viewportStyle = {
    '--park-camera-scale': viewport.scale,
    '--park-camera-x': `${viewport.x * 100}%`,
    '--park-camera-y': `${viewport.y * 100}%`,
  } as CSSProperties;

  useEffect(() => {
    if (attention.mode !== 'focus') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOverview();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [attention.mode, onOverview]);

  return <section className="park-composition" aria-labelledby="park-map-heading">
    <div className="park-composition-heading">
        <div><p className="eyebrow">Technical doodle · shared spatial score</p>
        <h2 id="park-map-heading">Park Map</h2></div>
      <div className="park-attention-navigation">
        <span>{attention.mode === 'focus' ? `${ACTOR_LABELS[attention.focusActorId!]} Focus` : 'Overview'}</span>
        {attention.mode === 'focus' && <button type="button" onClick={onOverview}>Back to Overview</button>}
      </div>
    </div>
    <div className="park-map" ref={worldRef} data-composition="park-map"
      data-attention-mode={attention.mode} data-focus-actor={attention.focusActorId ?? 'none'}
      data-attention-transition={attention.transition}
      data-reduced-motion={String(attention.reducedMotion)}
      onClick={event => {
        if (attention.mode === 'focus' && !(event.target as Element).closest('[data-focus-trigger]')) onOverview();
      }}>
      <div className="park-viewport" style={viewportStyle} data-viewport-scale={viewport.scale}
        data-viewport-x={viewport.x} data-viewport-y={viewport.y}>
      <svg className="park-map-base" viewBox={`0 0 ${PARK_VIEWBOX.width} ${PARK_VIEWBOX.height}`}
        role="img" aria-label="Shared Z.land park map with musical actor districts, Park Train, and Free Bodies">
        <ParkTrain />
        <g className="park-districts">
          {(Object.entries(PARK_DISTRICT_CONTOURS) as [keyof typeof PARK_DISTRICT_CONTOURS, string][])
            .map(([district, d]) => <g key={district} className="park-district-group"
              data-park-district={district} data-attention-role={attention.roles[district]}>
              <path className={`park-district-fill park-district-fill--${district}`} d={d} />
              <DoodlePath className={`park-district park-district--${district}`} d={d}
                seed={`district-${district}`} roughness={2.1} secondary />
            </g>)}
        </g>
        {PARK_PATHS.map((d, index) => <DoodlePath key={index} className="park-path" d={d}
          seed={`park-path-${index}`} roughness={1.25} />)}
        <ParkFreeBodies state={state.freeBodies} />
        <ParkRollerCoaster state={state.rollerCoaster} trackMap={state.rollerCoasterTrackMap} role={attention.roles.rollerCoaster}
          focused={attention.focusActorId === 'rollerCoaster'} />
        <ParkBumperCars state={state.bumperCars} role={attention.roles.bumperCars}
          focused={attention.focusActorId === 'bumperCars'} />
      </svg>

      {(['carousel', 'ferrisWheel', 'pirateShip', 'dropTower'] as const).map(actor => <div key={actor}
        className={`park-node park-node--${actor}`} style={boundsStyle(PARK_ACTOR_ANCHORS[actor])}
        data-park-actor={actor === 'ferrisWheel' ? 'ferris-wheel' : actor === 'pirateShip' ? 'pirate-ship' : actor === 'dropTower' ? 'drop-tower' : actor}
        data-spatial-role="musical-actor"
        data-attention-role={attention.roles[actor]}
        data-focused={attention.focusActorId === actor || undefined}
        data-anchor-x={PARK_ACTOR_ANCHORS[actor].x} data-anchor-y={PARK_ACTOR_ANCHORS[actor].y}>
        <span className="park-node-label">{actor === 'ferrisWheel' ? 'FerrisWheel' : actor === 'pirateShip' ? 'PirateShip' : actor === 'dropTower' ? 'DropTower' : 'Carousel'}</span>
        {actor === 'carousel' && <CarouselView state={state.carousel} doodle />}
        {actor === 'ferrisWheel' && <FerrisWheelView state={state.ferrisWheel} doodle />}
        {actor === 'pirateShip' && <PirateShipView state={state.pirateShip}
          districtFit={PARK_PIRATE_SHIP_RENDERER.fit === 'district-height'} doodle />}
        {actor === 'dropTower' && <DropTowerView state={state.dropTower}
          districtFit={PARK_DROP_TOWER_RENDERER.fit === 'district-height'} doodle />}
      </div>)}

      <LiveAnnotationSystem state={state} attention={attention} />

      <div className="park-gate" style={boundsStyle(PARK_GATE_BOUNDS)} data-park-landmark="gate"
        data-spatial-role="experience-infrastructure">
        <span>OUTSIDE</span><i /><strong>GATE</strong><i /><span>Z.LAND</span>
      </div>

      <AnchoredContentView state={state.content} worldElementRef={worldRef}
        onLayout={onContentLayout} layoutStyle={boundsStyle(PARK_CONTENT_BOUNDS)} />

      {showPhysicsDebug && <svg className="park-physics-debug" viewBox={`0 0 ${PARK_VIEWBOX.width} ${PARK_VIEWBOX.height}`} aria-hidden="true">
        <PhysicsDebugOverlay arena={PARK_VIEWBOX} physics={state.physics}
          receiver={state.content} freeBodies={state.freeBodies} />
      </svg>}
      {(Object.keys(PARK_FOCUS_BOUNDS) as AttentionActorId[]).map(actorId => <button key={actorId}
        type="button" className="park-focus-trigger" style={boundsStyle(PARK_ACTOR_ANCHORS[actorId])}
        data-focus-trigger={actorId} aria-label={`Focus ${ACTOR_LABELS[actorId]}`}
        aria-pressed={attention.focusActorId === actorId}
        onClick={event => { event.stopPropagation(); onFocus(actorId); }} />)}
      </div>
    </div>
  </section>;
}
