import type { AttentionActorId } from '../attention';
import type { ParkViewportTransform } from '../park/config.ts';
import type { AnnotationBounds, AnnotationPoint, LiveAnnotationModel, PlacedAnnotation } from './annotationTypes.ts';

const OVERVIEW_ORIGINS: Record<AttentionActorId, AnnotationPoint> = {
  dropTower: { x: .025, y: .31 },
  carousel: { x: .235, y: .055 },
  ferrisWheel: { x: .825, y: .075 },
  rollerCoaster: { x: .075, y: .82 },
  pirateShip: { x: .59, y: .825 },
  bumperCars: { x: .825, y: .82 },
};
const ORDER: readonly AttentionActorId[] = [
  'dropTower', 'carousel', 'ferrisWheel', 'rollerCoaster', 'pirateShip', 'bumperCars',
];
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const overlaps = (a: AnnotationBounds, b: AnnotationBounds, tolerance = .004) =>
  a.x < b.x + b.width - tolerance && a.x + a.width > b.x + tolerance
  && a.y < b.y + b.height - tolerance && a.y + a.height > b.y + tolerance;
const intersectionArea = (a: AnnotationBounds, b: AnnotationBounds) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
const center = (bounds: AnnotationBounds) => ({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 });

export function visibleWorldBounds(viewport: ParkViewportTransform): AnnotationBounds {
  return {
    x: -viewport.x / viewport.scale,
    y: -viewport.y / viewport.scale,
    width: 1 / viewport.scale,
    height: 1 / viewport.scale,
  };
}

export function transformAnnotationPoint(point: AnnotationPoint, viewport: ParkViewportTransform): AnnotationPoint {
  return { x: viewport.x + point.x * viewport.scale, y: viewport.y + point.y * viewport.scale };
}

function blockSize(model: LiveAnnotationModel): Readonly<{ width: number; height: number }> {
  return model.detail === 'focus'
    ? { width: .155, height: .035 + model.fields.length * .022 }
    : { width: .13, height: .03 + model.fields.length * .019 };
}

function candidates(model: LiveAnnotationModel, viewport: ParkViewportTransform): readonly AnnotationPoint[] {
  if (model.detail === 'overview') {
    const preferred = OVERVIEW_ORIGINS[model.actorId];
    return [preferred, { x: preferred.x + .02, y: preferred.y }, { x: preferred.x, y: preferred.y - .05 },
      { x: preferred.x - .02, y: preferred.y + .045 }];
  }
  const visible = visibleWorldBounds(viewport);
  const nearRight = { x: model.anchor.x + .045, y: model.anchor.y - .07 };
  const nearLeft = { x: model.anchor.x - .2, y: model.anchor.y - .07 };
  return [nearRight, nearLeft,
    { x: visible.x + visible.width * .68, y: visible.y + visible.height * .12 },
    { x: visible.x + visible.width * .08, y: visible.y + visible.height * .14 }];
}

function attachmentFor(anchor: AnnotationPoint, block: AnnotationBounds): AnnotationPoint {
  return {
    x: clamp(anchor.x, block.x, block.x + block.width),
    y: clamp(anchor.y, block.y, block.y + block.height),
  };
}

export function resolveAnnotationLayout(
  models: readonly LiveAnnotationModel[],
  viewport: ParkViewportTransform,
  safeZones: Readonly<Record<AttentionActorId, AnnotationBounds>>,
): readonly PlacedAnnotation[] {
  const visible = visibleWorldBounds(viewport);
  const placed: PlacedAnnotation[] = [];
  const sorted = [...models].sort((a, b) => ORDER.indexOf(a.actorId) - ORDER.indexOf(b.actorId));
  for (const model of sorted) {
    const size = blockSize(model);
    const options = candidates(model, viewport).map((candidate, index) => {
      const block = {
        x: clamp(candidate.x, visible.x + .008, visible.x + visible.width - size.width - .008),
        y: clamp(candidate.y, visible.y + .008, visible.y + visible.height - size.height - .008),
        ...size,
      };
      const blockCenter = center(block);
      const overlapPenalty = placed.reduce((sum, item) => sum + intersectionArea(block, item.block) * 50_000, 0);
      const safePenalty = Object.values(safeZones).reduce((sum, zone) => sum + intersectionArea(block, zone) * 30_000, 0);
      const leaderLength = Math.hypot(blockCenter.x - model.anchor.x, blockCenter.y - model.anchor.y);
      return { block, score: overlapPenalty + safePenalty + leaderLength + index * .001 };
    }).sort((a, b) => a.score - b.score);
    const block = options[0].block;
    const attachment = attachmentFor(model.anchor, block);
    const elbow = Math.abs(attachment.x - model.anchor.x) > Math.abs(attachment.y - model.anchor.y)
      ? { x: attachment.x, y: model.anchor.y }
      : { x: model.anchor.x, y: attachment.y };
    placed.push({ ...model, block, attachment, elbow });
  }
  return placed;
}

export function annotationBlocksOverlap(items: readonly PlacedAnnotation[]) {
  return items.some((item, index) => items.slice(index + 1).some(other => overlaps(item.block, other.block)));
}
