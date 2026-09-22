import type { ExperienceState } from '../experience/createExperience';

export function DebugConsole({ state }: { state: ExperienceState }) {
  return <section aria-labelledby="debug-heading">
    <h2 id="debug-heading">DebugConsole</h2>
    <p>AudioWorld: timeline crossings active · BumperCars seed: {state.bumperCars.seed}</p>
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
      position {state.physics.latestImpact
        ? `${state.physics.latestImpact.position.x.toFixed(2)}, ${state.physics.latestImpact.position.y.toFixed(2)}` : '—'} ·{' '}
      strength {state.physics.latestImpact?.strength.toFixed(2) ?? '—'} · radius {state.physics.latestImpact?.radius.toFixed(2) ?? '—'} ·{' '}
      receiver distance {state.physics.latestReceiverDistance?.toFixed(2) ?? '—'}
    </p>
    <p className="event-log"><strong>Test Receiver:</strong>{' '}
      offset {state.receiver.offset.x.toFixed(3)}, {state.receiver.offset.y.toFixed(3)} ·{' '}
      rotation {(state.receiver.rotation * 180 / Math.PI).toFixed(2)}° ·{' '}
      {state.receiver.active ? 'active' : 'settled'}
    </p>
    <p className="event-log"><strong>Recent events:</strong>{' '}
      {state.recentEvents.length
        ? state.recentEvents.map(event => `${event.type}@${event.type === 'seek' ? event.to.toFixed(2) : event.time.toFixed(2)}`).join(' · ')
        : 'none'}
    </p>
    <pre>{JSON.stringify(state, null, 2)}</pre>
  </section>;
}
