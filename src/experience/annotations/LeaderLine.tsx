import { PARK_VIEWBOX } from '../park/config';
import type { PlacedAnnotation } from './annotationTypes';

export function LeaderLine({ annotation }: { annotation: PlacedAnnotation }) {
  const point = (value: { x: number; y: number }) =>
    `${(value.x * PARK_VIEWBOX.width).toFixed(2)},${(value.y * PARK_VIEWBOX.height).toFixed(2)}`;
  return <g className="live-annotation-leader" data-annotation-leader={annotation.actorId}>
    <polyline points={`${point(annotation.anchor)} ${point(annotation.elbow)} ${point(annotation.attachment)}`} />
    <circle cx={annotation.anchor.x * PARK_VIEWBOX.width} cy={annotation.anchor.y * PARK_VIEWBOX.height} r="2.4" />
    <line x1={annotation.attachment.x * PARK_VIEWBOX.width - 4}
      y1={annotation.attachment.y * PARK_VIEWBOX.height}
      x2={annotation.attachment.x * PARK_VIEWBOX.width + 4}
      y2={annotation.attachment.y * PARK_VIEWBOX.height} />
  </g>;
}
