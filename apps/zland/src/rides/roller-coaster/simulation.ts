import type { RollerCoasterInput } from './adapter';
import { clamp } from './geometry.ts';
import { pieceIndexAt, rollerCoasterRoute, sampleRoute } from './route.ts';
import type { Route, SegmentKind, Vec3 } from './types';

export type RollerCoasterMode = 'station' | 'driven' | 'gravity' | 'braking' | 'completed';
export type RollerCoasterState = Readonly<{
  status: 'milestone-nine-f';
  mode: RollerCoasterMode;
  currentSegment: SegmentKind | 'Connector';
  routeDistance: number;
  routeLength: number;
  routeProgress: number;
  velocity: number;
  acceleration: number;
  driveTarget: number;
  braking: boolean;
  riderPosition: Vec3;
  riderForward: Vec3;
  riderUp: Vec3;
  structureAvailable: boolean;
  section: string | null;
  sectionProgress: number;
  phraseProgress: number;
  energy: number;
  tension: number;
  releaseActive: boolean;
  latestRelease: string | null;
  reducedMotion: boolean;
}>;

export type RollerCoasterOptions = Readonly<{ reducedMotion?: boolean; route?: Route }>;
export const ROLLER_MAX_VELOCITY = 360;
export const ROLLER_MAX_ACCELERATION = 320;
export const ROLLER_REDUCED_MAX_VELOCITY = 42;

const clamp01 = (value: number) => clamp(value, 0, 1);
const releaseSection = (section: string | null) => section === 'phrase-release' || section === 'momentum';

/** Canonical segmented route state with milestone-specific musical drive conditions around it. */
export function createRollerCoasterSimulation(options: RollerCoasterOptions = {}) {
  const reducedMotion = options.reducedMotion ?? false;
  const route = options.route ?? rollerCoasterRoute;
  let state: RollerCoasterState;

  const reset = () => {
    const pose = sampleRoute(route, 0);
    state = {
      status: 'milestone-nine-f', mode: 'station', currentSegment: 'Station',
      routeDistance: 0, routeLength: route.length, routeProgress: 0,
      velocity: 0, acceleration: 0, driveTarget: 0, braking: false,
      riderPosition: pose.position, riderForward: pose.forward, riderUp: pose.up,
      structureAvailable: false, section: null, sectionProgress: 0,
      phraseProgress: 0, energy: 0, tension: 0,
      releaseActive: false, latestRelease: null, reducedMotion,
    };
  };
  reset();

  return {
    route,
    read: (): RollerCoasterState => state,
    reset,
    accept(input: RollerCoasterInput, dt: number) {
      if (input.restart) reset();
      if (!input.structureAvailable) {
        reset();
        return;
      }

      const releaseActive = releaseSection(input.section);
      const latestRelease = releaseActive && !state.releaseActive
        ? input.section
        : state.latestRelease;
      state = {
        ...state,
        structureAvailable: true,
        section: input.section,
        sectionProgress: clamp01(input.sectionProgress),
        phraseProgress: clamp01(input.phraseProgress),
        energy: clamp01(input.energy),
        tension: clamp01(input.tension),
        releaseActive,
        latestRelease,
      };

      // Seek updates future physical conditions only. Route state is preserved and no skipped motion is replayed.
      if (input.seek) return;
      if (state.mode === 'completed') return;

      const boundedDt = clamp(dt, 0, 0.1);
      const steps = Math.max(1, Math.ceil(boundedDt * 120));
      const h = boundedDt / steps;
      let routeDistance = state.routeDistance;
      let velocity = state.velocity;
      let acceleration = state.acceleration;
      let driveTarget = state.driveTarget;
      let braking = state.braking;
      let mode: RollerCoasterMode = state.mode;
      let currentSegment = state.currentSegment;

      for (let step = 0; step < steps; step += 1) {
        const piece = route.pieces[pieceIndexAt(route, routeDistance)];
        const segment = piece.segment;
        currentSegment = segment?.kind ?? 'Connector';
        const localDistance = routeDistance - piece.start;
        const tangent = piece.geometry.sampleTangent(clamp(localDistance, 0, piece.geometry.length));
        const nearRouteEnd = route.length - routeDistance < 260;
        const phraseEnding = input.section === 'return';
        const gravityDominated = segment?.kind === 'Drop' || segment?.kind === 'Loop';
        const baseTarget = 26 + input.energy * 210;
        const phraseShaping = 0.9 + 0.1 * Math.sin(input.phraseProgress * Math.PI);
        const releaseBoost = releaseActive ? 1.28 : 1;
        const liftRestraint = segment?.kind === 'Lift' ? 1 - input.tension * 0.58 : 1;
        const crestRestraint = input.section === 'crest' && segment?.kind !== 'Drop' ? 0.68 : 1;
        const pausedDrive = !input.transportPlaying && !gravityDominated ? 0 : 1;
        driveTarget = baseTarget * phraseShaping * releaseBoost * liftRestraint * crestRestraint * pausedDrive;
        if (reducedMotion) driveTarget = Math.min(driveTarget * 0.22, ROLLER_REDUCED_MAX_VELOCITY);
        if (phraseEnding && nearRouteEnd) driveTarget *= 0.25;

        braking = (segment?.kind === 'Station' && routeDistance > route.length * 0.8) || (phraseEnding && nearRouteEnd);
        const maxVelocity = reducedMotion ? ROLLER_REDUCED_MAX_VELOCITY : ROLLER_MAX_VELOCITY;
        const driveForce = segment?.physics.driveForce ?? 62;
        const brakeForce = segment?.physics.brakeForce ?? 120;
        const drag = segment?.physics.drag ?? 3;
        let force = clamp(driveTarget - velocity, -driveForce, driveForce);
        if (gravityDominated || segment?.kind === 'Runout') {
          force += (segment?.physics.gravityScale ?? 0) * tangent.y;
        }
        force -= velocity * drag * 0.018;
        if (braking) {
          const remaining = Math.max(0, route.length - routeDistance);
          const safeTarget = Math.sqrt(2 * brakeForce * remaining) * 0.72;
          force += clamp(safeTarget - velocity, -brakeForce, brakeForce);
        }
        acceleration = clamp(force, -ROLLER_MAX_ACCELERATION, ROLLER_MAX_ACCELERATION);
        const previousVelocity = velocity;
        velocity = clamp(velocity + acceleration * h, 0, maxVelocity);
        let travel = (previousVelocity + velocity) * 0.5 * h;
        if (routeDistance + travel >= route.length) {
          travel = route.length - routeDistance;
          velocity = 0;
          acceleration = 0;
          mode = 'completed';
        } else if (braking) mode = 'braking';
        else if (gravityDominated) mode = 'gravity';
        else if (routeDistance < route.pieces[0].geometry.length && velocity < 0.5) mode = 'station';
        else mode = 'driven';
        routeDistance += travel;
      }

      const pose = sampleRoute(route, routeDistance);
      state = {
        ...state,
        mode,
        currentSegment,
        routeDistance,
        routeProgress: route.length ? routeDistance / route.length : 0,
        velocity,
        acceleration,
        driveTarget,
        braking,
        riderPosition: pose.position,
        riderForward: pose.forward,
        riderUp: pose.up,
      };
    },
  };
}
