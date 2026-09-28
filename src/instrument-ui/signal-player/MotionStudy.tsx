import { useEffect, useRef, type RefObject } from 'react';
import type { InstrumentEvent } from '../contracts.ts';
import type { SignalConsoleObservation } from '../signal-console/types.ts';
import { selectMotionStudySample } from './motionStudyEvidence.ts';
import type { MotionMode } from './MotionMode.ts';
import { motionModeRenderers, type MotionRenderer } from './motionModeRenderers.ts';
import { initialMotionPolicyState, MOTION_POLICY_STATE_SCALAR_COUNT,
  stepMotionPolicies } from './motionResponsePolicy.ts';
import './motionStudy.css';

type MotionLayerProps = Readonly<{
  rootRef: RefObject<HTMLElement | null>;
  mode: MotionMode;
  observe(): SignalConsoleObservation;
  events: readonly InstrumentEvent[];
}>;

export function MotionLayer({ rootRef, mode, observe, events }: MotionLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const policyStateRef = useRef(initialMotionPolicyState);
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
    let sampleStart = 0;
    let sampleFrames = 0;
    let cpuTotal = 0;
    let policyTotal = 0;
    const render = (now: number) => {
      const started = performance.now();
      const dt = previousTime ? Math.min(.1, (now - previousTime) / 1000) : 1 / 60;
      previousTime = now;
      const { observe: read, events: recent } = latestRef.current;
      const sample = selectMotionStudySample(read(), recent);
      const policyStarted = performance.now();
      const stepped = stepMotionPolicies(policyStateRef.current, sample, dt);
      policyStateRef.current = stepped.state;
      const response = stepped.responses[mode];
      policyTotal += performance.now() - policyStarted;
      const gpuMilliseconds = renderer.draw(geometry, response, sample.progress);
      sampleFrames += 1;
      cpuTotal += performance.now() - started;
      if (!sampleStart) sampleStart = now;
      if (now - sampleStart >= 1000) {
        canvas.dataset.motionFps = (sampleFrames * 1000 / (now - sampleStart)).toFixed(1);
        canvas.dataset.motionCpuMs = (cpuTotal / sampleFrames).toFixed(3);
        canvas.dataset.motionPolicyMs = (policyTotal / sampleFrames).toFixed(3);
        canvas.dataset.motionStateScalars = String(MOTION_POLICY_STATE_SCALAR_COUNT);
        canvas.dataset.motionGpuMs = gpuMilliseconds === null ? 'unavailable' : gpuMilliseconds.toFixed(3);
        canvas.dataset.motionActivity = response.activity.toFixed(3);
        canvas.dataset.motionArticulation = response.articulation.toFixed(3);
        canvas.dataset.motionMemory = response.memory.toFixed(3);
        canvas.dataset.motionOrganization = response.organization.toFixed(3);
        canvas.dataset.motionCommitment = response.commitment.toFixed(3);
        sampleStart = now;
        sampleFrames = 0;
        cpuTotal = 0;
        policyTotal = 0;
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
