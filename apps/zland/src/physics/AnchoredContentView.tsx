import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { AnchoredContentParticipantState, WorldBounds } from './AnchoredContentParticipant';
import { createDomSpatialAdapter, DOM_PHYSICS_LAYOUT_INVALIDATION_EVENT } from './adapters/dom';

type AnchoredContentViewProps = Readonly<{
  state: AnchoredContentParticipantState;
  worldElementRef: RefObject<HTMLDivElement | null>;
  onLayout(bounds: WorldBounds): void;
  layoutStyle?: CSSProperties;
}>;

/** Outer element owns authored layout; only the nested response layer is physically transformed. */
export function AnchoredContentView({ state, worldElementRef, onLayout, layoutStyle }: AnchoredContentViewProps) {
  const layoutRef = useRef<HTMLDivElement>(null);
  const [worldPixelSize, setWorldPixelSize] = useState({ width: 1, height: 1 });

  useLayoutEffect(() => {
    const content = layoutRef.current;
    const world = worldElementRef.current;
    if (!content || !world) return;
    const adapter = createDomSpatialAdapter({
      measureContent: () => content.getBoundingClientRect(),
      measureWorld: () => world.getBoundingClientRect(),
      onMeasure: measurement => {
        onLayout(measurement.bounds);
        setWorldPixelSize(measurement.worldPixelSize);
      },
    });
    const invalidate = () => adapter.invalidate();
    adapter.measure();
    const observer = new ResizeObserver(invalidate);
    observer.observe(content);
    observer.observe(world);
    window.addEventListener('resize', invalidate);
    window.addEventListener(DOM_PHYSICS_LAYOUT_INVALIDATION_EVENT, invalidate);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', invalidate);
      window.removeEventListener(DOM_PHYSICS_LAYOUT_INVALIDATION_EVENT, invalidate);
    };
  }, [onLayout, worldElementRef]);

  const x = state.offset.x * worldPixelSize.width;
  const y = state.offset.y * worldPixelSize.height;
  const degrees = state.rotation * 180 / Math.PI;
  return <div ref={layoutRef} className="content-participant-layout" style={layoutStyle}>
    <article className="content-participant-response"
      style={{ transform: `translate(${x}px, ${y}px) rotate(${degrees}deg)` }}
      aria-label="Anchored PhysicsWorld content participant">
      <p className="eyebrow">Anchored content participant</p>
      <strong>Z.land</strong>
      <span>Music operates the park.</span>
    </article>
  </div>;
}
