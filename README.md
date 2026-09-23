# Z.land Music Box

Vite + React + TypeScript development experience through Milestone 8B.1.

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

The default route renders the shared Park Map. Add `?mode=workbench` to retain
the vertical actor-by-actor development view. `?hide-physics-debug` works with
either mode and may be combined as `?mode=workbench&hide-physics-debug`.

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

Milestone 8A.1 composes the existing live actors into one Park Map without
creating duplicate simulations. Explicit actor anchors use canonical normalized
PhysicsWorld coordinates: `(0, 0)` is the map's top-left and `(1, 1)` is its
bottom-right. The `1000 × 640` SVG viewBox is only a rendering projection.
RollerCoaster route samples pass through its existing spatial adapter;
BumperCars use the same arena-to-world mapping as their PhysicsWorld adapter;
Free Bodies already occupy canonical world space. The abstract Gate is a
non-interactive landmark, and the anchored content participant keeps its live
DOM-to-PhysicsWorld registration.

Milestone 8A.1b adds explicit irregular actor districts and increases the
semantic map scale of Carousel and FerrisWheel. BumperCars now maps its
unchanged local simulation arena into a bounded lower-right Park district;
rendered cars and published PhysicsWorld impacts use the same spatial adapter.
The canonical RollerCoaster route remains park-wide and gains renderer-only
rail bed, rail, tie, direction, and segment treatments. Free Bodies retain
their canonical positions while the overview renders smaller markers and only
the selected body's velocity, reducing map-level diagnostic density.

Milestone 8A.1c separates musical actors from experience infrastructure. A
static Park Train railway now carries outer circulation without AudioWorld or
PhysicsWorld participation. RollerCoaster retains its canonical phrase
simulation inside a dedicated district; its renderer and PhysicsWorld wake use
the same explicit district transform. Semantic scale makes FerrisWheel's twelve
harmonic carriers substantially larger and gives DropTower a taller structural
travel axis while preserving Carousel, PirateShip, and the bounded BumperCars
arena. Free Body positions remain canonical; renderer-only quiet zones reduce
their weight over dense musical evidence.

Milestone 8A.1d removes the obsolete heavy land contour so the quiet Park
Train railway is the sole composition perimeter. The configured railway loop
expands toward all four map edges while the ride districts remain inside it.
Park Map passes a district-only renderer fit to DropTower, mapping its unchanged
local `560 × 450` mechanics across the tall district so the guide and carriage
travel use the available vertical range. Workbench rendering keeps the original
aspect-preserving DropTower mapping.

Milestone 8A.1e rebalances three semantic actors without changing their live
state. DropTower keeps its district-height mapping in a shorter `0.54`-high
landmark. RollerCoaster moves left into a `0.47`-wide phrase district, with the
same expanded bounds supplied to both route rendering and PhysicsWorld wake.
PirateShip keeps its existing district and receives a Park-only height fit,
increasing pivot-to-carrier screen travel while Workbench retains the original
aspect-preserving renderer.

No real audio playback, analysis pipeline, final art direction, or Focus /
Attention interaction is included. Existing `AGENTS.md` and
`.agents/skills/zland-music-box/` remain authoritative and unchanged.

Milestone 8A.2 adds a presentation-only attention controller for stable Overview roles and manual actor Focus. Six explicit focus bounds drive one composition-level viewport transform while the same live actor, AudioWorld, and PhysicsWorld state continues underneath. Click or keyboard-activate an actor to focus it; use Back to Overview, Escape, or empty Park space to return.

Milestone 8A.2 adds a presentation-only attention controller for stable Overview roles and manual actor Focus. Six explicit focus bounds drive one composition-level viewport transform while the same live actor, AudioWorld, and PhysicsWorld state continues underneath. Click or keyboard-activate an actor to focus it; use Back to Overview, Escape, or empty Park space to return.

Milestone 8B.1 establishes a shared monochrome visual token system across the Park Map and development workbench. A single restrained accent family marks precise musical evidence and direct interaction, while actor mechanics, districts, map guides, and Park Train infrastructure use an explicit neutral stroke hierarchy. This pass changes presentation only; musical evidence, actor simulations, PhysicsWorld, topology, and Focus framing remain unchanged.
