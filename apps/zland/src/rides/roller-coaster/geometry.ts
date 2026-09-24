import type { SegmentGeometry, TrackFrame, Vec3 } from './types';

export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export const V = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
export const add = (a: Vec3, b: Vec3): Vec3 => V(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => V(a.x - b.x, a.y - b.y, a.z - b.z);
export const mul = (a: Vec3, scale: number): Vec3 => V(a.x * scale, a.y * scale, a.z * scale);
export const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: Vec3, b: Vec3): Vec3 => V(
  a.y * b.z - a.z * b.y,
  a.z * b.x - a.x * b.z,
  a.x * b.y - a.y * b.x,
);
export const magnitude = (value: Vec3) => Math.hypot(value.x, value.y, value.z);
export const norm = (value: Vec3): Vec3 => mul(value, 1 / Math.max(1e-12, magnitude(value)));
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, mul(sub(b, a), t));
const perpendicular = (up: Vec3, forward: Vec3) => {
  const projected = sub(up, mul(forward, dot(up, forward)));
  return magnitude(projected) > 1e-7
    ? norm(projected)
    : norm(cross(forward, Math.abs(forward.z) < 0.9 ? V(0, 0, 1) : V(0, 1, 0)));
};

/** Canonical legacy sampled XYZ geometry with minimal-rotation up-frame transport. */
function transport(up: Vec3, from: Vec3, to: Vec3) {
  const axis = cross(from, to);
  const cosine = clamp(dot(from, to), -1, 1);
  if (cosine < -0.999999) return perpendicular(up, to);
  return perpendicular(add(add(up, cross(axis, up)), mul(cross(axis, cross(axis, up)), 1 / (1 + cosine))), to);
}

export function sampledGeometry(points: readonly Vec3[], initialUp = V(0, -1, 0)): SegmentGeometry {
  if (points.length < 2) throw new Error('Geometry requires two distinct points');
  const filtered = points.filter((point, index) => index === 0 || magnitude(sub(point, points[index - 1])) > 1e-9);
  if (filtered.length < 2) throw new Error('Geometry has zero length');
  const distances = [0];
  for (let index = 1; index < filtered.length; index += 1) {
    distances.push(distances[index - 1] + magnitude(sub(filtered[index], filtered[index - 1])));
  }
  const tangents = filtered.map((_, index) => norm(sub(
    filtered[Math.min(index + 1, filtered.length - 1)],
    filtered[Math.max(0, index - 1)],
  )));
  const ups: Vec3[] = [perpendicular(initialUp, tangents[0])];
  for (let index = 1; index < filtered.length; index += 1) {
    ups.push(transport(ups[index - 1], tangents[index - 1], tangents[index]));
  }
  const lookup = (distance: number) => {
    const target = clamp(distance, 0, distances[distances.length - 1]);
    let low = 0;
    let high = filtered.length - 1;
    while (high - low > 1) {
      const middle = (low + high) >> 1;
      if (distances[middle] <= target) low = middle;
      else high = middle;
    }
    return { low, high, progress: (target - distances[low]) / (distances[high] - distances[low]) };
  };
  const sample = (values: readonly Vec3[], distance: number) => {
    const { low, high, progress } = lookup(distance);
    return lerp(values[low], values[high], progress);
  };
  return {
    length: distances[distances.length - 1],
    samplePosition: distance => sample(filtered, distance),
    sampleTangent: distance => norm(sample(tangents, distance)),
    sampleUp: distance => {
      const tangent = norm(sample(tangents, distance));
      return perpendicular(sample(ups, distance), tangent);
    },
  };
}

export function frameAt(geometry: SegmentGeometry, distance: number): TrackFrame {
  return {
    position: geometry.samplePosition(distance),
    forward: geometry.sampleTangent(distance),
    up: geometry.sampleUp(distance),
  };
}

/** Canonical rigid placement maps a segment's complete local basis onto the previous exit frame. */
export function placeGeometry(geometry: SegmentGeometry, destination: TrackFrame): SegmentGeometry {
  const source = frameAt(geometry, 0);
  const sourceRight = cross(source.forward, source.up);
  const destinationRight = cross(destination.forward, destination.up);
  const rotate = (value: Vec3) => add(
    add(mul(destination.forward, dot(value, source.forward)), mul(destination.up, dot(value, source.up))),
    mul(destinationRight, dot(value, sourceRight)),
  );
  return {
    length: geometry.length,
    samplePosition: distance => add(destination.position, rotate(sub(geometry.samplePosition(distance), source.position))),
    sampleTangent: distance => norm(rotate(geometry.sampleTangent(distance))),
    sampleUp: distance => norm(rotate(geometry.sampleUp(distance))),
  };
}

export const lineGeometry = (length: number) => sampledGeometry([V(), V(length, 0, 0)]);

/** Canonical hidden connector gradually reconciles an authored exit tangent to the next +X entry frame. */
export function connectorGeometry(frame: TrackFrame, length = 120): SegmentGeometry {
  const angle = Math.atan2(frame.forward.y, frame.forward.x);
  const points: Vec3[] = [frame.position];
  const count = 60;
  const step = length / count;
  for (let index = 1; index <= count; index += 1) {
    const progress = (index - 0.5) / count;
    const eased = progress * progress * (3 - 2 * progress);
    const currentAngle = angle * (1 - eased);
    points.push(add(points[points.length - 1], V(step * Math.cos(currentAngle), step * Math.sin(currentAngle), 0)));
  }
  const geometry = sampledGeometry(points, frame.up);
  const endForward = V(1, 0, 0);
  const endpointUp = (up: Vec3, forward: Vec3) => norm(sub(up, mul(forward, dot(up, forward))));
  return {
    ...geometry,
    sampleTangent: distance => distance <= 0 ? frame.forward
      : distance >= geometry.length ? endForward : geometry.sampleTangent(distance),
    sampleUp: distance => distance <= 0 ? endpointUp(frame.up, frame.forward)
      : distance >= geometry.length ? endpointUp(geometry.sampleUp(distance), endForward)
        : geometry.sampleUp(distance),
  };
}

export function makeLiftGeometry() {
  const run = 390;
  const ramp = 95;
  const slope = Math.tan(38 * Math.PI / 180);
  return sampledGeometry(Array.from({ length: 193 }, (_, index) => {
    const x = run * index / 192;
    const t = Math.min(1, x / ramp);
    const rise = x < ramp ? ramp * (t ** 3 - 0.5 * t ** 4) : x - ramp / 2;
    return V(x, -slope * rise, 0);
  }));
}

export function makeDropGeometry() {
  const points: Vec3[] = [];
  for (let index = 0; index <= 24; index += 1) points.push(V(70 * index / 24, 0, 0));
  for (let index = 1; index <= 128; index += 1) {
    const t = index / 128;
    const smooth = 6 * t ** 5 - 15 * t ** 4 + 10 * t ** 3;
    points.push(V(70 + 310 * t, 310 * smooth, 0));
  }
  for (let index = 1; index <= 24; index += 1) points.push(V(380 + 90 * index / 24, 310, 0));
  return sampledGeometry(points);
}

export function makeLoopGeometry() {
  const radius = 82;
  const lead = 84;
  const points: Vec3[] = Array.from({ length: 25 }, (_, index) => V(lead * index / 24, 0, 0));
  for (let index = 1; index <= 360; index += 1) {
    const angle = index * Math.PI * 2 / 360;
    points.push(V(lead + radius * 1.45 * Math.sin(angle), radius * (Math.cos(angle) - 1), 0));
  }
  for (let index = 1; index <= 24; index += 1) points.push(V(lead + lead * index / 24, 0, 0));
  return sampledGeometry(points);
}

export function makeRunoutGeometry() {
  const points: Vec3[] = [];
  for (let index = 0; index <= 256; index += 1) {
    const t = index / 256;
    points.push(V(520 * t, 70 * Math.sin(t * Math.PI * 2) * (1 - t), 110 * Math.sin(t * Math.PI),));
  }
  return sampledGeometry(points);
}
