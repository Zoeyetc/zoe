# Z.land Music Box — Repository Instructions

## Project identity

Z.land is a shared computational physical world.

Z.land Music Box is an interactive music-driven amusement world in which
musical meaning drives autonomous physical actors, and those actors can
physically affect other actors and content through PhysicsWorld.

This is not a Framer template.

This is not a conventional audio visualizer.

This is not a collection of synchronized canned animations.

The current priority is correctness of architecture, causality, timing,
simulation, synchronization, and interaction.

Final UI and art direction are intentionally not locked yet.

---

## Core causal model

Preserve this chain:

```text
Music
→ Musical Meaning
→ Actor
→ Physics
→ World
```

The ownership model is:

```text
Analysis Pipeline
→ derives AudioMap

AudioClock
→ owns authoritative musical transport time

AudioWorld
→ owns current musical truth

Actor
→ owns interpretation and actor-local simulation

PhysicsWorld
→ owns shared physical causality

Renderer
→ displays resulting state

ControlSurface
→ requests audience-facing actions

DebugConsole
→ observes system truth
```

Never collapse these layers merely to simplify implementation.

---

## AudioClock

AudioClock owns authoritative musical transport time.

It is responsible for:

- play
- pause
- seek
- restart
- current musical time
- duration
- transport state

When real audio is used, musical time must ultimately derive from the Web Audio
transport clock.

`requestAnimationFrame` is a rendering opportunity, not the musical clock.

If rendering drops frames, musical time must remain authoritative.

---

## AudioWorld

AudioWorld consumes:

```text
AudioMap
+
AudioClock time
```

and exposes:

```text
AudioSnapshot
+
AudioEvents
```

AudioWorld owns:

- AudioMap lookup
- current continuous musical snapshot
- discrete musical event delivery
- synchronization semantics around transport changes

AudioWorld does NOT own:

- authoritative transport time
- ride geometry
- ride animation
- ride physics
- visual transforms
- collision behavior
- page layout
- camera movement

Individual rides must not independently analyze the same raw audio source.

Given the same AudioMap and musical time, AudioWorld should derive the same
continuous musical snapshot where practical.

---

## AudioMap and analysis boundary

Keep analysis and runtime separate.

```text
Audio Source
→ Analysis Pipeline
→ AudioMap
──────── runtime boundary ────────
→ AudioWorld
```

AudioMap may initially come from:

- authored test data
- deterministic fixtures
- MIDI
- prepared JSON

Future analysis may come from:

- DSP
- beat / onset analysis
- melody extraction
- harmony analysis
- structural segmentation
- source separation
- ML transcription
- manual correction
- external tooling

Do not introduce heavy music-analysis infrastructure until a milestone requires
it.

Changing the analysis implementation must not require actors, PhysicsWorld, or
renderers to be rewritten.

---

## Partial musical understanding

Not every song is guaranteed to provide every musical domain.

AudioMap and AudioSnapshot must support incomplete analysis.

Examples:

```text
melody      available
rhythm      available
harmony     unavailable
structure   available
```

or:

```text
melody      unavailable
rhythm      available
energy      available
```

Do not fabricate confident musical meaning merely to activate every actor.

If a musical domain is unavailable:

- its actor may remain resting
- it may use a musically defensible fallback
- unrelated actors must continue functioning normally

A smaller valid performance is preferable to a false complete performance.

---

## AudioSnapshot and AudioEvents

Maintain a strict distinction between:

```text
continuous musical state
```

and:

```text
discrete timeline events
```

AudioSnapshot represents continuous musical truth at a specific transport time.

AudioEvents represent crossings such as:

- note-on
- note-off
- beat
- downbeat
- kick
- snare
- hat
- chord-change
- section-change
- drop
- seek

Discrete events must be emitted from timeline crossings rather than relying on
a render frame landing exactly on an event timestamp.

Do not represent short events only as transient booleans inside a render-frame
snapshot.

---

## Seek semantics

Seeking is synchronization, not playback.

Seeking must:

- move directly to the requested musical time
- recompute the current AudioSnapshot
- emit a seek transport event where appropriate
- synchronize actors
- reset event cursors to the new position
- NOT replay every historical musical event between the old and new positions

Skipped:

- beats
- notes
- kicks
- drops
- collisions

must not be replayed simply because seek crossed them.

---

## Pause semantics

Pausing musical transport does not automatically erase physical energy already
present in PhysicsWorld.

For example:

```text
kick
→ BumperCar receives impulse
→ pause
→ AudioClock stops
→ car may continue moving
→ damping settles it
```

Therefore:

```text
Audio pause ≠ Physics reset
```

Actor-specific pause behavior may differ where physically or musically
necessary.

---

## PhysicsWorld

PhysicsWorld owns shared physical causality.

Supported participation may include:

- Force Source
- Physics Receiver
- Collider / Exclusion Zone
- Dynamic Body

A participant may have multiple roles.

Text, Image, CMS content, Button, Navigation, Logo, particles, rides, 3D
objects, and other objects may participate when explicitly registered.

Cross-object physical effects must pass through PhysicsWorld.

Do not fake cross-object causality with duplicated animations.

Preferred:

```text
AudioWorld
→ Actor A
→ Actor A simulation
→ PhysicsWorld
→ Actor B response
```

Avoid:

```text
AudioWorld
→ Actor A animation

AudioWorld
→ separate hard-coded Actor B animation
```

---

## Spatial coordinate contract

PhysicsWorld requires an explicit canonical spatial contract.

Do not implicitly mix:

- viewport coordinates
- DOM layout coordinates
- SVG coordinates
- Canvas coordinates
- Three.js world coordinates
- camera-projected coordinates

without an adapter.

Prefer:

```text
Actor / Content Geometry
→ Spatial Adapter
→ PhysicsWorld Coordinates
→ Physics Interaction
→ Renderer Adapter
```

Camera, page scroll, or host-container motion must not automatically become
fictitious actor velocity.

Coordinate conversion must not be hidden inside unrelated actor logic.

---

## MotionWorld

MotionWorld owns scroll/page choreography when an experience uses scroll as an
input.

MotionWorld and AudioWorld are sibling input/director domains.

Do not make AudioWorld depend on MotionWorld.

The Music Box prototype may run without MotionWorld.

Do not migrate MotionWorld into milestone 1 merely because it already exists.

---

## Actor autonomy

Ride actors own their high-frequency simulation state.

AudioWorld may trigger or modulate an actor, but must not replace its simulation
with direct visual animation.

Current actor responsibilities:

- Carousel: melody / pitch / note expression
- FerrisWheel: harmony / sustained harmonic relationships
- PirateShip: groove / swing / oscillatory musical phase
- BumperCars: percussion / impulses / collisions
- DropTower: build / tension / major drop / impact
- RollerCoaster: phrase / energy trajectory / tension / release
- Free Bodies / Orb / Balloon: texture / atmosphere / spectral ambience /
  free-body response

These mappings are current design contracts.

Do not silently reassign them.

Do not make every actor react visibly to every beat.

---

## Experience hierarchy

Musical activity and visual dominance are different concepts.

An actor may be musically active while visually:

```text
Primary
Secondary
Ambient
Resting
```

Experience hierarchy may influence:

- camera attention
- framing
- lighting
- renderer detail
- visual emphasis
- opacity where appropriate

It must not silently rewrite actor physics merely to make the composition
cleaner.

---

## Simulation determinism

Emergent behavior must remain debuggable.

Where stochastic behavior is used:

- use explicit seeded randomness during development and tests
- expose the seed through DebugConsole when useful
- avoid uncontrolled random calls inside simulation hot paths
- preserve reproducibility for debugging

Given:

```text
same AudioMap
same initial world state
same simulation parameters
same seed
```

behavior should be reproducible enough to investigate.

Final artistic playback may later choose a different seed.

---

## Refactoring existing work

Existing validated simulations are assets.

When migrating an existing ride:

1. Locate the canonical implementation.
2. Identify pure geometry.
3. Identify pure simulation.
4. Identify actor-local state.
5. Identify renderer code.
6. Identify Framer-only code.
7. Extract behavior without redesigning it.
8. Verify behavioral parity.
9. Only then connect AudioWorld.
10. Only then change presentation if the current milestone requires it.

Never rewrite a working ride merely to make integration easier.

Do not mix legacy and current versions of the same ride.

The newer segmented RollerCoaster architecture is the canonical coaster
baseline.

The old closed-circuit RollerCoaster is reference-only.

Detailed migration classifications live in:

```text
references/legacy-reuse.md
```

---

## Renderer boundary

Renderers display simulation state.

Renderers do not own simulation truth.

Possible renderers include:

- DOM
- SVG
- Canvas
- Three.js
- WebGL
- shaders

Changing renderer technology must not require musical analysis, AudioWorld, or
core actor simulation to be redesigned.

---

## UI boundary

Final UI is not locked.

Reserve two separate interfaces.

### ControlSurface

Audience-facing experience control.

Current possible metaphor:

```text
Z.land entrance gate + ticket booth
```

Potential responsibilities:

- bring/load a song
- prepare/analyze a song
- issue/show a song ticket
- enter/start
- play/pause
- seek
- restart
- change song
- exit/reset

The gate/ticket-booth metaphor is replaceable presentation.

It must not own AudioWorld logic.

### DebugConsole

Developer-facing instrumentation.

It may expose:

- transport time
- current AudioMap
- musical-domain availability
- beat / bar / phase
- melody
- harmony
- energy
- build / tension
- spectrum
- emitted events
- actor states
- PhysicsWorld registration
- active physical interactions
- settling state
- deterministic random seed

Do not compromise debug observability for art direction.

---

## Engineering rules

Prefer:

- TypeScript
- pure deterministic functions where practical
- explicit contracts
- dependency injection at world boundaries
- actor-local high-frequency state
- shared semantic state only where necessary
- bounded dt
- explicit wake / sleep behavior
- reduced-motion support
- clean lifecycle / disposal
- testable simulation independent of DOM
- serializable AudioMap fixtures
- measurable runtime behavior

Avoid:

- per-frame global React state
- duplicate global listeners
- multiple authoritative clocks
- independent audio analysis per ride
- hidden cross-component mutation
- speculative abstractions
- giant god components
- uncontrolled randomness
- unnecessary layout reads in hot loops
- premature production dependencies

Before adding a production dependency, explain why the current platform or
existing dependencies are insufficient.

Do not claim runtime performance is validated unless it was actually measured
in a runtime environment.

---

## Scope discipline

Do not expand the project merely because an idea is interesting.

Before implementing a feature, identify:

1. What current Story Map milestone requires it?
2. Which system owns the data?
3. Which actor consumes it?
4. Is it continuous state or a discrete event?
5. What actor-local simulation does it affect?
6. Does it create a PhysicsWorld consequence?
7. Does it require a spatial adapter?
8. Can it be implemented without changing unrelated validated systems?
9. Is it required now, or only theoretically useful later?

If there is no current requirement, leave the capability out.

---

## Current implementation strategy

Build vertically, not horizontally.

The first complete causal path is:

```text
Authored AudioMap
→ AudioClock
→ AudioWorld
├── AudioSnapshot
└── AudioEvents
→ Carousel
→ observable correct melodic response
```

Milestone 1 must prove:

- play
- pause
- seek
- restart
- deterministic snapshot lookup
- note-on delivery
- note-off delivery
- correct synchronization after seek
- no historical event replay after seek
- partial-domain handling
- DebugConsole visibility

Do not migrate every ride before this path works.

The first UI is intentionally utilitarian.

Reserve ControlSurface APIs, but do not implement final Gate / Ticket Booth art
direction yet.

After milestone 1, add a second actor that consumes a substantially different
musical signal type.

Correctness before visual polish.