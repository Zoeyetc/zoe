import { useEffect, useRef, useState } from 'react';
import type { AudioEvent, AudioFrame } from '../audio/types';
import { selectSignalInterpretationFields, selectSignalTelemetry, signalPhraseGroups,
  signalPresentationKey, type MelodyInspectTelemetry, type SignalField,
  type HearingDomain } from './signalTelemetry';
import type { SignalConsoleObservation } from './types';
import './signalConsole.css';

type SignalConsoleProps = Readonly<{
  observe(): SignalConsoleObservation;
  interpretation: AudioFrame;
  events: readonly AudioEvent[];
}>;

type MelodyEvidenceVisualState = 'accepted' | 'active' | 'candidate' | 'rejected' | 'empty';

function displayField(item: SignalField) {
  if (item.label === 'PITCH HZ' || item.label === 'OBSERVED') {
    return <><span className="signal-metric">{item.label.toLowerCase()}</span>{' '}
      <span className="signal-value">{item.value}</span>{item.value === '—' ? '' : ' Hz'}</>;
  }
  return <><span className="signal-metric">{item.label.toLowerCase()}</span>{' '}
    <span className="signal-value">{item.value}</span></>;
}

function PhraseGroups({ fields }: { fields: readonly SignalField[] }) {
  return <span className="signal-phrase-layout">{signalPhraseGroups(fields).map((group, groupIndex) =>
    <span className="signal-phrase-group" data-signal-group={groupIndex}
      data-signal-width={group.some(item => item.width === 'wide') ? 'wide' : 'standard'}
      key={group.map(item => item.label).join('-')}>
      {group.map((item, index) =>
        <span className="signal-token" data-signal-role={item.role}
          data-signal-metric={item.label.toLowerCase().replaceAll(' ', '-')}
          key={item.label}>
          {displayField(item)}{index < group.length - 1 ? <span className="signal-separator"> · </span> : null}
        </span>)}
    </span>)}</span>;
}

function TelemetryLine({ label, fields, layer, evidenceState }: {
  label: string;
  fields: readonly SignalField[];
  layer: 'analysis' | 'interpretation';
  evidenceState?: MelodyEvidenceVisualState;
}) {
  return <div className="signal-telemetry-line" data-signal-domain={label.toLowerCase()} data-signal-layer={layer}
    data-melody-evidence-state={evidenceState}>
    <strong>{label.charAt(0) + label.slice(1).toLowerCase()}:</strong>
    <PhraseGroups fields={fields} />
  </div>;
}

function HearingSummary({ domains }: { domains: readonly HearingDomain[] }) {
  return <section className="signal-hearing" data-signal-layer="hearing">
    <header><h3>HEARING</h3></header>
    <div className="signal-hearing-lines">{domains.map(domain =>
      <div className="signal-hearing-line" data-hearing-domain={domain.id.toLowerCase()} key={domain.id}>
        <strong>{domain.id.charAt(0) + domain.id.slice(1).toLowerCase()}</strong>
        <span className="signal-hearing-status" data-hearing-status={domain.status}>{domain.status}</span>
      </div>)}</div>
  </section>;
}

function MelodyInspect({ inspect, acceptedNote, acceptedConfidence }: {
  inspect: MelodyInspectTelemetry;
  acceptedNote: string;
  acceptedConfidence: string;
}) {
  const accepted: readonly SignalField[] = [
    { label: 'NOTE', value: acceptedNote, role: 'anchor' },
    { label: 'CONFIDENCE', value: acceptedConfidence, role: 'signal' },
  ];
  const rejectedTotal = Number(inspect.rejectedSummary.find(item => item.label === 'TOTAL')?.value ?? 0);
  const pathActive = inspect.path.some(item => item.value !== '—');
  const decisionResult = inspect.decision.find(item => item.label === 'RESULT')?.value;
  const trackDecision = inspect.track.find(item => item.label === 'DECISION')?.value;
  return <details className="signal-inspect" data-signal-domain="melody-inspect">
    <summary>MELODY / INSPECT</summary>
    <div className="signal-inspect-stream">
      <TelemetryLine label="Frame" fields={inspect.frame} layer="analysis" />
      <TelemetryLine label="Generation" fields={inspect.generation} layer="analysis" />
      <TelemetryLine label="Rejected pre-filter" fields={inspect.rejectedSummary} layer="analysis"
        evidenceState={rejectedTotal > 0 ? 'rejected' : 'empty'} />
      {inspect.rejectedCandidates.map(candidate => <TelemetryLine label={candidate.id} fields={candidate.fields}
        layer="analysis" evidenceState={candidate.fields.some(item => item.value !== '—') ? 'rejected' : 'empty'}
        key={candidate.id} />)}
      {inspect.candidates.map(candidate => <TelemetryLine label={candidate.id} fields={candidate.fields}
        layer="analysis" evidenceState={candidate.fields.some(item => item.value !== '—') ? 'candidate' : 'empty'}
        key={candidate.id} />)}
      <TelemetryLine label="Path" fields={inspect.path} layer="analysis"
        evidenceState={pathActive ? 'active' : 'empty'} />
      <TelemetryLine label="Decision" fields={inspect.decision} layer="analysis"
        evidenceState={decisionResult === 'ACCEPTED' ? 'active'
          : decisionResult === 'REJECTED' ? 'rejected' : 'empty'} />
      <TelemetryLine label="Track" fields={inspect.track} layer="analysis"
        evidenceState={trackDecision === 'ACCEPTED' ? 'active'
          : trackDecision === 'REJECTED' ? 'rejected' : 'empty'} />
      <TelemetryLine label="Accepted" fields={accepted} layer="interpretation"
        evidenceState={acceptedNote !== '—' ? 'accepted' : 'empty'} />
    </div>
  </details>;
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
      <h2 id="signal-console-heading">SignalConsole</h2>
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
      <HearingSummary domains={telemetry.hearing} />
      <section className="signal-stream-section" data-signal-layer="analysis">
        <header><h3>ANALYSIS</h3></header>
        {telemetry.domains.map(domain => <TelemetryLine label={domain.id} fields={domain.fields}
          layer={domain.layer} key={domain.id} />)}
      </section>
      <MelodyInspect inspect={telemetry.melodyInspect}
        acceptedNote={telemetry.ended ? '—' : snapshot.melody.noteName ?? '—'}
        acceptedConfidence={telemetry.ended ? '—' : snapshot.melody.confidence.toFixed(3)} />
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
