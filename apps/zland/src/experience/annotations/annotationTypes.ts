import type { AttentionActorId, AttentionRole } from '../attention';

export type AnnotationPoint = Readonly<{ x: number; y: number }>;
export type AnnotationBounds = Readonly<{ x: number; y: number; width: number; height: number }>;
export type AnnotationEmphasis = 'normal' | 'evidence' | 'muted' | 'physical';
export type AnnotationState = 'active' | 'listening' | 'unavailable';
export type AnnotationDetail = 'overview' | 'focus';

export type AnnotationField = Readonly<{
  label: string;
  value: string;
  emphasis?: AnnotationEmphasis;
}>;

export type LiveAnnotationModel = Readonly<{
  actorId: AttentionActorId;
  actorLabel: string;
  anchor: AnnotationPoint;
  role: AttentionRole;
  detail: AnnotationDetail;
  state: AnnotationState;
  fields: readonly AnnotationField[];
}>;

export type PlacedAnnotation = LiveAnnotationModel & Readonly<{
  block: AnnotationBounds;
  attachment: AnnotationPoint;
  elbow: AnnotationPoint;
}>;
