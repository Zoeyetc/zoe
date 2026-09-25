import { MotionMode } from './MotionMode.ts';
import { motionStudyTarget, type MotionStudySample, type MotionStudyVariant } from './motionStudyEvidence.ts';
import { collectStudyGeometry, createMotionStudyRenderer, type StudyGeometry } from './motionStudyRenderer.ts';

export type MotionRenderer = {
  measure(): StudyGeometry;
  resize(geometry: StudyGeometry): void;
  target(sample: MotionStudySample): number;
  smoothingSeconds: number;
  draw(geometry: StudyGeometry, activity: number, progress: number): number | null;
  dispose(): void;
};

type MotionRendererDefinition = Readonly<{
  replacesDividers: boolean;
  create(canvas: HTMLCanvasElement, root: HTMLElement): MotionRenderer | null;
}>;

/** Temporary adapters preserve the study rendering, evidence and timing exactly. */
function studyRenderer(variant: MotionStudyVariant): MotionRendererDefinition {
  return {
    replacesDividers: variant === 'a',
    create(canvas, root) {
      const renderer = createMotionStudyRenderer(canvas, root);
      if (!renderer) return null;
      return {
        measure: () => collectStudyGeometry(root, variant),
        resize: renderer.resize,
        target: sample => motionStudyTarget(variant, sample),
        smoothingSeconds: variant === 'c' ? .8 : variant === 'a' ? .24 : .11,
        draw: (geometry, activity, progress) => renderer.draw(variant, geometry, activity, progress),
        dispose: renderer.dispose,
      };
    },
  };
}

/** Each product mode owns a renderer factory, independently replaceable later. */
export const motionModeRenderers: Readonly<Record<MotionMode, MotionRendererDefinition>> = {
  [MotionMode.Instrument]: studyRenderer('a'),
  [MotionMode.Material]: studyRenderer('a'),
  [MotionMode.Field]: studyRenderer('c'),
  [MotionMode.Observatory]: studyRenderer('a'), // Placeholder until Observatory has its own renderer.
};
