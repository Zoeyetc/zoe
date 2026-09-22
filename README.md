# Z.land Music Box

Initial Vite + React + TypeScript vertical slice through Milestone 1B.

## Run

Node.js 22.12+ (Node 24 recommended), npm:

```sh
npm install
npm run dev
```

```sh
npm run typecheck
npm run build
npm run preview
```

Vite prints the local URL. Runtime dependencies: React and React DOM only.
Vite handles TSX without an additional React plugin; edits reload the page.

## Ownership

- `src/audio/AudioClock.ts`: sole transport owner; injected monotonic seconds for a silent preview. Real audio must use a Web Audio transport-backed implementation.
- `src/audio/AudioMap.ts` and `types.ts`: serializable contracts and a deterministic 12-second authored melody fixture.
- `src/audio/AudioWorld.ts`: pure snapshot lookup plus stateful note-event timeline crossing. Seek resets its cursor and emits only a seek event.
- `src/rides/carousel`: semantic adapter, actor-local mechanical simulation, and separate renderer. Base rotation/inertia and per-rider pitch springs are independent motion channels.
- `src/physics`: reserved types only; no world instance, solver, participants or spatial conversion yet.
- `src/control`: presentation and action contract; preparation type reserved, no song ingestion.
- `src/debug`: read-only instrumentation placeholder.
- `src/experience`: composition root and App wiring. 10 Hz UI polling samples the clock; it never advances transport and is not a simulation loop.

## Placeholder behavior

Play/pause/seek/restart control a silent authored performance. Restart returns actors to deterministic initial states and clears shared transient physics. Seek skips historical musical and physical events. Melody drives Carousel expression; percussion drives BumperCars impulses; groove drives PirateShip's actor-local pendulum. Meaningful BumperCars body collisions publish normalized world-space impacts through PhysicsWorld. An anchored Test Receiver responds only to nearby physical impacts, then returns through spring and damping. Pause removes new musical input while actor and shared physical consequences may continue. Song replacement is not implemented.

## Next milestone work

1. Add prepared-map validation at the ingestion boundary and song replacement lifecycle.
2. Replace the minimal Carousel simulation only when canonical legacy migration is explicitly scoped; preserve the now-proven AudioWorld adapter contract.
3. Choose a second actor with a different signal type for milestone 2.

Carousel's eventual inputs are continuous melody and discrete note-on/off/seek. No PhysicsWorld roles are registered in this skeleton. Establish canonical coordinates and spatial adapters before cross-object effects.

No legacy migration, audio playback, analysis pipeline, final gate/ticket-booth visuals, MotionWorld, other rides, or PhysicsWorld engine is included. Existing `AGENTS.md` and `.agents/skills/zland-music-box/` remain authoritative and unchanged.
