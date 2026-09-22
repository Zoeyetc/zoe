import type { AnchoredContentParticipantState } from './AnchoredContentParticipant';
import type { PhysicsDebugState } from './types';
import type { BumperArena } from '../rides/bumper-cars/simulation';
import type { FreeBodiesState } from '../free-bodies/simulation';

type PhysicsDebugOverlayProps = Readonly<{
  arena: BumperArena;
  physics: PhysicsDebugState;
  receiver: AnchoredContentParticipantState;
  freeBodies?: FreeBodiesState;
}>;

/** Debug-only projection of actual PhysicsWorld impact and continuous wake data. */
export function PhysicsDebugOverlay({ arena, physics, receiver, freeBodies }: PhysicsDebugOverlayProps) {
  const impact = physics.latestImpact;
  const wake = physics.latestWake;
  if (!impact && !wake && !freeBodies) return null;

  const receiverX = receiver.worldPosition.x * arena.width;
  const receiverY = receiver.worldPosition.y * arena.height;
  const anchorX = receiver.anchor.x * arena.width;
  const anchorY = receiver.anchor.y * arena.height;
  const receiverGotLatestImpact = impact && receiver.latestImpactId === impact.id;
  const impulseScale = 70;
  const wakeReceiverBody = freeBodies?.bodies.find(
    body => `free-body:${body.id}` === physics.latestWakeReception?.receiverId,
  );
  const wakeReceiverX = wakeReceiverBody ? wakeReceiverBody.position.x * arena.width : receiverX;
  const wakeReceiverY = wakeReceiverBody ? wakeReceiverBody.position.y * arena.height : receiverY;

  let wakeShape = '';
  let wakeX = 0;
  let wakeY = 0;
  let wakeForwardX = 0;
  let wakeForwardY = 0;
  if (wake) {
    wakeX = wake.position.x * arena.width;
    wakeY = wake.position.y * arena.height;
    wakeForwardX = wake.forward.x * 58;
    wakeForwardY = wake.forward.y * 58;
    const trailX = wakeX - wake.forward.x * wake.radius * arena.width;
    const trailY = wakeY - wake.forward.y * wake.radius * arena.height;
    const perpendicularX = -wake.forward.y * wake.radius * arena.width * 0.34;
    const perpendicularY = wake.forward.x * wake.radius * arena.height * 0.34;
    wakeShape = `M ${wakeX} ${wakeY} L ${trailX + perpendicularX} ${trailY + perpendicularY}`
      + ` L ${trailX - perpendicularX} ${trailY - perpendicularY} Z`;
  }

  return <g className="physics-debug-overlay" aria-hidden="true"
    data-impact-id={impact?.id} data-impact-timestamp={impact?.timestamp}
    data-receiver-distance={physics.latestReceiverDistance ?? undefined}
    data-wake-source={wake?.sourceId} data-wake-active={wake?.active}
    data-wake-strength={wake?.strength} data-wake-speed={wake?.speed}>
    <defs>
      <marker id="physics-debug-arrow" viewBox="0 0 8 8" refX="7" refY="4"
        markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M 0 0 L 8 4 L 0 8 z" />
      </marker>
    </defs>
    {impact && <>
      <ellipse className="physics-debug-radius" cx={impact.position.x * arena.width}
        cy={impact.position.y * arena.height} rx={impact.radius * arena.width} ry={impact.radius * arena.height} />
      <line className="physics-debug-normal" x1={impact.position.x * arena.width} y1={impact.position.y * arena.height}
        x2={impact.position.x * arena.width + impact.direction.x * (28 + impact.strength * 34)}
        y2={impact.position.y * arena.height + impact.direction.y * (28 + impact.strength * 34)}
        markerEnd="url(#physics-debug-arrow)" />
      <circle className="physics-debug-impact" cx={impact.position.x * arena.width}
        cy={impact.position.y * arena.height} r="7" />
      <path className="physics-debug-crosshair"
        d={`M ${impact.position.x * arena.width - 11} ${impact.position.y * arena.height} H ${impact.position.x * arena.width + 11} M ${impact.position.x * arena.width} ${impact.position.y * arena.height - 11} V ${impact.position.y * arena.height + 11}`} />
      {receiverGotLatestImpact && <>
        <line className="physics-debug-force-path" x1={impact.position.x * arena.width}
          y1={impact.position.y * arena.height} x2={receiverX} y2={receiverY}
          markerEnd="url(#physics-debug-arrow)" />
        <line className="physics-debug-impulse" x1={receiverX} y1={receiverY}
          x2={receiverX + receiver.latestReceivedImpulse.x * impulseScale}
          y2={receiverY + receiver.latestReceivedImpulse.y * impulseScale}
          markerEnd="url(#physics-debug-arrow)" />
      </>}
    </>}
    {wake && <g className={`physics-debug-wake${wake.active ? ' physics-debug-wake--active' : ''}`}>
      <path className="physics-debug-wake-shape" d={wakeShape} />
      <line className="physics-debug-wake-forward" x1={wakeX} y1={wakeY}
        x2={wakeX + wakeForwardX} y2={wakeY + wakeForwardY}
        markerEnd="url(#physics-debug-arrow)" />
      <circle className="physics-debug-wake-source" cx={wakeX} cy={wakeY} r="7" />
      {physics.latestWakeReception && <>
        <line className="physics-debug-wake-path" x1={wakeX} y1={wakeY}
          x2={wakeReceiverX} y2={wakeReceiverY} />
        <line className="physics-debug-wake-force" x1={wakeReceiverX} y1={wakeReceiverY}
          x2={wakeReceiverX + physics.latestWakeReception.force.x * 90}
          y2={wakeReceiverY + physics.latestWakeReception.force.y * 90}
          markerEnd="url(#physics-debug-arrow)" />
      </>}
      <text className="physics-debug-wake-label" x={wakeX + 10} y={wakeY - 10}>
        {wake.speed.toFixed(0)} · {wake.strength.toFixed(2)}
      </text>
    </g>}
    {freeBodies && <g className="physics-debug-free-bodies">
      {freeBodies.bodies.map(body => {
        const x = body.position.x * arena.width;
        const y = body.position.y * arena.height;
        const selected = body.id === freeBodies.selectedBodyId;
        return <g key={body.id} data-free-body-id={body.id} data-free-body-sleeping={body.sleeping}>
          <circle className="physics-debug-free-body" cx={x} cy={y} r={Math.max(4, body.radius * arena.width)} />
          <line className="physics-debug-free-velocity" x1={x} y1={y}
            x2={x + body.velocity.x * 130} y2={y + body.velocity.y * 130} />
          {selected && <>
            <line className="physics-debug-free-atmosphere" x1={x} y1={y}
              x2={x + body.atmosphericForce.x * 210} y2={y + body.atmosphericForce.y * 210} />
            <line className="physics-debug-free-world" x1={x} y1={y}
              x2={x + body.physicsForce.x * 110} y2={y + body.physicsForce.y * 110} />
            <line className="physics-debug-free-impact" x1={x} y1={y}
              x2={x + body.latestImpactImpulse.x * 300} y2={y + body.latestImpactImpulse.y * 300} />
            <line className="physics-debug-free-combined" x1={x} y1={y}
              x2={x + body.combinedForce.x * 110} y2={y + body.combinedForce.y * 110}
              markerEnd="url(#physics-debug-arrow)" />
          </>}
        </g>;
      })}
    </g>}
    <line className="physics-debug-displacement" x1={anchorX} y1={anchorY}
      x2={receiverX} y2={receiverY} markerEnd="url(#physics-debug-arrow)" />
    <circle className="physics-debug-anchor" cx={anchorX} cy={anchorY} r="4" />
    <rect className="physics-debug-receiver" x={receiverX - 6} y={receiverY - 6} width="12" height="12" />
  </g>;
}
