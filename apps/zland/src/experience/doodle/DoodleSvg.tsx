import type { SVGProps } from 'react';
import { createDoodleCircle, createDoodlePath, createDoodlePolyline, type DoodlePoint } from './geometry';

type PathProps = Omit<SVGProps<SVGPathElement>, 'd'> & Readonly<{
  d: string; seed: string; roughness?: number; secondary?: boolean;
}>;

export function DoodlePath({ d, seed, roughness = 1, secondary = false, className = '', ...props }: PathProps) {
  const main = createDoodlePath(d, seed, roughness);
  return <>
    {secondary && <path {...props} aria-hidden="true" className={`${className} doodle-stroke doodle-stroke--echo`}
      d={createDoodlePath(d, `${seed}:echo`, roughness * 1.18)} />}
    <path {...props} className={`${className} doodle-stroke`} d={main} />
  </>;
}

export function DoodlePolyline({ points, seed, roughness = 1, closed = false, secondary = false, className = '', ...props }:
  Omit<PathProps, 'd' | 'points'> & Readonly<{ points: readonly DoodlePoint[]; closed?: boolean }>) {
  const d = createDoodlePolyline(points, seed, roughness, closed);
  return <DoodlePath {...props} className={className} d={d} seed={`${seed}:path`} roughness={roughness * 0.15} secondary={secondary} />;
}

export function DoodleCircle({ cx, cy, r, seed, roughness = 1, secondary = false, className = '', ...props }:
  Omit<PathProps, 'd'> & Readonly<{ cx: number; cy: number; r: number }>) {
  const d = createDoodleCircle(cx, cy, r, seed, roughness);
  return <DoodlePath {...props} className={className} d={d} seed={`${seed}:path`} roughness={roughness * 0.12} secondary={secondary} />;
}

export function DoodleLine({ x1, y1, x2, y2, seed, roughness = 1, secondary = false, className = '', ...props }:
  Omit<PathProps, 'd'> & Readonly<{ x1: number; y1: number; x2: number; y2: number }>) {
  const points = Array.from({ length: 5 }, (_, index) => ({
    x: x1 + (x2 - x1) * index / 4,
    y: y1 + (y2 - y1) * index / 4,
  }));
  return <DoodlePolyline {...props} className={className} points={points} seed={seed}
    roughness={roughness} secondary={secondary} />;
}
