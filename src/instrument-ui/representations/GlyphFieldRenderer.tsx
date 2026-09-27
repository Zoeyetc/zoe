import { useCallback, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
  type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { findListeningRecordSlice, projectListeningRecord,
  type ListeningRecordSlice, type PersistentListeningRecord } from './ListeningRecord.ts';
import { GLYPH_PIXELS_PER_SECOND, GLYPH_RENDERED_FRAME_LIMIT, glyphColumnFromSlice,
  selectedPathLinks } from './glyphFieldModel.ts';
import './glyphField.css';

type GlyphFieldRendererProps = Readonly<{ record: PersistentListeningRecord }>;
type FieldStyle = CSSProperties & Readonly<Record<'--record-width' | '--record-now', string>>;
type GlyphStyle = CSSProperties & Readonly<Record<'--glyph-x' | '--glyph-y' | '--glyph-strength', string>>;
type Viewport = Readonly<{ scrollLeft: number; width: number }>;

const formatTime = (value: number) => {
  const minutes = Math.floor(value / 60);
  return `${String(minutes).padStart(2, '0')}:${(value % 60).toFixed(3).padStart(6, '0')}`;
};

const glyphStyle = (time: number, position: number, strength: number, pixelsPerSecond: number): GlyphStyle => ({
  '--glyph-x': `${time * pixelsPerSecond}px`,
  '--glyph-y': `${(position * 100).toFixed(3)}%`,
  '--glyph-strength': strength.toFixed(3),
});

function Inspector({ slice }: Readonly<{ slice: ListeningRecordSlice | null }>) {
  if (!slice) return <div className="glyph-record-inspector" data-empty="true">
    <strong>SLICE</strong><span>Select recorded evidence to inspect.</span>
  </div>;
  const selectedMelody = slice.melody?.selectedCandidateIndex === null ? null
    : slice.melody?.candidates[slice.melody.selectedCandidateIndex ?? -1] ?? null;
  const selectedBass = slice.bass?.selectedCandidateIndex === null ? null
    : slice.bass?.candidates[slice.bass.selectedCandidateIndex ?? -1] ?? null;
  return <div className="glyph-record-inspector" aria-label={`Recorded evidence at ${formatTime(slice.time)}`}>
    <strong>SLICE {formatTime(slice.time)}</strong>
    <div><b>MELODY</b><span>{slice.melody?.candidates.map(candidate =>
      `${candidate.label} ${candidate.score.toFixed(3)}`).join(' · ') || 'NO CANDIDATES'}</span>
      <span>PATH {selectedMelody?.label ?? 'ABSTAINED'} · {slice.melody?.reason ?? 'UNAVAILABLE'}</span></div>
    <div><b>BASS</b><span>{slice.bass?.candidates.map(candidate =>
      `${candidate.label} ${candidate.score.toFixed(3)}`).join(' · ') || 'NO CANDIDATES'}</span>
      <span>PATH {selectedBass?.label ?? 'ABSTAINED'} · {slice.bass?.reason ?? 'UNAVAILABLE'}</span></div>
  </div>;
}

export function GlyphFieldRenderer({ record }: GlyphFieldRendererProps) {
  const snapshot = useSyncExternalStore(record.subscribe, record.getSnapshot, record.getSnapshot);
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{ x: number; scrollLeft: number } | null>(null);
  const [following, setFollowing] = useState(true);
  const [viewport, setViewport] = useState<Viewport>({ scrollLeft: 0, width: 960 });
  const [inspectedTime, setInspectedTime] = useState<number | null>(null);
  const updateViewport = useCallback(() => {
    const element = viewportRef.current;
    if (!element) return;
    setViewport({ scrollLeft: element.scrollLeft, width: element.clientWidth });
  }, []);

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const resize = new ResizeObserver(updateViewport);
    resize.observe(element);
    updateViewport();
    return () => resize.disconnect();
  }, [updateViewport]);

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element || !following) return;
    element.scrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
    updateViewport();
  }, [following, snapshot.revision, updateViewport]);

  const pixelsPerSecond = Math.max(GLYPH_PIXELS_PER_SECOND,
    (viewport.width - 24) / Math.max(1, snapshot.latestTime));
  const viewportStart = Math.max(0, viewport.scrollLeft / pixelsPerSecond);
  const viewportEnd = (viewport.scrollLeft + viewport.width) / pixelsPerSecond;
  const projected = useMemo(() => projectListeningRecord(snapshot.entries,
    Math.max(0, viewportStart - 2), viewportEnd + 2, GLYPH_RENDERED_FRAME_LIMIT),
  [snapshot.entries, snapshot.revision, viewportStart, viewportEnd]);
  const columns = useMemo(() => projected.map(glyphColumnFromSlice), [projected]);
  const width = Math.max(viewport.width, snapshot.latestTime * pixelsPerSecond + 24);
  const style: FieldStyle = { '--record-width': `${width}px`, '--record-now': `${snapshot.latestTime * pixelsPerSecond}px` };
  const melodyLinks = selectedPathLinks(columns, 'melody', pixelsPerSecond);
  const bassLinks = selectedPathLinks(columns, 'bass', pixelsPerSecond);
  const inspected = inspectedTime === null ? snapshot.entries.at(-1) ?? null
    : findListeningRecordSlice(snapshot.entries, inspectedTime);
  const inspectAtPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = pointerRef.current;
    const element = viewportRef.current;
    pointerRef.current = null;
    if (!start || !element || Math.abs(event.clientX - start.x) > 6
      || Math.abs(element.scrollLeft - start.scrollLeft) > 6) return;
    const bounds = element.getBoundingClientRect();
    setInspectedTime((event.clientX - bounds.left + element.scrollLeft) / pixelsPerSecond);
  };
  const returnToNow = () => {
    setInspectedTime(null);
    setFollowing(true);
    const element = viewportRef.current;
    if (element) element.scrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
  };

  return <section className="signal-console glyph-field-console" aria-label="Persistent listening record"
    data-representation="glyph-field" data-record-entry-count={snapshot.entries.length}
    data-rendered-frame-count={columns.length} data-following-now={following}>
    <header className="signal-console-heading signal-console-heading--performance glyph-field-heading">
      <span className="signal-models-label">PERSISTENT LISTENING RECORD</span>
      <span>{snapshot.session.label} · {snapshot.entries.length} SLICES · {(snapshot.approximateBytes / 1024).toFixed(1)} KB</span>
    </header>
    <div className="glyph-record-navigation" data-following={following}>
      <span>{following ? 'START' : `HISTORY · ${formatTime(viewportStart)}`}</span>
      <span aria-hidden="true">────────────────</span>
      {!following ? <button type="button" aria-label="Return to now" onClick={returnToNow}>[NOW →]</button> : null}
    </div>
    <div className="glyph-record-viewport" ref={viewportRef} tabIndex={0} aria-label="Listening record; scroll horizontally to inspect history"
      onScroll={() => {
        const element = viewportRef.current;
        if (!element) return;
        setFollowing(element.scrollWidth - element.clientWidth - element.scrollLeft < 12);
        updateViewport();
      }}
      onPointerDown={event => { pointerRef.current = { x: event.clientX, scrollLeft: event.currentTarget.scrollLeft }; }}
      onPointerUp={inspectAtPointer}>
      <div className="glyph-record-surface" style={style}>
        <section className="glyph-record-field glyph-record-field--melody" aria-label="Recorded Melody candidate field">
          <h2>MELODY / CANDIDATE FIELD <span>C2—C6</span></h2>
          <svg className="glyph-record-path" width={width} height="100%" viewBox={`0 0 ${width} 100`}
            preserveAspectRatio="none" aria-hidden="true">
            {melodyLinks.map(link => <line x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2} key={link.id} />)}
          </svg>
          {columns.flatMap(column => column.melody.map(glyph => <span className="glyph-record-glyph"
            data-glyph-kind={glyph.kind} style={glyphStyle(column.time, glyph.position, glyph.strength, pixelsPerSecond)}
            key={`${column.id}-${glyph.id}`}>{glyph.label}</span>))}
        </section>
        <section className="glyph-record-field glyph-record-field--bass" aria-label="Recorded Bass evidence field">
          <h2>BASS / EVIDENCE FIELD <span>C1—C4</span></h2>
          <svg className="glyph-record-path" width={width} height="100%" viewBox={`0 0 ${width} 100`}
            preserveAspectRatio="none" aria-hidden="true">
            {bassLinks.map(link => <line x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2} key={link.id} />)}
          </svg>
          {columns.flatMap(column => column.bass.map(glyph => <span className="glyph-record-glyph"
            data-glyph-kind={glyph.kind} style={glyphStyle(column.time, glyph.position, glyph.strength, pixelsPerSecond)}
            key={`${column.id}-${glyph.id}`}>{glyph.label}</span>))}
        </section>
        <i className="glyph-record-now" aria-hidden="true" />
      </div>
    </div>
    <Inspector slice={inspected} />
  </section>;
}
