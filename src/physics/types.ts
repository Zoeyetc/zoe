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

export type PhysicsReceiverRegistration = Readonly<{
  id: string;
  position: WorldPoint;
  receive(impact: PhysicsImpact, influence: number, distance: number): void;
}>;

export type PhysicsDebugState = Readonly<{
  status: 'ready';
  coordinateSpace: 'normalized-2d';
  registeredSources: number;
  registeredReceivers: number;
  impactCount: number;
  latestImpact: PhysicsImpact | null;
  latestReceiverDistance: number | null;
}>;
