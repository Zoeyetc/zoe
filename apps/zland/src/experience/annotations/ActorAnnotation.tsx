import type { CSSProperties } from 'react';
import type { PlacedAnnotation } from './annotationTypes';

export function ActorAnnotation({ annotation }: { annotation: PlacedAnnotation }) {
  const style = {
    left: `${annotation.block.x * 100}%`, top: `${annotation.block.y * 100}%`,
    width: `${annotation.block.width * 100}%`, minHeight: `${annotation.block.height * 100}%`,
  } as CSSProperties;
  return <aside className="live-annotation" style={style}
    aria-label={`${annotation.actorLabel} live annotation`}
    data-live-annotation={annotation.actorId}
    data-annotation-detail={annotation.detail}
    data-annotation-state={annotation.state}
    data-attention-role={annotation.role}
    data-anchor-x={annotation.anchor.x.toFixed(5)} data-anchor-y={annotation.anchor.y.toFixed(5)}>
    <div className="live-annotation-heading">
      <span>{annotation.actorLabel}</span><i>{annotation.state}</i>
    </div>
    <dl>{annotation.fields.map(item => <div key={item.label} data-emphasis={item.emphasis ?? 'normal'}>
      <dt>{item.label}</dt><dd>{item.value}</dd>
    </div>)}</dl>
  </aside>;
}
