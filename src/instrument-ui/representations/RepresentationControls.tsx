import { VISUAL_REPRESENTATIONS, VISUAL_REPRESENTATION_NAMES,
  type VisualRepresentation } from './VisualRepresentation.ts';

export type RepresentationControlsProps = Readonly<{
  representation: VisualRepresentation;
  select(representation: VisualRepresentation): void;
}>;

export function RepresentationControls({ representation, select }: RepresentationControlsProps) {
  return <span className="signal-representation-controls" role="group" aria-label="Visual representation">
    <span className="signal-representation-label" aria-hidden="true">VISUAL</span>
    {VISUAL_REPRESENTATIONS.map((item, index) => <span className="signal-representation-choice" key={item}>
      {index > 0 ? <span className="signal-representation-separator" aria-hidden="true">·</span> : null}
      <button type="button" aria-pressed={representation === item} onClick={() => select(item)}>
        {VISUAL_REPRESENTATION_NAMES[item]}
      </button>
    </span>)}
  </span>;
}
