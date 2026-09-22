import type { PhysicsDebugState, PhysicsImpact, PhysicsReceiverRegistration } from './types';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Push-based shared causality layer with no AudioWorld, React, or DOM dependency. */
export function createPhysicsWorld() {
  const sources = new Set<string>();
  const receivers = new Map<string, PhysicsReceiverRegistration>();
  const deliveredIds = new Set<string>();
  let impactCount = 0;
  let latestImpact: PhysicsImpact | null = null;
  let latestReceiverDistance: number | null = null;

  const read = (): PhysicsDebugState => ({
    status: 'ready', coordinateSpace: 'normalized-2d',
    registeredSources: sources.size, registeredReceivers: receivers.size,
    impactCount, latestImpact, latestReceiverDistance,
  });
  return {
    read,
    registerSource(id: string) {
      if (sources.has(id)) throw new Error(`Duplicate physics source: ${id}`);
      sources.add(id);
      return () => sources.delete(id);
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
    clear() {
      deliveredIds.clear();
      impactCount = 0;
      latestImpact = null;
      latestReceiverDistance = null;
    },
  };
}
