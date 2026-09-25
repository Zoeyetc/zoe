import { useEffect, useRef, type RefObject } from 'react';
import type { InstrumentEvent } from '../contracts.ts';
import type { SignalConsoleObservation } from '../signal-console/types.ts';
import { selectMotionStudySample } from './motionStudyEvidence.ts';
import type { MotionMode } from './MotionMode.ts';
import { MotionMode as Mode } from './MotionMode.ts';
import { motionModeRenderers, type MotionRenderer } from './motionModeRenderers.ts';
import { initialInstrumentMotion, stepInstrumentMotion } from './instrumentMotion.ts';
import { initialMaterialMotion, stepMaterialMotion } from './materialMotion.ts';
import { initialFieldMotion, stepFieldMotion } from './fieldMotion.ts';
import './motionStudy.css';

type MotionLayerProps = Readonly<{
  rootRef: RefObject<HTMLElement | null>;
  mode: MotionMode;
  observe(): SignalConsoleObservation;
  events: readonly InstrumentEvent[];
}>;

export function MotionLayer({ rootRef, mode, observe, events }: MotionLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestRef = useRef({ observe, events });
  latestRef.current = { observe, events };

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    let renderer: MotionRenderer | null;
    try {
      renderer = motionModeRenderers[mode].create(canvas, root);
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
    let geometry = renderer.measure();
    const measure = () => {
      geometry = renderer.measure();
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
    let instrumentMotion = initialInstrumentMotion;
    let materialMotion = initialMaterialMotion;
    let fieldMotion = initialFieldMotion;
    let sampleStart = 0;
    let sampleFrames = 0;
    let cpuTotal = 0;
    const render = (now: number) => {
      const started = performance.now();
      const dt = previousTime ? Math.min(.1, (now - previousTime) / 1000) : 1 / 60;
      previousTime = now;
      const { observe: read, events: recent } = latestRef.current;
      const sample = selectMotionStudySample(read(), recent);
      const target = renderer.target(sample);
      if (mode === Mode.Instrument) {
        instrumentMotion = stepInstrumentMotion(instrumentMotion, target, dt);
        activity = instrumentMotion.activity;
      } else if (mode === Mode.Material) {
        materialMotion = stepMaterialMotion(materialMotion, sample, dt);
        activity = materialMotion.activity;
      } else if (mode === Mode.Field) {
        fieldMotion = stepFieldMotion(fieldMotion, sample, dt);
        activity = fieldMotion.confidence;
      } else {
        const seconds = renderer.smoothingSeconds;
        activity += (target - activity) * (1 - Math.exp(-dt / seconds));
        if (Math.abs(activity) < .0001 && target === 0) activity = 0;
      }
      const gpuMilliseconds = renderer.draw(geometry, activity, sample.progress);
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
  }, [rootRef, mode]);

  return <canvas ref={canvasRef} className="signal-motion-study-canvas" aria-hidden="true"
    data-motion-mode={mode} />;
}

/** @deprecated Use MotionLayer. */
export const MotionStudy = MotionLayer;
