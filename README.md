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
- `src/audio/AudioMap.ts` and `types.ts`: serializable contracts and deterministic authored musical-domain fixtures, including the 24-second spectrum/texture timeline.
- `src/audio/AudioWorld.ts`: pure snapshot lookup plus stateful event timeline crossing. Seek resets its cursor and emits only a seek event.
- `src/rides/carousel`: semantic adapter, actor-local mechanical simulation, and separate renderer. Base rotation/inertia and per-rider pitch springs are independent motion channels.
- `src/physics`: shared impact/wake causality, canonical normalized coordinates, spatial adapters, anchored receivers, and debug projection.
- `src/free-bodies`: atmospheric adapter, deterministic dynamic-body simulation, PhysicsWorld registrations, and minimal Orb renderer.
- `src/control`: presentation and action contract; preparation type reserved, no song ingestion.
- `src/debug`: read-only instrumentation for musical, actor, shared physics, and dynamic-body state.
- `src/experience`: composition root and App wiring. 10 Hz UI polling samples the clock; it never advances transport and is not a simulation loop.

## Placeholder behavior

Play/pause/seek/restart control a silent authored performance. Restart returns actors to deterministic initial states and clears shared transient physics. Seek skips historical musical and physical events. Melody drives Carousel expression; percussion drives BumperCars impulses; groove drives PirateShip's actor-local pendulum. Meaningful BumperCars body collisions publish normalized world-space impacts through PhysicsWorld. An anchored Test Receiver responds only to nearby physical impacts, then returns through spring and damping. Pause removes new musical input while actor and shared physical consequences may continue. Song replacement is not implemented.

The Milestone 3A.1 debug overlay projects the latest actual PhysicsWorld impact, radius, normal, receiver force path, received impulse, and receiver displacement into the BumperCars arena. Add `?hide-physics-debug` to the local URL to remove the overlay. The DebugConsole reports the same underlying event and receiver state.

Milestone 3B replaces the generic receiver view with a normal-layout content card. A DOM spatial adapter measures its authored bounds on mount, resize, ResizeObserver notification, or the explicit `zland:physics-layout-invalidate` event; simulation reads do not measure layout. The existing AnchoredReceiver supplies only the nested temporary response transform. Layout anchor changes do not create physics velocity, and restart clears response energy without replacing the measured layout.

Milestone 4A adds authored harmony to the prepared AudioMap and routes the continuous harmony snapshot plus chord-change/seek events through a dedicated FerrisWheel adapter. The actor retains its own slow wheel inertia and acceleration-driven suspended-cabin springs. Twelve abstract carriers represent simultaneous pitch classes; active chord tones are sustained together. FerrisWheel remains actor-local and has no PhysicsWorld role in this milestone.

Milestone 5A adds an authored structural fixture with rest, build, tension, hold, explicit major drop, release, and settling regions. AudioWorld exposes continuous structure state and a timeline-crossed `drop` event. DropTower interprets these through its own lift, hold, gravity drop, rebound, and settling state machine; seek reconciles directly without replaying a skipped drop. DropTower remains actor-local and has no PhysicsWorld role in this milestone.

Milestone 6A adds a separate 24-second phrase contour for RollerCoaster. The extracted open segmented route uses Station, Lift, Drop, Loop, Runout, and return Station geometry. Phrase progress, energy, tension, and release alter actor-local drive and braking conditions without directly assigning route distance or velocity. The neutral Orb rider remains a renderer concern.

Milestone 6B registers RollerCoaster as a continuous PhysicsWorld wake source. An explicit spatial adapter maps current route pose and forward direction into normalized world coordinates; wake strength derives only from physical speed and bounded acceleration. The directional trailing field and BumperCars impacts both feed the same anchored content receiver state.

Milestone 7A adds eight deterministic Free Bodies / Orbs in canonical PhysicsWorld space. Authored spectrum evidence changes bounded buoyancy and seeded continuous turbulence, while the same bodies receive real RollerCoaster wake and BumperCars collision effects through PhysicsWorld. All forces compose into one actor-local trajectory with soft containment, deterministic restart, and a restrained reduced-motion mode.

No real audio playback, analysis pipeline, final Park Map, or final art direction is included. Existing `AGENTS.md` and `.agents/skills/zland-music-box/` remain authoritative and unchanged.
