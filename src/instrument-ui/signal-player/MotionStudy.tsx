import { useEffect, useRef, type RefObject } from 'react';
import type { InstrumentEvent } from '../contracts.ts';
import type { SignalConsoleObservation } from '../signal-console/types.ts';
import { motionStudyTarget, selectMotionStudySample, type MotionStudyVariant } from './motionStudyEvidence.ts';
import { collectStudyGeometry, createMotionStudyRenderer } from './motionStudyRenderer.ts';
import './motionStudy.css';

export type MotionMode = 'off' | MotionStudyVariant;

type MotionLayerProps = Readonly<{
  rootRef: RefObject<HTMLElement | null>;
  variant: MotionStudyVariant;
  observe(): SignalConsoleObservation;
  events: readonly InstrumentEvent[];
}>;

export function MotionLayer({ rootRef, variant, observe, events }: MotionLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestRef = useRef({ observe, events });
  latestRef.current = { observe, events };

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    let renderer: ReturnType<typeof createMotionStudyRenderer>;
    try {
      renderer = createMotionStudyRenderer(canvas, root);
    } catch {
      renderer = null;
    }
    if (!renderer) {
      canvas.dataset.motionRenderer = 'unavailable';
      root.dataset.motionRenderer = 'unavailable';
      return;
    }
    canvas.dataset.motionRenderer = 'webgl';
    root.dataset.motionRenderer = 'webgl';
    let geometry = collectStudyGeometry(root, variant);
    const measure = () => {
      geometry = collectStudyGeometry(root, variant);
      const rect = root.getBoundingClientRect();
      canvas.style.left = `${rect.left}px`;
      canvas.style.top = `${rect.top}px`;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      renderer.resize(geometry);
      canvas.dataset.motionLineCount = String(geometry.lines.length);
    };
    const resize = new ResizeObserver(measure);
    [root, root.querySelector('.signal-playback'), root.querySelector('.signal-console-heading'),
      root.querySelector('.listening-field-score'), root.querySelector('.signal-performance-band')]
      .filter((element): element is Element => element !== null).forEach(element => resize.observe(element));
    const source = root.querySelector('.signal-playback');
    const sourceChanges = new MutationObserver(measure);
    if (source) sourceChanges.observe(source, { attributes: true, attributeFilter: ['data-source-mode'] });
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    measure();

    let animationFrame = 0;
    let previousTime = 0;
    let activity = 0;
    let sampleStart = 0;
    let sampleFrames = 0;
    let cpuTotal = 0;
    const render = (now: number) => {
      const started = performance.now();
      const dt = previousTime ? Math.min(.1, (now - previousTime) / 1000) : 1 / 60;
      previousTime = now;
      const { observe: read, events: recent } = latestRef.current;
      const sample = selectMotionStudySample(read(), recent);
      const target = motionStudyTarget(variant, sample);
      const seconds = variant === 'c' ? .8 : variant === 'a' ? .24 : .11;
      activity += (target - activity) * (1 - Math.exp(-dt / seconds));
      if (Math.abs(activity) < .0001 && target === 0) activity = 0;
      const gpuMilliseconds = renderer.draw(variant, geometry, activity, sample.progress);
      sampleFrames += 1;
      cpuTotal += performance.now() - started;
      if (!sampleStart) sampleStart = now;
      if (now - sampleStart >= 1000) {
        canvas.dataset.motionFps = (sampleFrames * 1000 / (now - sampleStart)).toFixed(1);
        canvas.dataset.motionCpuMs = (cpuTotal / sampleFrames).toFixed(3);
        canvas.dataset.motionGpuMs = gpuMilliseconds === null ? 'unavailable' : gpuMilliseconds.toFixed(3);
        canvas.dataset.motionActivity = activity.toFixed(3);
        sampleStart = now;
        sampleFrames = 0;
        cpuTotal = 0;
      }
      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationFrame);
      sourceChanges.disconnect();
      resize.disconnect();
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
      renderer.dispose();
      delete root.dataset.motionRenderer;
    };
  }, [rootRef, variant]);

  return <canvas ref={canvasRef} className="signal-motion-study-canvas" aria-hidden="true"
    data-motion-variant={variant} />;
}

/** @deprecated Use MotionLayer. */
export const MotionStudy = MotionLayer;
