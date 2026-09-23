import type { AudioEvent, PercussionKind } from '../../audio/types';
import { ROLLER_WAKE_SOURCE_ID } from '../../physics/adapters/rollerCoaster.ts';
import type { AttentionActorId, AttentionRole, AttentionState } from '../attention';
import type { ExperienceState } from '../createExperience';
import { resolveAnnotationAnchors } from './annotationAnchors.ts';
import { compactAngle, compactNumber, compactSigned, compactUnit } from './formatAnnotation.ts';
import type { AnnotationField, AnnotationState, LiveAnnotationModel } from './annotationTypes.ts';

const PITCH_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;
const ACTOR_LABELS: Record<AttentionActorId, string> = {
  carousel: 'Carousel', ferrisWheel: 'FerrisWheel', pirateShip: 'PirateShip',
  bumperCars: 'BumperCars', dropTower: 'DropTower', rollerCoaster: 'RollerCoaster',
};
const percussionKinds = new Set<PercussionKind>([
  'kick', 'snare', 'closed-hat', 'open-hat', 'tom', 'other-percussion',
]);
type PercussionEvent = Extract<AudioEvent, { type: PercussionKind }>;
const field = (label: string, value: string, emphasis: AnnotationField['emphasis'] = 'normal'): AnnotationField =>
  ({ label, value, emphasis });
const pitchName = (value: number | null) => value === null ? '—' : PITCH_NAMES[value] ?? '—';
const latestPercussion = (events: readonly AudioEvent[]) => [...events].reverse().find(
  (event): event is PercussionEvent => percussionKinds.has(event.type as PercussionKind),
);

function reduceForRole(fields: readonly AnnotationField[], role: AttentionRole, state: AnnotationState) {
  if (role === 'primary' || role === 'secondary') return fields.slice(0, 3);
  if (role === 'ambient') return fields.slice(0, 2);
  return state === 'active' ? fields.slice(0, 2) : [fields[0], field('STATUS', state === 'unavailable' ? 'UNAVAILABLE' : 'LISTENING', 'muted')];
}

export function buildAnnotationModels(state: ExperienceState, attention: AttentionState): readonly LiveAnnotationModel[] {
  const anchors = resolveAnnotationAnchors(state);
  const snapshot = state.frame.snapshot;
  const percussion = latestPercussion(state.recentEvents);
  const selectedCar = state.bumperCars.selectedBody === null ? null
    : state.bumperCars.bodies.find(body => body.id === state.bumperCars.selectedBody) ?? null;
  const trackFeature = state.rollerCoasterTrackMap.segments.find(segment =>
    state.rollerCoaster.routeDistance >= segment.startDistance
      && state.rollerCoaster.routeDistance <= segment.endDistance) ?? null;
  const wake = state.physics.latestWake?.sourceId === ROLLER_WAKE_SOURCE_ID ? state.physics.latestWake : null;

  const definitions: Record<AttentionActorId, { state: AnnotationState; overview: readonly AnnotationField[]; focus: readonly AnnotationField[] }> = {
    carousel: {
      state: !snapshot.melody.available ? 'unavailable' : snapshot.melody.active ? 'active' : 'listening',
      overview: snapshot.melody.available ? [
        field('NOTE', state.carousel.activeNoteName ?? '—', state.carousel.activeNoteName ? 'evidence' : 'muted'),
        field('DEGREE', state.carousel.displayDegree ?? '—', state.carousel.displayDegree ? 'evidence' : 'muted'),
        ...(state.carousel.chromaticMarker.visible
          ? [field('CHROM', compactSigned(state.carousel.chromaticMarker.offset ?? 0, 0), 'evidence')] : []),
        field('CONF', compactUnit(snapshot.melody.confidence), snapshot.melody.active ? 'evidence' : 'muted'),
      ] : [field('NOTE', '—', 'muted'), field('STATUS', 'LISTENING', 'muted')],
      focus: [
        field('NOTE', state.carousel.activeNoteName ?? '—', 'evidence'),
        field('MIDI', state.carousel.activeMidi === null ? '—' : String(state.carousel.activeMidi), 'evidence'),
        field('DEGREE', state.carousel.displayDegree ?? '—', 'evidence'),
        field('TONIC', pitchName(snapshot.melody.scaleDegree.tonicPitchClass), 'evidence'),
        field('CONF', compactUnit(snapshot.melody.confidence), 'evidence'),
        field('SOURCE', snapshot.melody.source?.toUpperCase() ?? '—', 'muted'),
        field('CARRIER', state.carousel.activeRider === null ? '—' : `#${state.carousel.activeRider + 1}`, 'physical'),
        field('CHROM', state.carousel.chromaticMarker.visible ? compactSigned(state.carousel.chromaticMarker.offset ?? 0, 0) : 'IN SCALE', 'evidence'),
      ],
    },
    ferrisWheel: {
      state: !snapshot.harmony.available ? 'unavailable' : snapshot.harmony.active ? 'active' : 'listening',
      overview: [
        field('CHORD', state.ferrisWheel.chord?.toUpperCase() ?? '—', state.ferrisWheel.chord ? 'evidence' : 'muted'),
        field('TONIC', pitchName(state.ferrisWheel.tonalRootPitchClass), state.ferrisWheel.tonalRootPitchClass === null ? 'muted' : 'evidence'),
        field('CONF', compactUnit(state.ferrisWheel.confidence), state.ferrisWheel.chord ? 'evidence' : 'muted'),
      ],
      focus: [
        field('CHORD', state.ferrisWheel.chord?.toUpperCase() ?? '—', 'evidence'),
        field('PITCHES', state.ferrisWheel.activeCabinIds.map(pitchName).join(' ') || '—', 'evidence'),
        field('TONIC', pitchName(state.ferrisWheel.tonalRootPitchClass), 'evidence'),
        field('MODE', state.ferrisWheel.tonalMode?.toUpperCase() ?? '—', 'evidence'),
        field('CONF', compactUnit(state.ferrisWheel.confidence), 'evidence'),
        field('TARGET θ', compactAngle(state.ferrisWheel.targetWheelAngle), 'physical'),
        field('CURRENT θ', compactAngle(state.ferrisWheel.wheelAngle), 'physical'),
        field('ω', compactSigned(state.ferrisWheel.wheelAngularVelocity), 'physical'),
        field('CABINS', state.ferrisWheel.activeCabinIds.map(pitchName).join(' ') || '—', 'physical'),
      ],
    },
    pirateShip: {
      state: snapshot.rhythm.available ? (snapshot.transport.playing ? 'active' : 'listening') : 'unavailable',
      overview: [
        field('BPM', compactNumber(state.pirateShip.bpm, 1), state.pirateShip.bpm === null ? 'muted' : 'evidence'),
        field('PHASE', state.pirateShip.bpm === null ? '—' : compactUnit(state.pirateShip.beatPhase), 'evidence'),
        field('ANGLE', compactAngle(state.pirateShip.angle), 'physical'),
      ],
      focus: [
        field('BPM', compactNumber(state.pirateShip.bpm, 1), 'evidence'),
        field('PHASE', state.pirateShip.bpm === null ? '—' : compactUnit(state.pirateShip.beatPhase), 'evidence'),
        field('GROOVE', compactUnit(state.pirateShip.groove), 'evidence'),
        field('SWING', compactUnit(state.pirateShip.swing), 'evidence'),
        field('ANGLE', compactAngle(state.pirateShip.angle), 'physical'),
        field('ω', compactSigned(state.pirateShip.angularVelocity), 'physical'),
        field('DRIVE', compactSigned(state.pirateShip.driveTorque), 'physical'),
      ],
    },
    bumperCars: {
      state: !snapshot.percussion.available ? 'unavailable' : state.bumperCars.latestPercussion ? 'active' : 'listening',
      overview: [
        field('LAST', state.bumperCars.latestPercussion?.toUpperCase() ?? '—', state.bumperCars.latestPercussion ? 'evidence' : 'muted'),
        field('IMPULSE', compactUnit(state.bumperCars.eventStrength), 'physical'),
        field('COLL', String(state.bumperCars.collisionCount), 'physical'),
      ],
      focus: [
        field('LAST ROLE', state.bumperCars.latestPercussion?.toUpperCase() ?? '—', 'evidence'),
        field('INTENSITY', compactUnit(state.bumperCars.eventStrength), 'evidence'),
        field('CONF', percussion?.confidence === undefined ? '—' : compactUnit(percussion.confidence), 'evidence'),
        field('ROLE CAR', selectedCar?.role.toUpperCase() ?? '—', 'physical'),
        field('CAR SPEED', selectedCar ? compactNumber(Math.hypot(selectedCar.vx, selectedCar.vy)) : '—', 'physical'),
        field('ANGULAR ω', selectedCar ? compactSigned(selectedCar.angularVelocity) : '—', 'physical'),
        field('COLLISIONS', String(state.bumperCars.collisionCount), 'physical'),
      ],
    },
    dropTower: {
      state: !snapshot.structure.available ? 'unavailable' : state.dropTower.phase === 'IDLE' ? 'listening' : 'active',
      overview: [
        field('SECTION', state.dropTower.section?.toUpperCase() ?? '—', state.dropTower.section ? 'evidence' : 'muted'),
        field('TENSION', compactUnit(state.dropTower.tension), 'evidence'),
        field('STATE', state.dropTower.phase, 'physical'),
      ],
      focus: [
        field('SECTION', state.dropTower.section?.toUpperCase() ?? '—', 'evidence'),
        field('PROGRESS', compactUnit(state.dropTower.sectionProgress), 'evidence'),
        field('BUILD', compactUnit(state.dropTower.build), 'evidence'),
        field('TENSION', compactUnit(state.dropTower.tension), 'evidence'),
        field('RELEASE', compactUnit(state.dropTower.drive.release), 'evidence'),
        field('STATE', state.dropTower.phase, 'physical'),
        field('HEIGHT', compactUnit(1 - state.dropTower.position), 'physical'),
        field('VELOCITY', compactSigned(state.dropTower.velocity), 'physical'),
        field('COOLDOWN', `${compactNumber(state.dropTower.drive.cooldownRemaining, 1)}s`, 'muted'),
      ],
    },
    rollerCoaster: {
      state: !state.rollerCoaster.structureAvailable ? 'unavailable'
        : state.rollerCoaster.mode === 'station' ? 'listening' : 'active',
      overview: [
        field('SEGMENT', trackFeature?.featureId.toUpperCase() ?? state.rollerCoaster.currentSegment.toUpperCase(), 'evidence'),
        field('SPEED', compactNumber(state.rollerCoaster.velocity), 'physical'),
        field('WAKE', compactUnit(wake?.strength ?? 0), 'physical'),
      ],
      focus: [
        field('TRACK FEATURE', trackFeature?.featureId.toUpperCase() ?? state.rollerCoaster.currentSegment.toUpperCase(), 'evidence'),
        field('SOURCE', trackFeature?.sourceEvidence.sectionIds.join(' ') || state.rollerCoaster.section || '—', 'muted'),
        field('ENERGY', compactUnit(state.rollerCoaster.energy), 'evidence'),
        field('IMPORTANCE', compactUnit(trackFeature?.sourceEvidence.importance ?? 0), 'evidence'),
        field('SPEED', compactNumber(state.rollerCoaster.velocity), 'physical'),
        field('ACCEL', compactSigned(state.rollerCoaster.acceleration), 'physical'),
        field('WAKE', compactUnit(wake?.strength ?? 0), 'physical'),
        field('TRACK MAP', state.rollerCoasterTrackMap.id.toUpperCase(), 'muted'),
      ],
    },
  };

  return (Object.keys(definitions) as AttentionActorId[]).map(actorId => {
    const definition = definitions[actorId];
    const focused = attention.mode === 'focus' && attention.focusActorId === actorId;
    return {
      actorId, actorLabel: ACTOR_LABELS[actorId], anchor: anchors[actorId],
      role: attention.roles[actorId], detail: focused ? 'focus' : 'overview', state: definition.state,
      fields: focused ? definition.focus : reduceForRole(definition.overview, attention.roles[actorId], definition.state),
    };
  });
}
