import type { WorldBounds } from '../AnchoredContentParticipant.ts';

export type RectLike = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

export type DomSpatialMeasurement = Readonly<{
  bounds: WorldBounds;
  worldPixelSize: Readonly<{ width: number; height: number }>;
}>;

export const DOM_PHYSICS_LAYOUT_INVALIDATION_EVENT = 'zland:physics-layout-invalidate';

export function domRectToWorldMeasurement(content: RectLike, world: RectLike): DomSpatialMeasurement {
  const width = Math.max(1, world.width);
  const height = Math.max(1, world.height);
  return {
    bounds: {
      x: (content.left - world.left) / width,
      y: (content.top - world.top) / height,
      width: content.width / width,
      height: content.height / height,
    },
    worldPixelSize: { width, height },
  };
}

type DomSpatialAdapterOptions = Readonly<{
  measureContent(): RectLike;
  measureWorld(): RectLike;
  onMeasure(measurement: DomSpatialMeasurement): void;
}>;

/** Event-driven DOM measurement adapter. read() never performs a layout read. */
export function createDomSpatialAdapter(options: DomSpatialAdapterOptions) {
  let measurement: DomSpatialMeasurement | null = null;
  let measurementCount = 0;
  const measure = () => {
    measurement = domRectToWorldMeasurement(options.measureContent(), options.measureWorld());
    measurementCount += 1;
    options.onMeasure(measurement);
    return measurement;
  };
  return {
    measure,
    invalidate: measure,
    read: () => ({ measurement, measurementCount }),
  };
}
