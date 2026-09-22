import type { AnchoredReceiverState } from './AnchoredReceiver';

export function TestReceiverView({ state }: { state: AnchoredReceiverState }) {
  const x = state.offset.x * 220;
  const y = state.offset.y * 140;
  const degrees = state.rotation * 180 / Math.PI;
  return <section className="receiver-panel" aria-labelledby="receiver-heading">
    <div className="section-heading">
      <div><p className="eyebrow">PhysicsWorld receiver · anchored content</p><h2 id="receiver-heading">Test Receiver</h2></div>
      <span className={`status status--${state.active ? 'active' : 'resting'}`}>{state.active ? 'active' : 'settled'}</span>
    </div>
    <div className="receiver-stage">
      <div className="receiver-anchor" aria-hidden="true" />
      <div className="receiver-card" style={{ transform: `translate(${x}px, ${y}px) rotate(${degrees}deg)` }}>
        <strong>PHYSICS RECEIVER</strong><span>world anchor · 0.50, 0.50</span>
      </div>
    </div>
    <dl className="actor-readout">
      <div><dt>Impacts</dt><dd>{state.receivedImpactCount}</dd></div>
      <div><dt>Influence</dt><dd>{state.latestInfluence.toFixed(3)}</dd></div>
      <div><dt>Offset</dt><dd>{state.offset.x.toFixed(3)}, {state.offset.y.toFixed(3)}</dd></div>
      <div><dt>Rotation</dt><dd>{degrees.toFixed(2)}°</dd></div>
    </dl>
  </section>;
}
