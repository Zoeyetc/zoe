import { useEffect, useRef, useState } from 'react';
import type { AudioEvent, AudioFrame } from '../audio/types';
import { selectPrimaryListeningView, type EventEmphasis } from './primaryListening';
import { selectSignalTelemetry, signalPhraseGroups, signalPresentationKey,
  type MelodyInspectTelemetry, type SignalField } from './signalTelemetry';
import type { SignalConsoleObservation } from './types';
import { ListeningField } from './ListeningField';
import './signalConsole.css';

export type SignalComposition = 'temporal-score' | 'listening-field' | 'listening-field-uncertainty' | 'performance';

type SignalConsoleProps = Readonly<{
  observe(): SignalConsoleObservation;
  interpretation: AudioFrame;
  events: readonly AudioEvent[];
  composition?: SignalComposition;
}>;

type MelodyEvidenceVisualState = 'accepted' | 'active' | 'candidate' | 'rejected' | 'empty';
type VisualLevel = 0 | 1 | 2 | 3 | 4;

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

function PrimaryLine({ label, value, detail, level, emphasis = 'none', role = 'signal' }: {
  label: string; value: string; detail?: string; level: VisualLevel; emphasis?: EventEmphasis;
  role?: 'signal' | 'anchor';
}) {
  return <div className="signal-primary-line" data-visual-level={level} data-event-emphasis={emphasis}>
    <span className="signal-primary-label">{label}</span>
    <span className="signal-primary-value" data-signal-role={role}>{value}</span>
    <span className="signal-primary-detail">{detail ?? '\u00a0'}</span>
  </div>;
}

function PrimaryDomain({ name, children, spacious = false }: {
  name: string; children: React.ReactNode; spacious?: boolean;
}) {
  return <section className="signal-primary-domain" data-primary-domain={name.toLowerCase().replaceAll(' ', '-')}
    data-domain-density={spacious ? 'spacious' : 'compact'}>
    <h4>{name}</h4>
    <div className="signal-primary-domain-body">{children}</div>
  </section>;
}

function TemporalBand({ scale, detail, children }: { scale: string; detail?: string; children: React.ReactNode }) {
  return <section className="signal-temporal-band" data-time-scale={scale.toLowerCase()}>
    <header className="signal-time-scale"><strong>{scale}</strong><span>{detail ?? '\u00a0'}</span></header>
    <div className="signal-temporal-content">{children}</div>
  </section>;
}

function MelodyInspect({ inspect, acceptedNote, acceptedConfidence, defaultOpen = false }: {
  inspect: MelodyInspectTelemetry;
  acceptedNote: string;
  acceptedConfidence: string;
  defaultOpen?: boolean;
}) {
  const accepted: readonly SignalField[] = [
    { label: 'NOTE', value: acceptedNote, role: 'anchor' },
    { label: 'CONFIDENCE', value: acceptedConfidence, role: 'signal' },
  ];
  const rejectedTotal = Number(inspect.rejectedSummary.find(item => item.label === 'TOTAL')?.value ?? 0);
  const pathActive = inspect.path.some(item => item.value !== '—');
  const decisionResult = inspect.decision.find(item => item.label === 'RESULT')?.value;
  const trackDecision = inspect.track.find(item => item.label === 'DECISION')?.value;
  return <details className="signal-inspect" data-signal-domain="melody-inspect" open={defaultOpen || undefined}>
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
      <TelemetryLine label="Path" fields={inspect.path} layer="analysis" evidenceState={pathActive ? 'active' : 'empty'} />
      <TelemetryLine label="Decision" fields={inspect.decision} layer="analysis"
        evidenceState={decisionResult === 'ACCEPTED' ? 'active' : decisionResult === 'REJECTED' ? 'rejected' : 'empty'} />
      <TelemetryLine label="Track" fields={inspect.track} layer="analysis"
        evidenceState={trackDecision === 'ACCEPTED' ? 'active' : trackDecision === 'REJECTED' ? 'rejected' : 'empty'} />
      <TelemetryLine label="Accepted" fields={accepted} layer="interpretation"
        evidenceState={acceptedNote !== '—' ? 'accepted' : 'empty'} />
    </div>
  </details>;
}

function eventText(event: AudioEvent) {
  if (event.type === 'seek') return `SEEK ${event.from.toFixed(3)} → ${event.to.toFixed(3)}`;
  return `${event.type.toUpperCase()} ${event.time.toFixed(3)}`;
}

export function SignalConsole({ observe, interpretation, events, composition = 'temporal-score' }: SignalConsoleProps) {
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

  const primary = selectPrimaryListeningView(telemetry, interpretation, events);
  const snapshot = interpretation.snapshot;
  return <section className="signal-console" aria-labelledby="signal-console-heading" data-composition={composition}
    data-transport-state={telemetry.ended ? 'ended' : telemetry.transport.playing ? 'playing' : 'paused'}
    data-signal-map={telemetry.mapId} data-signal-map-revision={telemetry.mapRevision}
    data-signal-amplitude-index={telemetry.indexes.amplitude} data-signal-pitch-index={telemetry.indexes.pitch}
    data-signal-update-count={updateCountRef.current} data-signal-render-count={renderCountRef.current}>
    <header className="signal-console-heading"><h2 id="signal-console-heading">SignalConsole</h2></header>
    <div className="signal-stream">
      {composition === 'temporal-score' ? <><div className="signal-transport" data-signal-layer="transport">
        <span>TRANSPORT</span>
        <span className="signal-transport-values">
          <output ref={transportTimeRef} aria-label="Live transport time">{telemetry.transport.time.toFixed(3)}</output>
          <span>/ {telemetry.transport.duration.toFixed(3)}</span>
          <strong>{telemetry.ended ? 'ENDED' : telemetry.transport.playing ? 'PLAYING' : 'PAUSED'}</strong>
        </span>
      </div>

      <section className="signal-listening-models" data-signal-layer="hearing">
        <h3>LISTENING MODELS</h3>
        <div>{primary.listeningModels.map(domain => <span data-hearing-domain={domain.id.toLowerCase()}
          data-hearing-status={domain.status} key={domain.id}>
          <strong>{domain.id === 'KEY' ? 'TONAL CENTER' : domain.id}</strong> {domain.status}
        </span>)}</div>
      </section>

      <div className="signal-temporal-score">
        <TemporalBand scale="FAST" detail="FRAME">
          <PrimaryDomain name="SIGNAL">
            <PrimaryLine label="LEVEL" value={primary.signal.level} level={2} />
            <PrimaryLine label="TRANSIENT" value={primary.signal.transient} level={2} />
            <PrimaryLine label="SPECTRUM" value={`${primary.signal.low} · ${primary.signal.mid} · ${primary.signal.high}`}
              detail="LOW · MID · HIGH" level={1} />
            <PrimaryLine label="BRIGHTNESS" value={primary.signal.brightness}
              detail={`SPECTRAL CHANGE ${primary.signal.spectralChange}`} level={1} />
          </PrimaryDomain>
          <PrimaryDomain name="OBSERVED PITCH">
            <PrimaryLine label="OBSERVED" value={primary.observedPitch.frequencyHz === '—'
              ? '—' : `${primary.observedPitch.frequencyHz} Hz`} detail={primary.observedPitch.noteName} level={2} />
            <PrimaryLine label="RANGE" value={primary.observedPitch.rangeStatus}
              detail={`SCORE ${primary.observedPitch.score}`} level={1} role="anchor" />
          </PrimaryDomain>
        </TemporalBand>

        <TemporalBand scale="SHORT">
          <div className="signal-parallel-listeners">
            <PrimaryDomain name="MELODY">
              <PrimaryLine label="MELODY" value={primary.melody.identity} detail={primary.melody.state}
                level={primary.melody.state === 'ACCEPTED' ? 3 : primary.melody.state === 'UNAVAILABLE' ? 0 : 2}
                emphasis={primary.melody.emphasis} />
            </PrimaryDomain>
            <PrimaryDomain name="HARMONY">
              <PrimaryLine label="CHROMA" value={primary.harmony.chroma} level={1} />
              <PrimaryLine label="HYPOTHESIS" value={primary.harmony.hypothesis}
                detail={`CONF ${primary.harmony.frameConfidence}`} level={2} />
              <PrimaryLine label="CHORD" value={primary.harmony.chord} detail={primary.harmony.state}
                level={primary.harmony.state === 'ACCEPTED' ? 3 : primary.harmony.state === 'UNAVAILABLE' ? 0 : 2}
                emphasis={primary.harmony.emphasis} />
            </PrimaryDomain>
          </div>
        </TemporalBand>

        <TemporalBand scale="BEAT">
          <div className="signal-parallel-listeners">
            <PrimaryDomain name="RHYTHM">
              <PrimaryLine label="TEMPO" value={primary.rhythm.bpm} level={3} role="anchor" />
              <PrimaryLine label="PHASE" value={primary.rhythm.phase}
                detail={`GROOVE ${primary.rhythm.groove} · SWING ${primary.rhythm.swing}`} level={2} />
              <PrimaryLine label="EVENT" value={primary.rhythm.beat} level={2}
                emphasis={primary.rhythm.emphasis} role="anchor" />
            </PrimaryDomain>
            <PrimaryDomain name="PERCUSSION">
              <PrimaryLine label="HIT" value={primary.percussion.hit}
                detail={primary.percussion.state} level={primary.percussion.hit === '—' ? 0 : 3}
                emphasis={primary.percussion.emphasis} />
              <PrimaryLine label="STRENGTH" value={primary.percussion.strength}
                detail={`ACTIVITY ${primary.percussion.activity}`} level={1} />
            </PrimaryDomain>
          </div>
        </TemporalBand>

        <TemporalBand scale="SLOW" detail="MULTI-SECOND">
          <PrimaryDomain name="TONAL CENTER" spacious>
            <PrimaryLine label="TONAL CENTER" value={primary.tonalCenter.identity}
              detail={primary.tonalCenter.state} level={primary.tonalCenter.identity === '—' ? 0 : 3}
              emphasis={primary.tonalCenter.emphasis} role="anchor" />
            <PrimaryLine label="HYPOTHESIS" value={primary.tonalCenter.hypothesis}
              detail={`CONF ${primary.tonalCenter.hypothesisConfidence} · ACCEPTED ${primary.tonalCenter.confidence}`} level={1} />
          </PrimaryDomain>
        </TemporalBand>

        <TemporalBand scale="SECTION">
          <PrimaryDomain name="STRUCTURE" spacious>
            <PrimaryLine label="SECTION" value={primary.structure.identity}
              detail={`${primary.structure.progress} · ${primary.structure.state}`}
              level={primary.structure.identity === '—' ? 0 : 3} emphasis={primary.structure.emphasis} role="anchor" />
            <PrimaryLine label="NOVELTY" value={primary.structure.novelty} level={1} />
            <PrimaryLine label="BOUNDARY" value={primary.structure.boundaryConfidence}
              level={primary.structure.emphasis === 'none' ? 0 : 4} emphasis={primary.structure.emphasis} />
          </PrimaryDomain>
        </TemporalBand>
      </div></> : <ListeningField primary={primary} transport={telemetry.transport} ended={telemetry.ended}
        uncertainty={composition === 'listening-field-uncertainty' || composition === 'performance'}
        performance={composition === 'performance'}
        transportTimeRef={transportTimeRef} />}

      <div className="signal-forensic-layers">
        <MelodyInspect inspect={telemetry.melodyInspect}
          acceptedNote={telemetry.ended ? '—' : snapshot.melody.noteName ?? '—'}
          acceptedConfidence={telemetry.ended ? '—' : snapshot.melody.confidence.toFixed(3)}
          defaultOpen={composition === 'performance'} />
        <details className="signal-inspect" data-signal-domain="recent-events"
          open={composition === 'performance' || undefined}>
          <summary>RECENT EVENTS</summary>
          <ol className="signal-event-log">{events.slice(-8).reverse().map((event, index) =>
            <li key={`${event.type}-${index}-${event.type === 'seek' ? event.to : event.time}`}>{eventText(event)}</li>)}</ol>
        </details>
        <details className="signal-inspect" data-signal-domain="source-system">
          <summary>SOURCE / SYSTEM</summary>
          <div className="signal-inspect-stream">
            <TelemetryLine label="Source" fields={primary.sourceSystem} layer="analysis" />
            <p className="signal-capabilities">CAPABILITIES&nbsp; {Object.entries(snapshot.capabilities)
              .map(([domain, available]) => `${domain.toUpperCase()}:${available ? '1' : '0'}`).join(' ')}</p>
          </div>
        </details>
      </div>
    </div>
  </section>;
}
