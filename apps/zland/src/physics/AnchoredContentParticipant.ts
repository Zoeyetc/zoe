import { createAnchoredReceiver, type AnchoredReceiverOptions } from './AnchoredReceiver.ts';
import type { WorldPoint } from './types.ts';

export type WorldBounds = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type AnchoredContentParticipantOptions = AnchoredReceiverOptions & Readonly<{
  bounds?: WorldBounds;
}>;

const centerOf = (bounds: WorldBounds): WorldPoint => ({
  x: bounds.x + bounds.width / 2,
  y: bounds.y + bounds.height / 2,
});

/** Ordinary authored content plus a reusable, temporary AnchoredReceiver response layer. */
export function createAnchoredContentParticipant(options: AnchoredContentParticipantOptions = {}) {
  let bounds: WorldBounds = options.bounds ?? {
    x: (options.position?.x ?? 0.5) - 0.1,
    y: (options.position?.y ?? 0.78) - 0.05,
    width: 0.2,
    height: 0.1,
  };
  let layoutRevision = 0;
  const receiver = createAnchoredReceiver({ ...options, position: centerOf(bounds) });

  return {
    registration: receiver.registration,
    step: receiver.step,
    reset: receiver.reset,
    updateLayout(nextBounds: WorldBounds) {
      bounds = { ...nextBounds };
      layoutRevision += 1;
      receiver.setAnchor(centerOf(bounds));
    },
    read() {
      return { ...receiver.read(), bounds, layoutRevision };
    },
  };
}

export type AnchoredContentParticipantState = ReturnType<
  ReturnType<typeof createAnchoredContentParticipant>['read']
>;
