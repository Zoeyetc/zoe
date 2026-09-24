export type DoodlePoint = Readonly<{ x: number; y: number }>;

const hash = (seed: string) => {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
};

/** Stable signed noise derived only from semantic seed and sample index. */
export function doodleNoise(seed: string, index: number) {
  let value = hash(`${seed}:${index}`) || 1;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return ((value >>> 0) / 0xffffffff) * 2 - 1;
}

export function createDoodlePolyline(points: readonly DoodlePoint[], seed: string, roughness = 1, closed = false) {
  if (!points.length) return '';
  const rendered = points.map((point, index) => ({
    x: point.x + doodleNoise(seed, index * 2) * roughness,
    y: point.y + doodleNoise(seed, index * 2 + 1) * roughness,
  }));
  return rendered.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ')
    + (closed ? ' Z' : '');
}

export function createDoodleCircle(cx: number, cy: number, radius: number, seed: string, roughness = 1, samples = 32) {
  const points = Array.from({ length: samples }, (_, index) => {
    const angle = index / samples * Math.PI * 2;
    const localRadius = radius + doodleNoise(seed, index) * roughness;
    return { x: cx + Math.cos(angle) * localRadius, y: cy + Math.sin(angle) * localRadius };
  });
  return createDoodlePolyline(points, `${seed}:join`, roughness * 0.18, true);
}

/** Perturbs numeric path operands while preserving the authored command topology. */
export function createDoodlePath(path: string, seed: string, roughness = 1) {
  let operand = 0;
  return path.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, token => {
    const value = Number(token);
    const next = value + doodleNoise(seed, operand++) * roughness;
    return Number.isFinite(next) ? next.toFixed(2) : token;
  });
}
