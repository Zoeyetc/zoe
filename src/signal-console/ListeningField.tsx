import type { RefObject } from 'react';
import type { PrimaryListeningView } from './primaryListening';

type ListeningFieldProps = Readonly<{
  primary: PrimaryListeningView;
  transport: Readonly<{ time: number; duration: number; playing: boolean }>;
  ended: boolean;
  uncertainty?: boolean;
  performance?: boolean;
  transportTimeRef: RefObject<HTMLOutputElement | null>;
}>;

type CognitionCandidate = Readonly<{ identity: string; detail: string }>;

function CognitionField({ candidates, margin, accepted, active, cap, domain }: {
  candidates: readonly CognitionCandidate[];
  margin?: string;
  accepted: boolean;
  active: boolean;
  cap: 2 | 3;
  domain: 'melody' | 'harmony' | 'tonal';
}) {
  const slots = Array.from({ length: cap }, (_, index) => candidates[index] ?? null);
  return <div className={`listening-field-cognition listening-field-cognition--${domain}`}
    data-cognition-activity={accepted || !active ? 'settled' : candidates.length ? 'active' : 'empty'}
    aria-label={`${domain} candidate cognition`}>
    {slots.map((candidate, index) => <span className="listening-field-candidate"
      data-candidate-empty={candidate === null} data-candidate-rank={index + 1} key={index}>
      <strong>{candidate?.identity ?? '—'}</strong>
      <small>{candidate?.detail ?? ' '}</small>
    </span>)}
    {margin === undefined ? null : <span className="listening-field-cognition-margin">MARGIN {margin}</span>}
  </div>;
}

function ModelStatuses({ models }: { models: PrimaryListeningView['listeningModels'] }) {
  return <div>{models.map((model, index) => <span data-hearing-status={model.status} key={model.id}>
    <strong>{model.id === 'KEY' ? 'TONAL CENTER' : model.id}</strong> {model.status}
    {index < models.length - 1 ? <i aria-hidden="true"> · </i> : null}
  </span>)}</div>;
}

function ModelIndex({ models, performance }: {
  models: PrimaryListeningView['listeningModels'];
  performance: boolean;
}) {
  if (performance) return <section className="listening-field-models listening-field-models--performance"
    aria-label="Listening models">
    <h3>LISTENING MODELS</h3>
    <ModelStatuses models={models} />
  </section>;
  return <details className="listening-field-models">
    <summary>LISTENING MODELS</summary>
    <ModelStatuses models={models} />
  </details>;
}

function Voice({ name, depth, children, className = '' }: {
  name: string;
  depth: 'foreground' | 'midground' | 'background';
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`listening-field-voice ${className}`.trim()}
    data-field-voice={name.toLowerCase().replaceAll(' ', '-')}
    data-field-depth={depth}>
    <h4>{name}</h4>{children}
  </section>;
}

function Identity({ children, emphasis = 'none', anchor = false }: {
  children: React.ReactNode;
  emphasis?: PrimaryListeningView['melody']['emphasis'];
  anchor?: boolean;
}) {
  return <strong className="listening-field-identity" data-event-emphasis={emphasis}
    data-signal-role={anchor ? 'anchor' : 'signal'}>{children}</strong>;
}

export function ListeningField({ primary, transport, ended, uncertainty = false, performance = false,
  transportTimeRef }: ListeningFieldProps) {
  const pitchAligned = primary.melody.state === 'ACCEPTED'
    && primary.observedPitch.noteName !== '—'
    && primary.melody.identity === primary.observedPitch.noteName;

  const melodyCandidates = primary.uncertainty.melody.candidates.map(candidate => ({
    identity: candidate.noteName,
    detail: `${candidate.frequencyHz} Hz · ${candidate.score}`,
  }));
  const harmonyCandidates = [primary.uncertainty.harmony.top, primary.uncertainty.harmony.second]
    .filter(candidate => candidate !== null)
    .map(candidate => ({ identity: candidate.identity.toUpperCase(), detail: candidate.score }));
  const tonalCandidates = [primary.uncertainty.tonalCenter.top, primary.uncertainty.tonalCenter.second]
    .filter(candidate => candidate !== null)
    .map(candidate => ({ identity: candidate.identity.toUpperCase(), detail: candidate.score }));

  return <div className="signal-listening-field"
    data-composition={performance ? 'performance' : uncertainty ? 'listening-field-uncertainty' : 'listening-field'}>
    {performance ? null : <div className="listening-field-transport" data-signal-layer="transport">
      <span>TRANSPORT</span>
      <span className="listening-field-now-time">
        <output ref={transportTimeRef} aria-label="Live transport time">{transport.time.toFixed(3)}</output>
        <small>NOW</small>
      </span>
      <span className="listening-field-transport-context">
        / {transport.duration.toFixed(3)} <strong>{ended ? 'ENDED' : transport.playing ? 'PLAYING' : 'PAUSED'}</strong>
      </span>
    </div>}
    <ModelIndex models={primary.listeningModels} performance={performance} />
    <div className="listening-field-score">
      <span className="listening-field-now-rule" aria-hidden="true" />

      <Voice name="SIGNAL" depth="foreground" className="listening-field-signal">
        <div className="listening-field-evidence listening-field-signal-levels">
          <span>LEVEL <Identity>{primary.signal.level}</Identity></span>
          <span>TRANSIENT <Identity>{primary.signal.transient}</Identity></span>
        </div>
        <div className="listening-field-interpretation listening-field-spectrum">
          <span>LOW <Identity>{primary.signal.low}</Identity></span>
          <span>MID <Identity>{primary.signal.mid}</Identity></span>
          <span>HIGH <Identity>{primary.signal.high}</Identity></span>
        </div>
      </Voice>

      <Voice name="OBSERVED PITCH / MELODY" depth="foreground" className="listening-field-pitch">
        <div className="listening-field-relationship" data-field-alignment={pitchAligned ? 'aligned' : 'separated'}>
          <div className="listening-field-evidence">
            <span className="listening-field-subject">OBSERVED</span>
            <Identity>{primary.observedPitch.frequencyHz === '—' ? '—' : `${primary.observedPitch.frequencyHz} Hz`}</Identity>
            <Identity>{primary.observedPitch.noteName}</Identity>
            <span className="listening-field-annotation">{primary.observedPitch.rangeStatus}</span>
          </div>
          {uncertainty ? <CognitionField candidates={melodyCandidates} accepted={primary.melody.state === 'ACCEPTED'}
            active={transport.playing && !ended && primary.uncertainty.melody.changed}
            cap={3} domain="melody" /> : null}
          <div className="listening-field-interpretation" data-listener-state={primary.melody.state}>
            <span className="listening-field-subject">MELODY</span>
            <Identity emphasis={primary.melody.emphasis}>{primary.melody.identity}</Identity>
            <span className="listening-field-state">{primary.melody.state}</span>
          </div>
        </div>
      </Voice>

      <Voice name="RHYTHM / PERCUSSION" depth="midground" className="listening-field-rhythm">
        <div className="listening-field-evidence">
          <span className="listening-field-subject">RHYTHM</span>
          <Identity anchor>{primary.rhythm.bpm}</Identity>
          <strong className="listening-field-event" data-event-emphasis={primary.rhythm.listeningFieldEmphasis}>
            {primary.rhythm.beat}
          </strong>
          <span className="listening-field-annotation">GROOVE {primary.rhythm.groove} · SWING {primary.rhythm.swing}</span>
        </div>
        <div className="listening-field-interpretation">
          <span className="listening-field-subject">PERCUSSION</span>
          <Identity emphasis={primary.percussion.emphasis}>{primary.percussion.hit}</Identity>
          <span className="listening-field-state">{primary.percussion.state}</span>
          <span className="listening-field-annotation">STRENGTH {primary.percussion.strength}</span>
        </div>
      </Voice>

      <Voice name="HARMONY" depth="midground" className="listening-field-harmony">
        {uncertainty ? <CognitionField candidates={harmonyCandidates}
          margin={primary.uncertainty.harmony.margin} accepted={primary.harmony.state === 'ACCEPTED'}
          active={transport.playing && !ended && primary.uncertainty.harmony.changed}
          cap={2} domain="harmony" /> : <div className="listening-field-evidence">
          <span className="listening-field-subject">HYPOTHESIS</span>
          <Identity>{primary.harmony.hypothesis}</Identity>
          <span className="listening-field-annotation">CONF {primary.harmony.frameConfidence}</span>
        </div>}
        <div className="listening-field-interpretation" data-listener-state={primary.harmony.state}>
          <span className="listening-field-subject">CHORD</span>
          <Identity emphasis={primary.harmony.emphasis} anchor>{primary.harmony.chord}</Identity>
          <span className="listening-field-state">{primary.harmony.state}</span>
        </div>
      </Voice>

      <Voice name="TONAL CENTER" depth="background" className="listening-field-tonal">
        {uncertainty ? <CognitionField candidates={tonalCandidates}
          margin={primary.uncertainty.tonalCenter.margin} accepted={primary.tonalCenter.state === 'STABLE'}
          active={transport.playing && !ended && primary.uncertainty.tonalCenter.changed}
          cap={2} domain="tonal" /> : <div className="listening-field-evidence">
          <span className="listening-field-subject">SEARCH</span>
          <span className="listening-field-hypothesis">{primary.tonalCenter.hypothesis}</span>
        </div>}
        <div className="listening-field-interpretation" data-listener-state={primary.tonalCenter.state}>
          <span className="listening-field-subject">TONAL CENTER</span>
          <Identity emphasis={primary.tonalCenter.emphasis} anchor>{primary.tonalCenter.identity}</Identity>
          <span className="listening-field-state">{primary.tonalCenter.state}</span>
        </div>
      </Voice>

      <Voice name="STRUCTURE" depth="background" className="listening-field-structure">
        <div className="listening-field-evidence">
          <span className="listening-field-subject">SECTION</span>
          <Identity emphasis={primary.structure.emphasis} anchor>{primary.structure.identity}</Identity>
        </div>
        <div className="listening-field-interpretation">
          <Identity anchor>{primary.structure.progress}</Identity>
          <span className="listening-field-state">{primary.structure.state}</span>
          <span className="listening-field-event listening-field-boundary"
            data-event-emphasis={primary.structure.emphasis}>BOUNDARY {primary.structure.boundaryConfidence}</span>
        </div>
      </Voice>
    </div>
  </div>;
}
