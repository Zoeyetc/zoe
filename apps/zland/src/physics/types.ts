export type PhysicsRole = 'force-source' | 'receiver' | 'collider' | 'dynamic-body';
export type WorldPoint = Readonly<{ x: number; y: number }>;

/** Canonical space is normalized 2D: top-left (0,0), bottom-right (1,1). */
export type PhysicsImpact = Readonly<{
  id: string;
  sourceId: string;
  sourceType: 'collision';
  position: WorldPoint;
  direction: WorldPoint;
  strength: number;
  radius: number;
  timestamp: number;
}>;

export type PhysicsWake = Readonly<{
  sourceId: string;
  sourceType: 'wake';
  position: WorldPoint;
  forward: WorldPoint;
  speed: number;
  acceleration: number;
  strength: number;
  radius: number;
  timestamp: number;
  active: boolean;
}>;

export type PhysicsWakeReception = Readonly<{
  receiverId: string;
  sourceId: string;
  distance: number;
  alignment: number;
  falloff: number;
  force: WorldPoint;
}>;

/** A broad, low-energy PhysicsWorld source derived from shared rhythmic phase. */
export type PhysicsPulse = Readonly<{
  sourceId: string;
  sourceType: 'pulse';
  position: WorldPoint;
  strength: number;
  radius: number;
  timestamp: number;
  active: boolean;
}>;

export type PhysicsPulseReception = Readonly<{
  receiverId: string;
  sourceId: string;
  distance: number;
  falloff: number;
  force: WorldPoint;
}>;

export type PhysicsReceiverRegistration = Readonly<{
  id: string;
  roles?: readonly PhysicsRole[];
  position: WorldPoint;
  receive(impact: PhysicsImpact, influence: number, distance: number): void;
  receiveWake?(wake: PhysicsWake, reception: PhysicsWakeReception, dt: number): void;
  receivePulse?(pulse: PhysicsPulse, reception: PhysicsPulseReception, dt: number): void;
}>;

export type PhysicsDebugState = Readonly<{
  status: 'ready';
  coordinateSpace: 'normalized-2d';
  registeredSources: number;
  registeredReceivers: number;
  impactCount: number;
  latestImpact: PhysicsImpact | null;
  latestReceiverDistance: number | null;
  activeWakeCount: number;
  latestWake: PhysicsWake | null;
  latestWakeReception: PhysicsWakeReception | null;
  pulseCount: number;
  latestPulse: PhysicsPulse | null;
  latestPulseReception: PhysicsPulseReception | null;
}>;
