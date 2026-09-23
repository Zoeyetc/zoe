import type {
  PhysicsDebugState, PhysicsImpact, PhysicsPulse, PhysicsPulseReception, PhysicsReceiverRegistration, PhysicsWake, PhysicsWakeReception, WorldPoint,
} from './types';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Push-based shared causality layer with no AudioWorld, React, or DOM dependency. */
export function createPhysicsWorld() {
  const sources = new Set<string>();
  const receivers = new Map<string, PhysicsReceiverRegistration>();
  const deliveredIds = new Set<string>();
  let impactCount = 0;
  let latestImpact: PhysicsImpact | null = null;
  let latestReceiverDistance: number | null = null;
  const wakes = new Map<string, PhysicsWake>();
  let latestWake: PhysicsWake | null = null;
  let latestWakeReception: PhysicsWakeReception | null = null;
  let pulseCount = 0;
  let latestPulse: PhysicsPulse | null = null;
  let latestPulseReception: PhysicsPulseReception | null = null;

  const normalize = (point: WorldPoint): WorldPoint => {
    const length = Math.hypot(point.x, point.y);
    return length > 1e-9 ? { x: point.x / length, y: point.y / length } : { x: 1, y: 0 };
  };

  const read = (): PhysicsDebugState => ({
    status: 'ready', coordinateSpace: 'normalized-2d',
    registeredSources: sources.size, registeredReceivers: receivers.size,
    impactCount, latestImpact, latestReceiverDistance,
    activeWakeCount: wakes.size, latestWake, latestWakeReception,
    pulseCount, latestPulse, latestPulseReception,
  });
  return {
    read,
    registerSource(id: string) {
      if (sources.has(id)) throw new Error(`Duplicate physics source: ${id}`);
      sources.add(id);
      return () => { sources.delete(id); wakes.delete(id); };
    },
    registerReceiver(receiver: PhysicsReceiverRegistration) {
      if (receivers.has(receiver.id)) throw new Error(`Duplicate physics receiver: ${receiver.id}`);
      receivers.set(receiver.id, receiver);
      return () => receivers.delete(receiver.id);
    },
    publishImpact(impact: PhysicsImpact) {
      if (!sources.has(impact.sourceId)) throw new Error(`Unknown physics source: ${impact.sourceId}`);
      if (deliveredIds.has(impact.id)) return;
      deliveredIds.add(impact.id);
      const bounded: PhysicsImpact = {
        ...impact,
        position: { x: clamp01(impact.position.x), y: clamp01(impact.position.y) },
        strength: clamp01(impact.strength), radius: Math.max(0, impact.radius),
      };
      latestImpact = bounded;
      impactCount += 1;
      latestReceiverDistance = null;
      for (const receiver of receivers.values()) {
        const distance = Math.hypot(
          receiver.position.x - bounded.position.x,
          receiver.position.y - bounded.position.y,
        );
        latestReceiverDistance = latestReceiverDistance === null
          ? distance : Math.min(latestReceiverDistance, distance);
        if (bounded.radius <= 0 || distance > bounded.radius) continue;
        const proximity = clamp01(1 - distance / bounded.radius);
        receiver.receive(bounded, proximity * proximity, distance);
      }
    },
    updateWake(wake: PhysicsWake, dt: number) {
      if (!sources.has(wake.sourceId)) throw new Error(`Unknown physics source: ${wake.sourceId}`);
      const forward = normalize(wake.forward);
      const bounded: PhysicsWake = {
        ...wake,
        position: { x: clamp01(wake.position.x), y: clamp01(wake.position.y) },
        forward,
        speed: Math.max(0, wake.speed),
        acceleration: Number.isFinite(wake.acceleration) ? wake.acceleration : 0,
        strength: clamp01(wake.strength),
        radius: Math.max(0, wake.radius),
        active: wake.active && wake.strength > 0 && wake.radius > 0,
      };
      latestWake = bounded;
      latestWakeReception = null;
      if (!bounded.active) {
        wakes.delete(bounded.sourceId);
        return;
      }
      wakes.set(bounded.sourceId, bounded);
      const trailing = { x: -forward.x, y: -forward.y };
      const perpendicular = { x: -trailing.y, y: trailing.x };
      for (const receiver of receivers.values()) {
        const delta = {
          x: receiver.position.x - bounded.position.x,
          y: receiver.position.y - bounded.position.y,
        };
        const distance = Math.hypot(delta.x, delta.y);
        const longitudinal = delta.x * trailing.x + delta.y * trailing.y;
        const lateral = Math.abs(delta.x * perpendicular.x + delta.y * perpendicular.y);
        const normalizedLongitudinal = clamp01(longitudinal / bounded.radius);
        const halfWidth = bounded.radius * (0.18 + normalizedLongitudinal * 0.34);
        const behind = longitudinal >= 0 && longitudinal <= bounded.radius;
        const lateralFalloff = halfWidth > 0 ? clamp01(1 - lateral / halfWidth) : 0;
        const distanceFalloff = clamp01(1 - longitudinal / bounded.radius);
        const alignment = distance > 1e-9
          ? clamp01((delta.x * trailing.x + delta.y * trailing.y) / distance) : 1;
        const falloff = behind ? distanceFalloff * lateralFalloff * alignment : 0;
        const force = {
          x: forward.x * bounded.strength * falloff,
          y: forward.y * bounded.strength * falloff,
        };
        const reception: PhysicsWakeReception = {
          receiverId: receiver.id,
          sourceId: bounded.sourceId,
          distance,
          alignment,
          falloff,
          force,
        };
        if (latestWakeReception === null || reception.distance < latestWakeReception.distance) {
          latestWakeReception = reception;
        }
        const boundedDt = Math.min(0.1, Math.max(0, dt));
        if (falloff > 0 && boundedDt > 0) receiver.receiveWake?.(bounded, reception, boundedDt);
      }
    },
    updatePulse(pulse: PhysicsPulse, dt: number) {
      if (!sources.has(pulse.sourceId)) throw new Error(`Unknown physics source: ${pulse.sourceId}`);
      const bounded: PhysicsPulse = {
        ...pulse,
        position: { x: clamp01(pulse.position.x), y: clamp01(pulse.position.y) },
        strength: clamp01(pulse.strength),
        radius: Math.max(0, pulse.radius),
        active: pulse.active && pulse.strength > 0 && pulse.radius > 0,
      };
      latestPulse = bounded;
      latestPulseReception = null;
      if (!bounded.active) return;
      pulseCount += 1;
      const boundedDt = Math.min(0.1, Math.max(0, dt));
      for (const receiver of receivers.values()) {
        const delta = {
          x: receiver.position.x - bounded.position.x,
          y: receiver.position.y - bounded.position.y,
        };
        const distance = Math.hypot(delta.x, delta.y);
        const falloff = distance <= bounded.radius ? Math.pow(clamp01(1 - distance / bounded.radius), 1.5) : 0;
        const direction = distance > 1e-9 ? { x: delta.x / distance, y: delta.y / distance } : { x: 0, y: -1 };
        const reception: PhysicsPulseReception = {
          receiverId: receiver.id,
          sourceId: bounded.sourceId,
          distance,
          falloff,
          force: { x: direction.x * bounded.strength * falloff, y: direction.y * bounded.strength * falloff },
        };
        if (latestPulseReception === null || reception.distance < latestPulseReception.distance) {
          latestPulseReception = reception;
        }
        if (falloff > 0 && boundedDt > 0) receiver.receivePulse?.(bounded, reception, boundedDt);
      }
    },
    removeWake(sourceId: string) {
      wakes.delete(sourceId);
      if (latestWake?.sourceId === sourceId) {
        latestWake = { ...latestWake, active: false, strength: 0 };
        latestWakeReception = null;
      }
    },
    clear() {
      deliveredIds.clear();
      impactCount = 0;
      latestImpact = null;
      latestReceiverDistance = null;
      wakes.clear();
      latestWake = null;
      latestWakeReception = null;
      pulseCount = 0;
      latestPulse = null;
      latestPulseReception = null;
    },
  };
}
