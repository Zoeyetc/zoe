import type { ExperienceState } from '../experience/createExperience';
import type { AttentionState } from '../experience/attention';
import { PARK_FOCUS_BOUNDS, PARK_OVERVIEW_VIEWPORT, focusViewport } from '../experience/park/config';

export function DebugConsole({ state, attention }: { state: ExperienceState; attention?: AttentionState }) {
  const focusBounds = attention?.focusActorId ? PARK_FOCUS_BOUNDS[attention.focusActorId] : null;
  const viewport = focusBounds ? focusViewport(focusBounds) : PARK_OVERVIEW_VIEWPORT;
  return <section aria-labelledby="debug-heading">
    <h2 id="debug-heading">DebugConsole</h2>
    {attention && <p className="event-log" data-debug-attention><strong>Experience Attention:</strong>{' '}
      mode {attention.mode} · manual focus {attention.focusActorId ?? '—'} · automatic primary {attention.primaryActorId ?? '—'} ·{' '}
      transition {attention.transition} · roles {Object.entries(attention.roles).map(([id, role]) => `${id}:${role}`).join(', ')} ·{' '}
      focus bounds {focusBounds ? `${focusBounds.x}, ${focusBounds.y}, ${focusBounds.width}, ${focusBounds.height}` : 'overview'} ·{' '}
      viewport scale {viewport.scale.toFixed(3)} translate {viewport.x.toFixed(3)}, {viewport.y.toFixed(3)}
    </p>}
    <p>AudioWorld: timeline crossings active · BumperCars seed: {state.bumperCars.seed}</p>
    <p className="event-log"><strong>Spectrum / Free Bodies:</strong>{' '}
      available {String(state.frame.snapshot.spectrum.available)} · brightness {state.frame.snapshot.spectrum.brightness.toFixed(2)} ·{' '}
      texture {state.frame.snapshot.spectrum.texture.toFixed(2)} · low/mid/high{' '}
      {state.frame.snapshot.spectrum.low.toFixed(2)} / {state.frame.snapshot.spectrum.mid.toFixed(2)} / {state.frame.snapshot.spectrum.high.toFixed(2)} ·{' '}
      bodies {state.freeBodies.bodies.length} · seed {state.freeBodies.seed} · average speed {state.freeBodies.averageSpeed.toFixed(3)} ·{' '}
      max speed {state.freeBodies.maxSpeed.toFixed(3)} · active/sleeping {state.freeBodies.activeCount}/{state.freeBodies.sleepingCount} ·{' '}
      selected {state.freeBodies.selectedBodyId} · position{' '}
      {state.freeBodies.bodies[0]
        ? `${state.freeBodies.bodies[0].position.x.toFixed(3)}, ${state.freeBodies.bodies[0].position.y.toFixed(3)}` : '—'} · velocity{' '}
      {state.freeBodies.bodies[0]
        ? `${state.freeBodies.bodies[0].velocity.x.toFixed(3)}, ${state.freeBodies.bodies[0].velocity.y.toFixed(3)}` : '—'} · atmosphere{' '}
      {state.freeBodies.bodies[0]
        ? `${state.freeBodies.bodies[0].atmosphericForce.x.toFixed(3)}, ${state.freeBodies.bodies[0].atmosphericForce.y.toFixed(3)}` : '—'} · PhysicsWorld{' '}
      {state.freeBodies.bodies[0]
        ? `${state.freeBodies.bodies[0].physicsForce.x.toFixed(3)}, ${state.freeBodies.bodies[0].physicsForce.y.toFixed(3)}` : '—'} · combined{' '}
      {state.freeBodies.bodies[0]
        ? `${state.freeBodies.bodies[0].combinedForce.x.toFixed(3)}, ${state.freeBodies.bodies[0].combinedForce.y.toFixed(3)}` : '—'}
    </p>
    <p className="event-log"><strong>Harmony / FerrisWheel:</strong>{' '}
      available {String(state.frame.snapshot.harmony.available)} · chord {state.frame.snapshot.harmony.chord ?? '—'} ·{' '}
      root {state.frame.snapshot.harmony.rootPitchClass ?? '—'} · confidence {state.frame.snapshot.harmony.confidence.toFixed(2)} ·{' '}
      latest change {state.ferrisWheel.latestChordChange ?? '—'} · angle {state.ferrisWheel.wheelAngle.toFixed(3)} ·{' '}
      velocity {state.ferrisWheel.wheelAngularVelocity.toFixed(3)} · active cabins {state.ferrisWheel.activeCabinIds.join(', ') || '—'} ·{' '}
      max swing {Math.max(...state.ferrisWheel.cabins.map(cabin => Math.abs(cabin.swingAngle))).toFixed(3)} · {state.ferrisWheel.mode}
    </p>
    <p className="event-log"><strong>Structure / DropTower:</strong>{' '}
      available {String(state.frame.snapshot.structure.available)} · section {state.frame.snapshot.structure.section ?? '—'} ·{' '}
      progress {state.frame.snapshot.structure.sectionProgress.toFixed(2)} · build {state.frame.snapshot.structure.build.toFixed(2)} ·{' '}
      tension {state.frame.snapshot.structure.tension.toFixed(2)} · energy {state.frame.snapshot.structure.energy.toFixed(2)} ·{' '}
      latest drop {state.dropTower.latestDropEvent ?? '—'} · phase {state.dropTower.phase} ·{' '}
      position {state.dropTower.position.toFixed(3)} · velocity {state.dropTower.velocity.toFixed(3)} ·{' '}
      target {state.dropTower.liftTarget.toFixed(3)} · hold {String(state.dropTower.phase === 'HOLDING')} ·{' '}
      reduced {String(state.dropTower.reducedMotion)}
    </p>
    <p className="event-log"><strong>Phrase / RollerCoaster:</strong>{' '}
      available {String(state.frame.snapshot.structure.available)} · phrase {state.frame.snapshot.structure.phraseProgress.toFixed(2)} ·{' '}
      section {state.frame.snapshot.structure.section ?? '—'} · section progress {state.frame.snapshot.structure.sectionProgress.toFixed(2)} ·{' '}
      energy {state.frame.snapshot.structure.energy.toFixed(2)} · tension {state.frame.snapshot.structure.tension.toFixed(2)} ·{' '}
      release {String(state.rollerCoaster.releaseActive)} · latest release {state.rollerCoaster.latestRelease ?? '—'} ·{' '}
      mode {state.rollerCoaster.mode} · segment {state.rollerCoaster.currentSegment} ·{' '}
      distance {state.rollerCoaster.routeDistance.toFixed(1)} / {state.rollerCoaster.routeLength.toFixed(1)} ·{' '}
      progress {state.rollerCoaster.routeProgress.toFixed(3)} · velocity {state.rollerCoaster.velocity.toFixed(2)} ·{' '}
      acceleration {state.rollerCoaster.acceleration.toFixed(2)} · drive {state.rollerCoaster.driveTarget.toFixed(2)} ·{' '}
      braking {String(state.rollerCoaster.braking)} · rider{' '}
      {state.rollerCoaster.riderPosition.x.toFixed(1)}, {state.rollerCoaster.riderPosition.y.toFixed(1)}, {state.rollerCoaster.riderPosition.z.toFixed(1)} ·{' '}
      reduced {String(state.rollerCoaster.reducedMotion)}
    </p>
    <p className="event-log"><strong>BumperCars:</strong>{' '}
      {state.bumperCars.latestPercussion ?? 'no percussion'} · strength {state.bumperCars.eventStrength.toFixed(2)} ·{' '}
      body {state.bumperCars.selectedBody === null ? '—' : state.bumperCars.selectedBody + 1} ·{' '}
      activity {Math.round(state.bumperCars.kineticActivity)} · {state.bumperCars.mode}
    </p>
    <p className="event-log"><strong>PirateShip:</strong>{' '}
      BPM {state.pirateShip.bpm ?? '—'} · beat {state.pirateShip.beatPhase.toFixed(2)} ·{' '}
      bar {state.pirateShip.barPhase.toFixed(2)} · groove {state.pirateShip.groove.toFixed(2)} ·{' '}
      swing {state.pirateShip.swing.toFixed(2)} · angle {(state.pirateShip.angle * 180 / Math.PI).toFixed(1)}° ·{' '}
      velocity {state.pirateShip.angularVelocity.toFixed(2)} · drive {state.pirateShip.driveAmplitude.toFixed(2)} ·{' '}
      error {state.pirateShip.phaseError.toFixed(2)} · {state.pirateShip.mode}
    </p>
    <p className="event-log"><strong>PhysicsWorld:</strong>{' '}
      {state.physics.registeredSources} source · {state.physics.registeredReceivers} receiver ·{' '}
      {state.physics.impactCount} impact · latest {state.physics.latestImpact?.id ?? '—'} ·{' '}
      source {state.physics.latestImpact?.sourceId ?? '—'} · timestamp {state.physics.latestImpact?.timestamp.toFixed(3) ?? '—'} ·{' '}
      position {state.physics.latestImpact
        ? `${state.physics.latestImpact.position.x.toFixed(2)}, ${state.physics.latestImpact.position.y.toFixed(2)}` : '—'} ·{' '}
      normal {state.physics.latestImpact
        ? `${state.physics.latestImpact.direction.x.toFixed(2)}, ${state.physics.latestImpact.direction.y.toFixed(2)}` : '—'} ·{' '}
      strength {state.physics.latestImpact?.strength.toFixed(2) ?? '—'} · radius {state.physics.latestImpact?.radius.toFixed(2) ?? '—'} ·{' '}
      receiver distance {state.physics.latestReceiverDistance?.toFixed(2) ?? '—'}
    </p>
    <p className="event-log"><strong>RollerCoaster Physics Source:</strong>{' '}
      registered {state.physics.registeredSources >= 2 ? 'true' : 'false'} ·{' '}
      active {String(state.physics.latestWake?.active ?? false)} ·{' '}
      position {state.physics.latestWake
        ? `${state.physics.latestWake.position.x.toFixed(3)}, ${state.physics.latestWake.position.y.toFixed(3)}` : '—'} ·{' '}
      forward {state.physics.latestWake
        ? `${state.physics.latestWake.forward.x.toFixed(3)}, ${state.physics.latestWake.forward.y.toFixed(3)}` : '—'} ·{' '}
      speed {state.physics.latestWake?.speed.toFixed(2) ?? '—'} · acceleration {state.physics.latestWake?.acceleration.toFixed(2) ?? '—'} ·{' '}
      radius {state.physics.latestWake?.radius.toFixed(3) ?? '—'} · strength {state.physics.latestWake?.strength.toFixed(3) ?? '—'} ·{' '}
      receiver {state.physics.latestWakeReception?.receiverId ?? '—'} · distance {state.physics.latestWakeReception?.distance.toFixed(3) ?? '—'} ·{' '}
      alignment {state.physics.latestWakeReception?.alignment.toFixed(3) ?? '—'} ·{' '}
      falloff {state.physics.latestWakeReception?.falloff.toFixed(3) ?? '—'} · force{' '}
      {state.physics.latestWakeReception
        ? `${state.physics.latestWakeReception.force.x.toFixed(3)}, ${state.physics.latestWakeReception.force.y.toFixed(3)}` : '—'}
    </p>
    <p className="event-log"><strong>Anchored Content:</strong>{' '}
      {state.content.id} · anchor {state.content.anchor.x.toFixed(3)}, {state.content.anchor.y.toFixed(3)} ·{' '}
      bounds {state.content.bounds.x.toFixed(3)}, {state.content.bounds.y.toFixed(3)}, {state.content.bounds.width.toFixed(3)}, {state.content.bounds.height.toFixed(3)} ·{' '}
      velocity {state.content.velocity.x.toFixed(3)}, {state.content.velocity.y.toFixed(3)} ·{' '}
      received impulse {state.content.latestReceivedImpulse.x.toFixed(3)}, {state.content.latestReceivedImpulse.y.toFixed(3)} ·{' '}
      impact distance {state.content.latestImpactDistance?.toFixed(3) ?? '—'} ·{' '}
      wake {state.content.latestWakeSource ?? '—'} · wake distance {state.content.latestWakeDistance?.toFixed(3) ?? '—'} ·{' '}
      alignment {state.content.latestWakeAlignment.toFixed(3)} · falloff {state.content.latestWakeFalloff.toFixed(3)} ·{' '}
      received force {state.content.latestReceivedForce.x.toFixed(3)}, {state.content.latestReceivedForce.y.toFixed(3)} ·{' '}
      offset {state.content.offset.x.toFixed(3)}, {state.content.offset.y.toFixed(3)} ({state.content.displacement.toFixed(3)}) ·{' '}
      rotation {(state.content.rotation * 180 / Math.PI).toFixed(2)}° ·{' '}
      {state.content.active ? 'active' : 'settled'} · spring {state.content.springState} · layout revision {state.content.layoutRevision}
    </p>
    <p className="event-log"><strong>Recent events:</strong>{' '}
      {state.recentEvents.length
        ? state.recentEvents.map(event => `${event.type}@${event.type === 'seek' ? event.to.toFixed(2) : event.time.toFixed(2)}`).join(' · ')
        : 'none'}
    </p>
    <pre>{JSON.stringify(state, null, 2)}</pre>
  </section>;
}
