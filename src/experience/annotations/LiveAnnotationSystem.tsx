import { useMemo } from 'react';
import type { AttentionState } from '../attention';
import type { ExperienceState } from '../createExperience';
import { PARK_FOCUS_BOUNDS, PARK_OVERVIEW_VIEWPORT, PARK_VIEWBOX, focusViewport } from '../park/config';
import { annotationSafeZones, resolveAnnotationAnchors } from './annotationAnchors';
import { resolveAnnotationLayout } from './annotationLayout';
import { buildAnnotationModels } from './annotationModels';
import { ActorAnnotation } from './ActorAnnotation';
import { LeaderLine } from './LeaderLine';

export function LiveAnnotationSystem({ state, attention }: { state: ExperienceState; attention: AttentionState }) {
  const models = buildAnnotationModels(state, attention);
  const visibleModels = attention.mode === 'focus'
    ? models.filter(model => model.actorId === attention.focusActorId) : models;
  const viewport = attention.focusActorId
    ? focusViewport(PARK_FOCUS_BOUNDS[attention.focusActorId]) : PARK_OVERVIEW_VIEWPORT;
  const placed = useMemo(() => resolveAnnotationLayout(
    visibleModels, viewport, annotationSafeZones(resolveAnnotationAnchors(state)),
  ), [visibleModels, viewport, state]);
  return <div className="live-annotation-system" data-annotation-count={placed.length}
    data-annotation-mode={attention.mode} aria-label="Live actor annotations">
    <svg className="live-annotation-lines" viewBox={`0 0 ${PARK_VIEWBOX.width} ${PARK_VIEWBOX.height}`}
      aria-hidden="true">
      {placed.map(annotation => <LeaderLine key={annotation.actorId} annotation={annotation} />)}
    </svg>
    {placed.map(annotation => <ActorAnnotation key={annotation.actorId} annotation={annotation} />)}
  </div>;
}
