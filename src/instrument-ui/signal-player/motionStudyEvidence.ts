import type { InstrumentEvent } from '../contracts.ts';
import type { SignalConsoleObservation } from '../signal-console/types.ts';

export type MotionStudyVariant = 'a' | 'b' | 'c';

export type MotionStudySample = Readonly<{
  active: boolean;
  level: number;
  transient: number;
  structureEnergy: number;
  beat: number;
  progress: number;
}>;

const clamp = (value: number) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

function retainedAt<T>(frames: readonly T[] | null | undefined, time: number, start: (frame: T) => number) {
  if (!frames?.length) return null;
  let low = 0;
  let high = frames.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (start(frames[middle]) <= time) low = middle + 1;
    else high = middle;
  }
  return frames[Math.max(0, low - 1)] ?? null;
}

/** Study-only visual projection. It never changes retained analysis or musical time. */
export function selectMotionStudySample(observation: SignalConsoleObservation,
  events: readonly InstrumentEvent[]): MotionStudySample {
  const { audioMap, transport } = observation;
  const active = transport.playing && transport.time < transport.duration;
  const amplitude = retainedAt(audioMap.amplitude, transport.time, frame => frame.start);
  const structure = retainedAt(audioMap.structureAnalysis?.frames, transport.time, frame => frame.start);
  const latestBeat = [...events].reverse().find(event => event.type === 'beat' && event.time <= transport.time);
  const beat = latestBeat && latestBeat.type === 'beat'
    ? clamp(1 - (transport.time - latestBeat.time) / .18) : 0;
  return {
    active,
    level: active ? clamp(amplitude?.rms[0] ?? 0) : 0,
    transient: active ? clamp(amplitude?.onsetStrength[0] ?? 0) : 0,
    structureEnergy: active ? clamp(structure?.energy ?? 0) : 0,
    beat: active ? beat : 0,
    progress: transport.duration > 0 ? clamp(transport.time / transport.duration) : 0,
  };
}

export function motionStudyTarget(variant: MotionStudyVariant, sample: MotionStudySample) {
  if (!sample.active) return 0;
  if (variant === 'a') return clamp(sample.level * .55 + sample.transient * .35 + sample.beat * .1);
  if (variant === 'b') return clamp(sample.level * .3 + sample.transient * .5 + sample.beat * .2);
  const audible = clamp(sample.level * 8 + sample.transient * 2);
  return clamp((sample.structureEnergy * .55 + sample.level * .35 + sample.transient * .1) * audible);
}
