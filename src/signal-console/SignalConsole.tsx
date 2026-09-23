import { useEffect, useRef, useState } from 'react';
import type { AudioEvent, AudioFrame } from '../audio/types';
import { selectSignalInterpretationFields, selectSignalTelemetry, signalPhraseGroups,
  signalPresentationKey, type SignalField } from './signalTelemetry';
import type { SignalConsoleObservation } from './types';
import './signalConsole.css';

type SignalConsoleProps = Readonly<{
  observe(): SignalConsoleObservation;
  interpretation: AudioFrame;
  events: readonly AudioEvent[];
}>;

function displayField(item: SignalField) {
  if (item.label === 'PITCH HZ') return <><span className="signal-value">{item.value}</span> Hz</>;
  return <><span className="signal-metric">{item.label.toLowerCase()}</span>{' '}
    <span className="signal-value">{item.value}</span></>;
}

function PhraseGroups({ fields }: { fields: readonly SignalField[] }) {
  return <span className="signal-phrase-layout">{signalPhraseGroups(fields).map((group, groupIndex) =>
    <span className="signal-phrase-group" data-signal-group={groupIndex}
      data-signal-width={group.some(item => item.width === 'wide') ? 'wide' : 'standard'}
      key={group.map(item => item.label).join('-')}>
      {group.map((item, index) => <span className="signal-token" data-signal-role={item.role} key={item.label}>
        {displayField(item)}{index < group.length - 1 ? <span className="signal-separator"> · </span> : null}
      </span>)}
    </span>)}</span>;
}

function TelemetryLine({ label, fields, layer }: {
  label: string;
  fields: readonly SignalField[];
  layer: 'analysis' | 'interpretation';
}) {
  return <div className="signal-telemetry-line" data-signal-domain={label.toLowerCase()} data-signal-layer={layer}>
    <strong>{label.charAt(0) + label.slice(1).toLowerCase()}:</strong>
    <PhraseGroups fields={fields} />
  </div>;
}

function eventText(event: AudioEvent) {
  if (event.type === 'seek') return `SEEK ${event.from.toFixed(3)} → ${event.to.toFixed(3)}`;
  return `${event.type.toUpperCase()} ${event.time.toFixed(3)}`;
}

export function SignalConsole({ observe, interpretation, events }: SignalConsoleProps) {
  const initial = useRef(selectSignalTelemetry(observe()));
  const [telemetry, setTelemetry] = useState(initial.current);
  const signatureRef = useRef(initial.current.signature);
  const transportTimeRef = useRef<HTMLOutputElement>(null);
  const updateCountRef = useRef(0);
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  useEffect(() => {
    let animationFrame = 0;
    const present = () => {
      const observation = observe();
      if (transportTimeRef.current) transportTimeRef.current.textContent = observation.transport.time.toFixed(3);
      const nextSignature = signalPresentationKey(observation);
      if (nextSignature !== signatureRef.current) {
        const next = selectSignalTelemetry(observation);
        signatureRef.current = next.signature;
        updateCountRef.current += 1;
        setTelemetry(next);
      }
      animationFrame = requestAnimationFrame(present);
    };
    animationFrame = requestAnimationFrame(present);
    return () => cancelAnimationFrame(animationFrame);
  }, [observe]);

  const snapshot = interpretation.snapshot;
  return <section className="signal-console" aria-labelledby="signal-console-heading"
    data-signal-map={telemetry.mapId} data-signal-map-revision={telemetry.mapRevision}
    data-signal-amplitude-index={telemetry.indexes.amplitude}
    data-signal-pitch-index={telemetry.indexes.pitch}
    data-signal-update-count={updateCountRef.current} data-signal-render-count={renderCountRef.current}>
    <header className="signal-console-heading">
      <div><span>ISOLATED ANALYSIS EXTRACTION · v0.1</span><h2 id="signal-console-heading">SignalConsole</h2></div>
    </header>
    <div className="signal-stream">
      <div className="signal-telemetry-line signal-telemetry-line--transport" data-signal-layer="transport">
        <strong>Transport:</strong>
        <span className="signal-phrase-layout"><span className="signal-phrase-group" data-signal-group="transport">
          <span className="signal-token" data-signal-role="anchor">time <output className="signal-value"
            ref={transportTimeRef} aria-label="Live transport time">{telemetry.transport.time.toFixed(3)}</output></span>
          <span className="signal-separator"> · </span>
          <span className="signal-token" data-signal-role="anchor">duration <span className="signal-value">
            {telemetry.transport.duration.toFixed(3)}</span></span>
          <span className="signal-separator"> · </span>
          <span className="signal-token" data-signal-role="anchor">state <span className="signal-value">
            {telemetry.ended ? 'ENDED' : telemetry.transport.playing ? 'PLAYING' : 'PAUSED'}</span></span>
        </span></span>
      </div>
      <section className="signal-stream-section" data-signal-layer="analysis">
        <header><h3>ANALYSIS</h3></header>
        {telemetry.domains.map(domain => <TelemetryLine label={domain.id} fields={domain.fields}
          layer={domain.layer} key={domain.id} />)}
      </section>
      <section className="signal-stream-section signal-stream-section--interpretation" data-signal-domain="interpretation"
        data-signal-layer="interpretation">
        <header><h3>INTERPRETATION</h3></header>
        <TelemetryLine label="Current" fields={selectSignalInterpretationFields(interpretation, telemetry.ended)}
          layer="interpretation" />
        <p className="signal-capabilities">CAPABILITIES&nbsp; {Object.entries(snapshot.capabilities)
          .map(([domain, available]) => `${domain.toUpperCase()}:${available ? '1' : '0'}`).join(' ')}</p>
      </section>
      <section className="signal-stream-section signal-stream-section--events" data-signal-domain="events" data-signal-layer="events">
        <header><h3>EVENTS</h3></header>
        <ol>{events.slice(-8).reverse().map((event, index) => <li key={`${event.type}-${index}-${event.type === 'seek' ? event.to : event.time}`}>
          {eventText(event)}
        </li>)}</ol>
      </section>
    </div>
  </section>;
}
