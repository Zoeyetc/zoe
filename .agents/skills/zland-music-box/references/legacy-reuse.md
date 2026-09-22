# Z.land Music Box — Legacy Reuse Map v0.2

## 1. Purpose

This document defines how previous Z.land / Framer implementations may be used
inside the current standalone Z.land Music Box project.

The project is no longer in the initial migration-planning stage.

Several legacy systems have already been extracted, adapted, tested, and
integrated into standalone architecture.

Therefore the central rule is now:

> Validated standalone implementation is authoritative.
>
> Legacy code is implementation evidence, not current architectural authority.

Legacy source may still contain useful:

- geometry
- simulation behavior
- algorithms
- constants
- rendering techniques
- historical experiments

But it must not silently overwrite current standalone contracts.

---

## 2. Classification system

Legacy assets are classified as:

```text
CANONICAL STANDALONE
KEEP / EXTEND
LEGACY SOURCE
REFERENCE ONLY
REBUILD
DROP
```

### CANONICAL STANDALONE

The behavior has already been extracted into the current repository and
validated through current tests / integration.

Use the standalone implementation as the source of truth.

Do not re-import older legacy behavior unless a concrete regression or missing
feature requires comparison.

---

### KEEP / EXTEND

The current implementation is valid and should be extended without replacing
its established architecture.

---

### LEGACY SOURCE

The old implementation contains validated behavior that was or may still be
useful for extraction.

Inspect it when a current milestone needs functionality that has not yet been
ported.

Do not copy the whole component blindly.

---

### REFERENCE ONLY

Contains useful historical ideas, visuals, parameters, or techniques.

Do not use as a current implementation baseline.

---

### REBUILD

The conceptual role remains valid, but the legacy implementation does not
satisfy current architecture.

Build again using current contracts.

---

### DROP

Do not use as current core architecture.

The implementation belongs to an obsolete product assumption, old Framer
packaging, deprecated template architecture, or superseded experiment.

---

## 3. Authority order

When implementation sources disagree, use this order:

```text
AGENTS.md
↓
SKILL.md
↓
architecture.md
↓
story-map.md
↓
ride-map.md
↓
current standalone implementation
↓
current tests
↓
legacy-reuse.md
↓
legacy source
```

Legacy source must never override current repository architecture merely because
it contains more code or older features.

If current standalone behavior and legacy behavior conflict:

1. determine whether current behavior is intentionally different;
2. inspect current tests and architecture;
3. preserve current validated behavior unless a real regression is proven;
4. port only the missing legacy capability required by the current milestone.

---

## 4. Migration principle

For any legacy feature that has not yet been ported:

```text
inspect
↓
identify validated behavior
↓
separate pure simulation / geometry
↓
compare with current standalone contracts
↓
extract only required behavior
↓
establish parity where intended
↓
integrate
```

Prefer:

```text
extract first
integrate second
redesign third
```

Do not simultaneously:

- migrate
- redesign
- change musical mapping
- change renderer technology
- change PhysicsWorld behavior

unless the current milestone explicitly requires all of them.

---

# 5. Current standalone canonical systems

The following systems are already standalone and validated.

They are no longer "pending legacy migration."

```text
AudioClock
AudioMap runtime fixtures
AudioWorld
Carousel
FerrisWheel
PirateShip
BumperCars
DropTower
RollerCoaster
PhysicsWorld
AnchoredReceiver
AnchoredContentParticipant
DOM spatial adapter
PhysicsDebugOverlay
ControlSurface development shell
DebugConsole
```

These current implementations are canonical.

Legacy versions may be consulted only for missing behavior or regression
comparison.

---

# 6. Carousel

## Current classification

```text
CANONICAL STANDALONE
```

Current standalone Carousel already validates:

- actor-local base rotation
- angular velocity / inertia
- mechanical central structure
- media-neutral carriers
- carrier-local note expression
- note-on / note-off handling
- pitch-based bounded expression
- seek
- pause / settling
- restart
- reduced motion
- exact melody-note evidence

The standalone version is authoritative.

---

## Legacy value

The older Carousel implementation remains useful only for reference to:

- orbital projection
- angle / velocity behavior
- targeting
- drag interaction
- front/back ordering
- original layout experiments

Any behavior already represented in the standalone version should not be
re-imported.

---

## Do not restore

Do not restore:

- independent decorative bob clock as musical timing
- Framer Property Controls
- Framer-specific renderer assumptions
- animal / horse rider forms
- traditional fairground rider semantics
- direct note-driven whole-wheel targeting

Current musical-evidence rule remains:

```text
specific melody note
→ exact local carrier evidence
```

---

# 7. FerrisWheel

## Current classification

```text
CANONICAL STANDALONE
```

Current standalone FerrisWheel already validates:

- wheel angle
- wheel angular velocity
- bounded acceleration
- suspended cabin simulation
- gravity-oriented cabins
- cabin spring / damping
- exact chord-tone carrier activation
- 12 pitch-class carriers
- chord-change synchronization
- pause / inertia
- seek
- restart
- reduced motion
- harmony domain isolation

The standalone version is authoritative.

---

## Legacy value

Legacy FerrisWheel may still be consulted for:

- earlier rotational tuning
- cabin-swing constants
- mechanical proportions
- rendering experiments

Do not replace current harmonic-carrier semantics with older generic wheel
behavior.

---

## Do not merge with Carousel

FerrisWheel and Carousel remain distinct.

```text
Carousel
→ melody / sequential note evidence

FerrisWheel
→ harmony / simultaneous chord-tone evidence
```

Do not create a generic CircularRide abstraction unless real code duplication
justifies a small pure helper.

Never merge musical responsibilities merely because both use circular motion.

---

# 8. PirateShip

## Current classification

```text
CANONICAL STANDALONE
```

Current standalone PirateShip already validates:

- actor-local pendulum state
- angle
- angular velocity
- gravitational restoring force
- damping
- bounded drive torque
- target phase
- phase error
- groove interpretation
- swing phase warp
- pause / physical settling
- seek reconciliation
- restart
- reduced motion
- domain isolation from percussion

The standalone version is authoritative.

---

## Legacy source used

Legacy PirateShip contributed:

- pendulum structure
- `-gravity × sin(angle)` restoring term
- angular damping
- bounded substeps
- angle safety limits

Those mechanics have already been extracted.

Do not re-import:

- Framer controls
- DOM refs
- hover/focus drive
- old text passengers
- old automatic drive behavior

unless a future milestone explicitly requires an equivalent concept.

---

# 9. BumperCars / BumperCarsFooter

## Current classification

```text
CANONICAL STANDALONE
```

Current standalone BumperCars validates:

- multiple bodies
- position
- velocity
- heading / rotation
- angular velocity
- AABB overlap correction
- multi-pass collision solving
- body/body collision
- wall collision
- restitution
- damping
- speed limiting
- deterministic seed
- kick / snare / hat event interpretation
- pause
- seek
- restart
- reduced motion
- real collision → PhysicsWorld impact

The standalone version is authoritative.

---

## Legacy source used

Legacy BumperCarsFooter contributed:

- collision response
- overlap correction
- wall bounce
- restitution
- rotational impulse
- damping
- speed limiting

Those behaviors have already been extracted.

---

## Do not restore

Do not restore as simulation architecture:

- Footer-only layout assumptions
- navigation-link ownership
- footer-specific positioning
- DOM measurement as physics truth
- mouse curiosity / steering unless a future milestone explicitly requires it
- automatic wander merely because it existed previously

Current Music Box responsibility is:

```text
percussion
→ actor-local impulse
→ real collision
→ shared physical consequence
```

---

# 10. DropTower

## Current classification

```text
CANONICAL STANDALONE
```

Current standalone DropTower validates:

```text
IDLE
LIFTING
HOLDING
DROPPING
REBOUND
SETTLING
```

and:

- normalized position
- bounded substeps
- lift drive
- gravity-driven drop
- braking
- rebound
- damping
- explicit `drop` event
- build / tension interpretation
- state-aware pause
- seek reconciliation
- deterministic restart
- reduced motion

The standalone version is authoritative.

---

## Legacy source used

Legacy DropTower contributed:

- state separation
- lift mechanics
- hold
- gravity drop
- braking
- rebound
- bounded dt

Those mechanics have already been extracted.

---

## Do not restore

Do not restore:

- automatic timer-based release as musical truth
- direct timeline keyframes
- AudioWorld-driven vertical position
- old Framer wrappers
- old PhysicsWorld coupling

Future shared DropTower impact must be implemented through a dedicated current
milestone, not by restoring legacy integration.

---

# 11. RollerCoaster — canonical standalone

## Current classification

```text
CANONICAL STANDALONE
```

Current standalone RollerCoaster already validates:

- extracted segmented geometry
- `Vec3`
- `TrackFrame`
- sampled XYZ geometry
- minimal-rotation up-frame transport
- rigid segment placement
- open route composition
- `RoutePiece`
- `HiddenConnector`
- persistent `routeDistance`
- velocity
- acceleration
- gravity
- drag
- drive
- braking
- bounded substeps
- renderer / simulation separation
- actor-local phrase interpretation
- pause
- seek
- restart
- reduced motion
- neutral Orb rider boundary

Current route subset:

```text
Station
→ Lift
→ Drop
→ Loop
→ Runout
→ Station
```

This standalone implementation is authoritative.

---

# 12. Canonical legacy RollerCoaster source

## Classification

```text
LEGACY SOURCE / HISTORICAL EXTRACTION SOURCE
```

Canonical extraction source:

```text
2026-09-11/files-pasted-by-the-user-project/outputs/RollerCoaster.tsx
```

This source originally provided the segmented architecture.

Its relevant behavior has already been extracted into standalone modules.

Do not re-copy the legacy component over the standalone implementation.

---

## Legacy concepts already extracted

Examples:

```text
Vec3
TrackFrame
SegmentGeometry
Route
RoutePiece
HiddenConnector
routeDistance
segment-specific physics
gravity
drag
drive
braking
world-space XYZ sampling
```

Consult the legacy file only when investigating:

- missing route geometry
- previously validated segment behavior
- numerical regression
- additional unported segment

---

# 13. Old closed-circuit RollerCoaster

## Classification

```text
REFERENCE ONLY
```

Historical baseline:

```text
RollerCoaster.baseline.tsx
```

It may contain reference material for:

- Hermite interpolation
- early typography presentation
- old track aesthetics
- SVG techniques
- historical velocity experiments

It is not current architecture.

---

## Never restore as baseline

Do not restore:

- modulo route wrapping
- closed-loop architecture
- viewport-relative route physics
- old whole-word rigid train assumptions
- old route ownership

If a visual technique is useful, port it onto the current segmented
standalone architecture.

---

# 14. RollerCoaster rider/media architecture

## Current classification

```text
KEEP / EXTEND
```

The current separation is:

```text
route simulation
≠
rider media
```

Current development rider:

```text
neutral Orb
```

Future media may include:

- Text
- Title
- Slogan
- Image
- Logo
- Icon
- 3D Object
- Shader
- Custom Media

Media changes must not reset:

- routeDistance
- velocity
- direction
- segment state
- simulation continuity

Do not implement future rider types merely because legacy work suggested them.

Add them only when a milestone requires them.

---

# 15. PhysicsWorld

## Current classification

```text
CANONICAL STANDALONE / KEEP / EXTEND
```

PhysicsWorld is no longer merely a legacy system awaiting extraction.

Current standalone PhysicsWorld already validates shared causality.

Established concepts include:

- shared physical effects
- force / impact sources
- Physics Receivers
- spatial registration
- canonical world coordinates
- transient impact handling
- receiver wake / settle
- debug observability

Validated chain:

```text
BumperCars real collision
→ PhysicsWorld impact
→ Anchored Content Participant
```

Current standalone implementation is authoritative.

---

## Legacy PhysicsWorld value

Legacy PhysicsWorld originally contained useful concepts such as:

```text
registerPhysicsSource()
getPhysicsSource()
invalidatePhysics()
attachPhysicsReceiver()
registerPhysicsCollider()
samplePhysicsColliders()
```

Use old implementation only when a current milestone needs an unported feature.

Do not restore legacy API naming or React ownership merely because it existed.

---

## Next extension

The next intended shared source is:

```text
RollerCoaster actual motion
→ directional wake
```

This must extend current standalone PhysicsWorld.

Do not replace PhysicsWorld with the old Framer implementation.

---

# 16. PhysicsParticipant

## Current classification

```text
REFERENCE ONLY
```

Legacy PhysicsParticipant demonstrated the useful conceptual pattern:

```text
authored layout
+
physics response
```

That concept has now been implemented in standalone form through:

```text
AnchoredReceiver
AnchoredContentParticipant
DOM spatial adapter
```

Therefore the legacy component itself should not be migrated.

---

## Do not restore

Do not restore:

- Framer ComponentInstance
- Property Controls
- Framer wrapper hierarchy
- Framer-specific DOM ownership

The standalone anchored-content system is now authoritative.

---

# 17. AnchoredReceiver

## Current classification

```text
CANONICAL STANDALONE / KEEP / EXTEND
```

Current AnchoredReceiver already validates:

- impulse response
- translation
- rotation
- bounded displacement
- bounded rotation
- spring recovery
- damping
- settle state
- reduced-motion response

Use this core for anchored receiver behavior.

Do not create actor-specific duplicate spring systems without a real material
requirement.

---

# 18. AnchoredContentParticipant

## Current classification

```text
CANONICAL STANDALONE / KEEP / EXTEND
```

Current standalone content-participant model validates:

```text
authored/current layout
+
temporary PhysicsWorld response
=
rendered content
```

The outer layout remains authoritative.

The inner response layer applies:

- translation
- rotation

Layout changes do not become false physical velocity.

Recovery returns response offset to zero relative to the current layout anchor.

This is now an established architecture contract.

---

# 19. DOM spatial adapter

## Current classification

```text
CANONICAL STANDALONE / KEEP / EXTEND
```

Current DOM adapter already validates explicit conversion between:

```text
DOM bounds
→ canonical PhysicsWorld coordinates
```

Measurement occurs through bounded lifecycle triggers such as:

- mount
- ResizeObserver
- window resize
- explicit layout invalidation

Do not reintroduce per-frame DOM measurement as the default.

Do not infer physical velocity from responsive relayout.

---

# 20. PhysicsSource legacy adapter

## Current classification

```text
REFERENCE ONLY
```

Legacy PhysicsSource contained useful lessons:

- explicit source ID
- source radius
- contact radius
- velocity sampling
- host-motion subtraction
- visibility lifecycle

The most important preserved principle is:

> Camera, viewport, or layout movement must not become fictitious physical
> velocity.

Current standalone sources should use simulation truth when available.

Example:

```text
RollerCoaster
→ use route simulation velocity
```

not:

```text
measure moving SVG DOMRect
→ estimate velocity
```

---

# 21. PhysicsReceiverOverrides

## Classification

```text
DROP AS CURRENT ARCHITECTURE
REFERENCE ONLY
```

Legacy overrides such as:

```text
withCoasterReceiver
withPhysicsText
withPhysicsCard
withPhysicsNavigation
```

must not return as standalone architecture.

Useful historical lesson:

different content types may eventually require different response materials.

Future material behavior should be added only when a current milestone requires
it.

Do not create a general Material Response System prematurely.

---

# 22. PhysicsDebugOverlay

## Current classification

```text
CANONICAL DEVELOPMENT TOOL
```

Current debug overlay is part of standalone development infrastructure.

It may expose:

- impact position
- radius
- normal
- force path
- receiver position
- received impulse
- displacement
- future wake geometry

It must visualize actual PhysicsWorld state.

It must not draw fake markers based directly on musical events.

Preserve:

```text
?hide-physics-debug
```

or equivalent debug visibility control unless intentionally redesigned.

---

# 23. MotionWorldCore

## Classification

```text
REFERENCE / OPTIONAL FUTURE SIBLING SYSTEM
```

MotionWorld solves:

- scroll choreography
- page section progress
- page-level ownership
- viewport motion hierarchy

It is not AudioWorld.

It is not required by the current Music Box runtime.

---

## Current rule

Do not insert MotionWorld into:

```text
AudioWorld
→ Actor
```

The current vertical development page does not imply that song progression
should be scroll-driven.

Future Park Map / Spatial Score may use camera or spatial navigation, but this
must remain separate from musical time.

---

# 24. MotionShared

## Classification

```text
REFERENCE / SMALL PURE HELPERS ONLY
```

Small functions such as:

```text
clamp
smoothstep
expFollow
```

may be reused if needed.

Do not import the entire legacy motion-token system merely because a helper is
useful.

Prefer small local pure utilities.

---

# 25. SceneChoreography

## Classification

```text
DROP
```

SceneChoreography belongs to the old page-template experiment.

Legacy assumptions such as:

```text
Hero
Work
Process
About
Contact
```

do not belong to Music Box.

Do not restore:

- section-specific movement
- template placeholder timing
- page choreography as musical structure

The current Story Map defines experience progression.

---

# 26. ZLandSceneConfig

## Classification

```text
DROP
```

Old mappings such as:

```text
RollerCoaster → Hero
FerrisWheel → Work
Balloons → Process
DropTower → About
BumperCars → Contact
```

are obsolete.

Do not use them to infer:

- actor role
- Park Map position
- musical responsibility

Current responsibilities come from:

```text
ride-map.md
```

---

# 27. ZLandLegacyAdapter

## Classification

```text
DROP
```

Do not migrate:

- placeholder consumer bridges
- deprecated physics aliases
- old Template mappings
- old section consumers

It is historical scaffolding only.

---

# 28. SceneActor

## Classification

```text
REFERENCE ONLY
```

Useful lifecycle ideas include:

```text
visible
+
eligible
→ actor may run
```

and:

- IntersectionObserver
- offscreen suspension
- actor autonomy
- reduced work
- director not owning actor simulation

These ideas may inform future performance optimization.

Do not migrate the Framer component itself.

---

# 29. Balloons legacy

## Classification

```text
REFERENCE / DO NOT MIGRATE AS FINAL FREE BODY
```

Legacy Balloons used behavior approximately like:

```text
sin(time)
→ target
→ spring follow
```

That is insufficient for current Free Body requirements.

---

## Useful legacy lessons

Keep only reference value such as:

- lightweight actor-local update
- spring-like movement
- hidden-tab lifecycle
- reduced-motion handling
- multiple objects
- physics invalidation ideas

---

## Future Free Body target

Milestone 7A should build Free Bodies using current standalone architecture.

Expected state may include:

```text
position
velocity
mass
drag
forces
turbulence
collision
exclusion response
```

Inputs should include:

```text
AudioWorld atmosphere
+
PhysicsWorld forces
```

Do not copy the legacy sine-target implementation as final behavior.

---

# 30. Free Bodies visual identity

## Classification

```text
NOT LOCKED
```

"Balloon" is historical terminology.

The final object may be:

- Orb
- light body
- particle-like body
- soft abstract object
- another media-neutral form

Do not force literal balloon visuals.

Use:

```text
Free Bodies / Orb
```

as the current conceptual name unless a future design decision replaces it.

---

# 31. Framer Code Component wrappers

## Classification

```text
DROP FROM STANDALONE CORE
```

Do not migrate into current core:

```text
addPropertyControls
ControlType
useIsStaticRenderer
RenderTarget
Override
ComponentInstance
Framer Canvas guards
Framer intrinsic-size annotations
```

Equivalent lifecycle behavior may be reimplemented when genuinely needed.

Do not keep Framer imports merely for historical compatibility.

---

# 32. Static / reduced-motion lessons

## Classification

```text
KEEP AS ENGINEERING PRINCIPLE
```

Preserve lessons learned from Framer Marketplace work:

- continuous animation needs stable reduced-motion behavior
- hidden documents should not waste simulation work
- cleanup must be explicit
- static presentation should remain meaningful
- simulation must not leak into inappropriate render contexts

Implementation must use current standalone environment, not old Framer APIs.

---

# 33. Existing renderer techniques

## Classification

```text
REFERENCE
```

Legacy renderer techniques may include:

- imperative SVG transforms
- pre-mounted nodes
- route sampling
- trail sampling
- projection
- painter ordering
- visual culling
- DOM response layers

Reuse only when they improve current implementation.

Do not preserve a renderer technology because a legacy component used it.

Simulation truth remains renderer-independent.

---

# 34. Musical evidence overrides legacy visuals

This is a new critical rule.

Legacy visuals were often created before the current "spatial score / precise
musical evidence" direction was fully defined.

Therefore:

> Legacy visual behavior must never override current musical-evidence rules.

Examples:

If a legacy Carousel randomly emphasized riders:

```text
do not restore it
```

if it conflicts with exact melody-note evidence.

If a legacy FerrisWheel illuminated cabins decoratively:

```text
do not restore it
```

if it conflicts with exact chord-tone membership.

If a legacy ride used amplitude-based glow:

```text
treat it as optional presentation only
```

not musical truth.

Current musical semantics take priority.

---

# 35. Experience composition overrides legacy template layout

Legacy Template layouts are not current experience authority.

The old project assumed:

```text
vertical sections
ride per section
scroll choreography
```

The current direction is:

```text
persistent shared park
+
simultaneously visible musical actors
+
Spatial Score
```

Therefore do not reuse old template page layout as the final Park Map merely
because it already exists.

The current vertical standalone page is also temporary development UI.

Final Experience Composition will be designed later.

---

# 36. Legacy park / amusement visuals

## Classification

```text
REFERENCE ONLY
```

Avoid automatically importing traditional amusement-park styling from old
experiments.

Current visual direction should remain compatible with:

- abstract
- mechanical
- diagrammatic
- computational
- media-neutral
- monochrome / restrained color

Do not reintroduce:

- horse riders
- mascots
- cartoon visitors
- decorative pirate motifs
- nostalgic fairground illustration

unless the user explicitly decides otherwise.

Mechanical identity is valuable.

Theme-park decoration is not automatically valuable.

---

# 37. Current visual carriers

Current validated visual semantics include:

### Carousel

```text
media-neutral mechanical carriers
```

not horses.

### FerrisWheel

```text
abstract cabins / harmonic carriers
```

### PirateShip

```text
abstract mechanical suspended body
```

### RollerCoaster

```text
neutral Orb rider
```

Do not replace these with themed characters without explicit design direction.

---

# 38. Current musical mappings are authoritative

Current validated responsibility map:

```text
Carousel
→ melody / exact note evidence

FerrisWheel
→ harmony / exact chord-tone membership

PirateShip
→ groove / swing

BumperCars
→ percussion

DropTower
→ build / tension / explicit drop

RollerCoaster
→ phrase / energy / tension / release

Free Bodies
→ future texture / atmosphere + PhysicsWorld forces
```

Legacy code must not change these responsibilities.

---

# 39. Current project state

Current standalone implementation has objectively validated:

```text
Carousel
FerrisWheel
PirateShip
BumperCars
DropTower
RollerCoaster
```

AudioWorld now supports authored development evidence for:

```text
melody
harmony
rhythm
percussion
structure
phrase
```

Shared-world architecture has validated:

```text
BumperCars real collision
→ PhysicsWorld
→ Anchored Content
```

and:

```text
normal layout
+
temporary physical response
```

Do not describe these as pending migrations.

---

# 40. Current near-term legacy relevance

## Milestone 6B — RollerCoaster wake

Legacy RollerCoaster PhysicsSource ideas may be consulted for:

- moving source registration
- source radius
- velocity / forward concepts
- lifecycle

But implement the wake using:

```text
current standalone RollerCoaster simulation
+
current standalone PhysicsWorld
```

Do not restore the legacy PhysicsSource wrapper.

---

## Milestone 7A — Free Bodies

Legacy Balloons may be consulted only for:

- lightweight lifecycle
- earlier visual experimentation

Do not use its sine-target movement as the new simulation baseline.

Build Free Bodies against:

```text
current AudioWorld
+
current PhysicsWorld
```

---

## Experience Composition phase

Do not use old Template scene structure as final map layout.

Future Park Map / Spatial Score should be designed from current actors and
current shared-world spatial relationships.

---

# 41. Migration checklist for any remaining legacy feature

Before using legacy code, answer:

1. Is this capability already implemented in standalone form?
2. If yes, why is legacy code being consulted?
3. Is the legacy behavior actually validated?
4. Is it simulation, geometry, renderer, UI, or packaging?
5. Does it conflict with current Musical Evidence rules?
6. Does it conflict with current actor responsibility?
7. Does it conflict with current PhysicsWorld ownership?
8. Does it assume Framer layout / scroll / canvas?
9. Can the useful part be extracted as a small pure function?
10. Is the capability required by the current milestone?

If the current standalone system already solves the problem, do not migrate the
legacy version.

---

# 42. Regression rule

Legacy parity is not automatically desirable.

There are now three cases.

### Case A — Intended preserved behavior

Example:

```text
DropTower gravity / rebound
```

If standalone behavior regresses, compare against legacy implementation.

---

### Case B — Intentionally replaced behavior

Example:

```text
Carousel decorative bob
→ replaced by real melody-note expression
```

Do NOT restore legacy parity.

---

### Case C — Obsolete product behavior

Example:

```text
BumperCarsFooter navigation product
```

Do not treat missing behavior as regression.

Always classify the behavior before attempting parity.

---

# 43. Source preservation

Preserve enough legacy evidence for regression investigation.

Useful artifacts include:

- source snapshots
- screen recordings
- screenshots
- parameter defaults
- known good behavior notes
- old test fixtures
- bug reports

Especially preserve historical evidence for:

```text
RollerCoaster
Carousel
FerrisWheel
DropTower
BumperCars
PirateShip
PhysicsWorld
```

But do not keep old code in active runtime merely for archival purposes.

---

# 44. Current implementation is not disposable prototype code

The standalone repository has now accumulated validated architecture.

Do not treat current files as temporary throwaway implementations just because
the final UI is unfinished.

The following layers are already meaningful long-term architecture:

```text
AudioClock
AudioWorld
actor-local simulation
PhysicsWorld
spatial adapters
Anchored Content
musical evidence mapping
```

Final Experience Composition may change drastically without replacing these
layers.

---

# 45. Final Park Map must use current systems

When Park Map / Spatial Score work begins, do not rebuild actor behavior inside
the map component.

The map should compose existing systems.

Correct:

```text
existing Carousel
existing FerrisWheel
existing PirateShip
existing BumperCars
existing DropTower
existing RollerCoaster
existing PhysicsWorld
future Free Bodies
↓
Experience Composition
```

Wrong:

```text
ParkMap.tsx
→ reimplements simplified fake versions of every ride
```

The Park Map is composition.

It is not a replacement simulation layer.

---

# 46. Keep / Reference / Rebuild / Drop summary

## CANONICAL STANDALONE

```text
AudioClock
AudioMap runtime
AudioWorld

Carousel
FerrisWheel
PirateShip
BumperCars
DropTower
RollerCoaster

PhysicsWorld
AnchoredReceiver
AnchoredContentParticipant
DOM spatial adapter
PhysicsDebugOverlay

ControlSurface development boundary
DebugConsole
```

---

## LEGACY SOURCE / CONSULT ONLY WHEN REQUIRED

```text
canonical segmented RollerCoaster legacy source
legacy DropTower
legacy BumperCarsFooter
legacy FerrisWheel
legacy PirateShip
legacy Carousel
legacy PhysicsWorld
legacy PhysicsSource
```

These are historical extraction sources, not current runtime authority.

---

## REFERENCE ONLY

```text
old closed-circuit RollerCoaster
MotionWorldCore
MotionShared ideas
PhysicsParticipant
SceneActor lifecycle
legacy renderer techniques
legacy Balloons
old visual experiments
```

---

## REBUILD / FUTURE CURRENT ARCHITECTURE

```text
Free Bodies / Orb
real Audio Analysis Pipeline
final ControlSurface
Gate / Ticket Booth presentation
Experience Composition
Park Map / Spatial Score
future Material Response System when required
future Three.js / 3D spatial adapters when required
```

---

## DROP

```text
ZLandSceneConfig
ZLandLegacyAdapter
SceneChoreography
old Template section mappings
reserved placeholder consumers
Framer Property Controls in standalone core
RenderTarget wrappers
old Hero / Work / Process / About / Contact ride mapping
legacy vertical Template architecture as final UX
old RollerCoaster closed-loop architecture
```

---

# 47. Legacy invariant

Ask:

> Is this legacy code teaching us something the current standalone system does
> not already know?

If no:

```text
do not migrate it
```

If yes:

```text
extract only the required validated behavior
```

Then ask:

> Does it preserve current Musical Evidence, Actor Interpretation, and
> PhysicsWorld ownership?

If no:

```text
adapt or reject it
```

The current project source of truth is:

```text
AGENTS.md
SKILL.md
architecture.md
story-map.md
ride-map.md
current standalone implementation
current tests
```

Legacy source is evidence.

It is not authority.