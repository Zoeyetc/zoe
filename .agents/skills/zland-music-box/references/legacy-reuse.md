# Z.land Music Box — Legacy Reuse Map v0.1

## 1. Purpose

This document classifies existing Z.land / Framer work before migration into
the standalone Z.land Music Box project.

The goal is to preserve validated simulation work without dragging legacy
Framer scaffolding, abandoned architecture, or obsolete product assumptions
into the new project.

Each legacy asset is classified as one of:

```text
KEEP
EXTRACT
REFERENCE
REBUILD
DROP
```

Definitions:

### KEEP

The existing implementation is already close to the desired standalone
architecture.

Preserve behavior and migrate with minimal structural change.

### EXTRACT

The implementation contains valuable simulation or geometry, but it is mixed
with Framer, React, renderer, or product-specific code.

Extract the reusable core before integration.

### REFERENCE

The implementation contains useful ideas, algorithms, parameters, or visual
behavior, but should not be migrated directly.

Use it as design / engineering reference.

### REBUILD

The concept remains valid, but the current implementation does not satisfy the
new architecture.

Implement again using current world contracts.

### DROP

Do not use this implementation as a baseline.

It is obsolete, replaced, or belongs only to the previous Template / Framer
experiment.

---

# 2. Migration rule

Do not migrate by copying whole legacy components into the new repo.

For each asset:

```text
inspect
↓
identify reusable behavior
↓
separate pure simulation
↓
verify parity
↓
remove Framer-specific ownership
↓
connect new world contract
```

Do not change musical behavior, physical behavior, renderer architecture, and
file organization in the same migration step unless the current milestone
requires all of them.

Prefer:

```text
extract first
integrate second
redesign third
```

---

# 3. Canonical RollerCoaster baseline

## Classification

```text
NEW segmented RollerCoaster
→ EXTRACT / KEEP simulation

OLD closed-circuit RollerCoaster
→ REFERENCE ONLY
```

---

## Canonical version

The canonical RollerCoaster is the newer segmented architecture containing
concepts such as:

```text
Vec3
TrackFrame
SegmentGeometry
SegmentDefinition
Route
RoutePiece
RideState
HiddenConnector
FrameDriver
```

and route concepts including some or all of:

```text
Lift
Drop
Loop
Helix
Runout
Station
```

The canonical architecture is the version that introduced:

- open route composition
- persistent routeDistance
- segment definitions
- connector logic
- per-segment physics
- entry / exit frames
- world-space XYZ geometry
- camera-independent ride simulation
- Orb rider work
- PhysicsSource integration

This version is the only valid RollerCoaster migration baseline.

---

## Preserve

Preserve the behavior and design intent of:

```text
sampledGeometry()
frameAt()
placeGeometry()
composeRoute()
sampleRoute()

createRideState()
advanceRide()

segment-specific physics
Drop hold logic
Loop physics
Helix / Runout geometry where validated
Station braking
connector behavior
route continuity
```

Preserve the principle:

```text
user / AudioWorld trigger
↓
ride simulation
↓
routeDistance / velocity / acceleration
↓
renderer
```

AudioWorld must not replace route simulation with direct timeline animation.

---

## Extract

Target conceptual standalone structure:

```text
rides/
└── rollerCoaster/
    ├── types.ts
    ├── geometry.ts
    ├── route.ts
    ├── simulation.ts
    ├── physics.ts
    ├── media/
    │   ├── OrbRider
    │   └── future riders
    └── renderers/
```

Exact file names are not locked.

Do not over-split prematurely.

---

## Rider / media architecture

Existing Orb work is useful.

The new project should preserve the separation:

```text
RollerCoaster trajectory
≠
RollerCoaster rider media
```

Future rider/media may include:

```text
Orb
Text
Title
Slogan
Image
Logo
Icon
3D Object
Shader
Custom Media
```

Do not couple route simulation to one media representation.

---

## PhysicsWorld integration

Preserve the idea that RollerCoaster may register as a moving PhysicsSource.

Useful source information includes:

```text
position
forward
velocity
acceleration
airflowRadius
contactRadius
intensity
```

RollerCoaster airflow / wake should remain a real spatial PhysicsWorld effect.

Do not directly animate nearby objects from RollerCoaster renderer code.

---

## Do not migrate

Do not migrate as core:

- Framer Property Controls
- `useIsStaticRenderer`
- `RenderTarget`
- Framer Canvas-specific sizing
- Framer button UI
- Framer-specific overrides
- legacy accessibility wrappers that belong to component packaging

Reimplement only if a standalone renderer actually needs equivalent behavior.

---

# 4. Old RollerCoaster

## Classification

```text
REFERENCE
```

The old RollerCoaster is the earlier continuous / closed-circuit implementation.

It may contain useful historical reference for:

- Hermite interpolation
- visual styling
- typography carriage treatment
- old track presentation
- early velocity heuristics
- SVG rendering techniques

It is NOT the canonical physics architecture.

Do not:

- merge old modulo route logic into the segmented route
- restore closed-loop wrapping
- rebuild new work around old viewport-relative geometry
- use the old component merely because it appears visually simpler

If old visual behavior is desired, port the visual behavior onto the canonical
segmented route architecture.

---

# 5. PhysicsWorld

## Classification

```text
KEEP / EXTRACT
```

PhysicsWorld is one of the highest-value existing systems.

Existing concepts include:

```text
registerPhysicsSource()
getPhysicsSource()
invalidatePhysics()

attachPhysicsReceiver()

registerPhysicsCollider()
samplePhysicsColliders()
```

and participant concepts including:

```text
Force Source
Physics Receiver
Collider
Dynamic Body
```

---

## Preserve

Preserve these architecture principles:

```text
one shared spatial causality layer
```

```text
actors publish physical state
```

```text
receivers respond through PhysicsWorld
```

```text
colliders / exclusion zones influence spatial behavior
```

```text
cross-object effects are not duplicated visual animations
```

PhysicsWorld remains independent of AudioWorld.

AudioWorld may cause an actor to move.

The actor then affects PhysicsWorld.

---

## Standalone migration

Move reusable world logic into a standalone module conceptually like:

```text
physics/
├── PhysicsWorld.ts
├── types.ts
├── spatial.ts
└── optional adapters/
```

Do not preserve `.tsx` merely because the Framer version used React.

If the core does not render React, prefer `.ts`.

---

## Framer-specific parts

The existing PhysicsWorld may contain DOM-oriented assumptions.

Audit:

- viewport coordinate usage
- DOMRect usage
- direct window access
- requestAnimationFrame ownership
- scroll compensation
- document visibility lifecycle

Do not blindly copy these assumptions into the standalone coordinate system.

The standalone project must follow the canonical spatial contract defined in
`architecture.md`.

---

# 6. PhysicsParticipant

## Classification

```text
REFERENCE / FRAMER ADAPTER
```

PhysicsParticipant is useful evidence that native Framer content can be
registered into PhysicsWorld without giving PhysicsWorld ownership of layout.

Important design principle worth preserving:

```text
layout layer
↓
response layer
```

The Framer outer element owns normal layout.

A nested visual layer receives physical transforms.

This supports:

```text
current layout anchor
+
physics response
```

without forcing ordinary content into free-body simulation.

---

## Do not migrate directly

PhysicsParticipant depends on:

- Framer ComponentInstance
- Framer Property Controls
- React wrapper structure
- DOM registration

Do not use it as standalone PhysicsWorld core.

---

## Preserve conceptually

Future standalone content participants may use the same pattern:

```text
layout / authored transform
+
physics offset
+
recovery
```

Content may be:

```text
Text
Image
Button
Logo
navigation
project card
```

---

# 7. PhysicsSource

## Classification

```text
REFERENCE / ADAPTER
```

PhysicsSource currently wraps a moving DOM actor and publishes sampled spatial
information into PhysicsWorld.

Useful concepts include:

- explicit source ID
- moving anchor
- source radius
- contact radius
- velocity estimation
- scroll-motion subtraction
- visibility checks

---

## Preserve conceptually

The following principle is important:

> Camera, viewport, or host-container motion must not be interpreted as actor
> physical velocity.

The Framer implementation subtracts host movement to avoid false velocity from
native scrolling.

The standalone project must preserve this principle using its new spatial
contract.

---

## Do not migrate directly

Do not retain:

- DOM selector-based actor identity as the universal source contract
- Framer wrapper ownership
- browser-layout measurement as the only possible source type

Three.js, Canvas, DOM, and simulation-native actors may each need different
source adapters.

---

# 8. PhysicsReceiverOverrides

## Classification

```text
DROP AS CORE
REFERENCE ONLY
```

Legacy overrides such as:

```text
withCoasterReceiver
withPhysicsText
withPhysicsCard
withPhysicsNavigation
```

belong to the Framer prototype.

They should not become standalone architecture.

Useful reference:

- different content types may have different displacement limits
- navigation should remain strongly anchored
- card response can be stronger than navigation
- text may use different bounds from rigid boxes

These values are design references only.

Future material / receiver contracts should be redesigned when the experience
requires them.

---

# 9. MotionWorldCore

## Classification

```text
REFERENCE / OPTIONAL FUTURE SIBLING SYSTEM
```

MotionWorldCore is not AudioWorld.

It solves a different problem:

```text
scroll
section progress
ownership
choreography role
page motion intensity
```

Useful architecture ideas include:

- one global measurement source
- analytic section progress
- ownership
- explicit role semantics
- offscreen lifecycle
- reduced motion
- demand-driven frame work
- no per-frame React state

---

## Do not migrate into Music Box milestone 1

The initial Music Box does not require scroll choreography.

Do not insert MotionWorld between:

```text
AudioWorld
and
Actors
```

AudioWorld and MotionWorld are sibling input/director domains.

Future architecture may support:

```text
MotionWorld ─┐
             ├─► shared experience
AudioWorld ──┘
```

through explicit contracts.

---

## Preserve separately

Keep the Framer MotionWorld implementation available as:

```text
legacy reference
```

or future reusable subsystem.

Do not rewrite it during AudioWorld development.

---

# 10. MotionShared

## Classification

```text
REFERENCE / REUSE SMALL PURE HELPERS
```

Existing helpers such as:

```text
clamp
smoothstep
expFollow
```

are generic and may be reused.

Existing motion token concepts may also be referenced:

```text
durations
curves
springs
role weights
```

Do not migrate the entire Framer motion token system merely because these
helpers exist.

Copy or reimplement only the small pure functions needed by the standalone
project.

---

# 11. SceneChoreography

## Classification

```text
DROP FOR MUSIC BOX CORE
```

SceneChoreography belongs to the previous page / Template experiment.

It contains assumptions around:

```text
Hero
Work
Process
About
Contact
```

and placeholder visual movement.

These assumptions do not belong to Z.land Music Box core architecture.

Do not migrate:

- section-specific transforms
- fixed page choreography
- template placeholder timing

The Story Map now defines Music Box experience progression.

---

# 12. ZLandSceneConfig

## Classification

```text
DROP FOR MUSIC BOX CORE
```

Legacy mappings such as:

```text
RollerCoaster → Hero
FerrisWheel → Work
Balloons → Process
DropTower → About
BumperCars → Contact
```

belong to the old Template concept.

They are obsolete for Music Box.

Do not use them to infer actor responsibility.

Current musical responsibilities are defined in:

```text
ride-map.md
```

---

# 13. ZLandLegacyAdapter

## Classification

```text
DROP FOR STANDALONE CORE
```

The Legacy Adapter exists to bridge earlier Framer systems and placeholder
consumers.

Do not migrate:

- reserved consumers
- section placeholder replacement
- deprecated physics contract aliases
- Template-era ride/section mapping

Its existence is useful historical context only.

---

# 14. SceneActor

## Classification

```text
REFERENCE ONLY
```

SceneActor demonstrated an important lifecycle pattern:

```text
visible
+
eligible
↓
actor may run
```

Useful concepts include:

- IntersectionObserver
- lifecycle eligibility
- reduced work while offscreen
- actor-local autonomy
- director does not own actor simulation

These ideas may inform future runtime optimization.

Do not migrate the Framer component itself.

---

# 15. Carousel

## Classification

```text
EXTRACT / HIGH-VALUE ASSET
```

Carousel is the first Music Box vertical actor.

It should be migrated before other rides.

Existing useful mechanics include:

```text
pose()
orbital distribution
projection
angle
velocity
inertia
drag interaction
target selection
selected item easing
front / back ordering
```

These should be preserved where validated.

---

## Critical redesign boundary

Existing Carousel decorative bob / internal clock must not remain the musical
timing source.

Current concept:

```text
internal decorative clock
↓
bob
```

Music Box target:

```text
AudioWorld melody
↓
note expression
```

Do not remove useful orbital mechanics merely because note behavior changes.

---

## Migration target

Conceptually separate:

```text
CarouselSimulation
```

from:

```text
CarouselRenderer
```

and:

```text
CarouselAudioAdapter
```

Potential separation:

```text
rides/
└── carousel/
    ├── types.ts
    ├── simulation.ts
    ├── audioAdapter.ts
    └── renderer.tsx
```

Exact file layout is not locked.

---

## First milestone rule

Do NOT redesign Carousel appearance during milestone 1.

First prove:

```text
Authored AudioMap
→ AudioClock
→ AudioWorld
→ Carousel melody response
```

with minimal presentation changes.

---

# 16. FerrisWheel

## Classification

```text
EXTRACT / REFERENCE CURRENT SIMULATION
```

Existing FerrisWheel contains useful physical mechanics including:

```text
rotation
angular velocity
acceleration
suspended cabin behavior
cabin spring / swing
```

Preserve the characteristic mechanical property:

```text
wheel rotates
while
cabins remain gravity-oriented
```

This is important for its harmony role.

---

## Do not confuse with Carousel

FerrisWheel is not the Melody Carousel.

Do not merge implementations merely because both contain circular movement.

Carousel:

```text
melody / pitch / rider expression
```

FerrisWheel:

```text
harmony / sustained relationship / suspended cabins
```

Shared math may later be extracted only if real duplication appears.

---

# 17. DropTower

## Classification

```text
EXTRACT / HIGH-VALUE SIMULATION
```

Existing DropTower state machine is valuable.

Preserve concepts like:

```text
IDLE
LIFTING
HOLDING
DROPPING
REBOUND
SETTLED / SETTLING
```

and its existing time-step simulation.

---

## Preserve

Preserve:

- lift behavior
- hold behavior
- gravity-driven drop
- braking
- rebound / recovery
- bounded dt
- actor-local simulation ownership

Do not replace the state machine with CSS keyframes or direct timeline
scrubbing.

---

## Audio integration comes later

Future AudioWorld mapping:

```text
build
→ lifting

tension
→ hold

drop event
→ release
```

This integration occurs only after Carousel milestone verifies AudioWorld.

---

# 18. BumperCars / BumperCarsFooter

## Classification

```text
EXTRACT / HIGH-VALUE PHYSICS
```

Existing BumperCars work contains valuable body simulation:

```text
position
velocity
rotation
angularVelocity
collision bounds
body/body collision
wall collision
restitution
damping
speed limiting
wander
```

Preserve the actual collision system.

---

## Remove product-specific assumptions

The old implementation may be designed as Footer navigation.

Do not preserve:

```text
Footer-only layout assumptions
```

as simulation architecture.

Separate:

```text
BumperCars simulation
```

from:

```text
navigation renderer / footer use case
```

The Music Box version uses BumperCars as percussion-driven physical bodies.

---

# 19. Balloons

## Classification

```text
REFERENCE / REBUILD
```

The existing Balloons implementation is useful as lifecycle reference but does
not yet represent the desired Free Body architecture.

Current behavior relies heavily on:

```text
sin(time)
→ target position
→ spring follow
```

This is not sufficient for final Music Box Free Bodies.

---

## Preserve concepts

Useful:

- actor-local RAF
- spring-like motion
- hidden-tab lifecycle
- reduced-motion handling
- `invalidatePhysics()`
- multiple lightweight bodies

---

## Rebuild target

Future Free Body should own real:

```text
position
velocity
mass
drag
forces
collision
exclusion response
```

and respond to:

```text
AudioWorld atmosphere
+
PhysicsWorld forces
```

Do not retain the literal balloon visual as a requirement.

Possible representations:

```text
Orb
light body
particle body
soft object
abstract floating material
```

---

# 20. Framer Code Component wrappers

## Classification

```text
DROP FROM STANDALONE CORE
```

Do not migrate into core:

```text
addPropertyControls
ControlType
useIsStaticRenderer
RenderTarget
Override
ComponentInstance
Framer Canvas guards
Framer intrinsic sizing annotations
```

These may later reappear inside a dedicated Framer adapter package if Z.land
returns to Framer.

They do not belong to Music Box core.

---

# 21. Existing static / reduced-motion lessons

## Classification

```text
KEEP AS ENGINEERING PRINCIPLE
```

Although Framer-specific implementation is not migrated, preserve the lessons:

- continuous animation must have stable reduced-motion behavior
- hidden documents should not waste simulation work
- render/export contexts must not leak live simulation
- simulation cleanup must be explicit
- static presentation should remain meaningful

The standalone project must implement equivalent lifecycle behavior using its
own runtime environment.

---

# 22. Existing renderer techniques

## Classification

```text
REFERENCE
```

Existing renderers include useful techniques:

- SVG imperative transforms
- pre-mounted SVG nodes
- route-based trail sampling
- projection
- painter ordering
- DOM transform response layers
- visual culling

Reuse individual techniques when appropriate.

Do not preserve a renderer technology merely because an older component used
it.

The new project may use:

```text
DOM
SVG
Canvas
Three.js
WebGL
Shader
```

per actor.

Renderer choice must remain independent from simulation truth.

---

# 23. Existing Framer assets as test references

Before deleting or archiving old work, preserve enough evidence to compare
behavior.

Useful references may include:

- source snapshots
- screen recordings
- screenshots
- known parameter defaults
- behavior notes
- regression reports
- test fixtures

Especially preserve validated behavior for:

```text
RollerCoaster
Carousel
DropTower
FerrisWheel
BumperCars
PhysicsWorld
```

Do not rely on memory alone during migration.

---

# 24. Migration priority

Current migration priority is NOT:

```text
move everything into the new repo
```

It is:

```text
1. Create standalone project skeleton
2. Implement AudioClock
3. Implement authored AudioMap fixture
4. Implement AudioWorld
5. Extract Carousel core
6. Connect Carousel to AudioWorld
7. Verify play / pause / seek / restart
8. Add DebugConsole
9. Only then choose second actor
```

PhysicsWorld may be migrated early if needed for project architecture, but
milestone 1 does not require Full Park physics.

---

# 25. Keep / Extract / Reference / Rebuild / Drop summary

## KEEP / EXTRACT

```text
PhysicsWorld core
NEW segmented RollerCoaster simulation
Carousel orbital / inertia simulation
DropTower state machine / physics
BumperCars collision simulation
FerrisWheel rotation / cabin simulation
small pure math helpers
```

---

## REFERENCE

```text
MotionWorldCore
MotionShared token ideas
PhysicsParticipant pattern
PhysicsSource adapter ideas
SceneActor lifecycle ideas
existing renderer techniques
OLD RollerCoaster visual/history
Balloons lifecycle
Framer static-renderer lessons
```

---

## REBUILD

```text
Free Bodies / Orb actor
AudioWorld
AudioClock
AudioMap runtime
Audio analysis pipeline
ControlSurface
DebugConsole
PirateShip if no validated implementation exists
material response system when required
standalone spatial adapters
```

---

## DROP FROM STANDALONE CORE

```text
ZLandSceneConfig
ZLandLegacyAdapter
SceneChoreography
Template section mappings
reserved placeholder consumers
Framer Property Controls
RenderTarget-specific wrappers
old Template visual scaffolding
OLD RollerCoaster as architecture baseline
```

---

# 26. Legacy migration invariant

Existing code is valuable when it contains validated behavior.

Existing code is not sacred merely because it already exists.

For every legacy system ask:

```text
Does this contain validated physical / musical / mathematical behavior?
```

If yes:

```text
preserve and extract
```

If it contains only:

```text
old product assumptions
old Framer packaging
old section choreography
temporary scaffolding
```

then:

```text
reference or discard
```

Never allow migration convenience to redefine the new architecture.

The new project's source of truth is:

```text
AGENTS.md
architecture.md
story-map.md
ride-map.md
legacy-reuse.md
```

Legacy source is implementation evidence, not architectural authority.