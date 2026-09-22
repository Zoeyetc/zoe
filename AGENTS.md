# Z.land Music Box — Repository Instructions

## Project identity

Z.land is a shared computational physical world.

Z.land Music Box is an interactive music-driven amusement world in which
musical evidence is interpreted by autonomous physical actors, and those actors
can physically affect other actors and ordinary content through PhysicsWorld.

This is not a Framer template.

This is not a conventional audio visualizer.

This is not a collection of synchronized canned animations.

This is not a dashboard where musical-domain activity is represented by
arbitrary status lights.

The project has two equally important goals:

1. preserve musical truth with enough precision that specific notes, chord
   tones, rhythmic events, and structural events remain recognizable;
2. transform that musical truth into a shared physical world rather than a
   conventional notation display.

The current priority is correctness of:

- musical evidence
- architecture
- causality
- timing
- simulation
- synchronization
- physical interaction

Final art direction and final experience composition are not locked yet.

---

## Core causal model

Preserve this chain:

```text
Music
→ Musical Evidence / Meaning
→ Actor Interpretation
→ Actor Simulation
→ PhysicsWorld
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
→ owns musical interpretation and actor-local simulation

PhysicsWorld
→ owns shared physical causality

Renderer
→ displays resulting state

Experience Composition
→ organizes attention and spatial presentation

ControlSurface
→ requests audience-facing actions

DebugConsole
→ observes system truth
```

Never collapse these layers merely to simplify implementation.

---

## Three-layer experience model

Keep these three layers conceptually separate.

### 1. Musical Evidence

This layer answers:

> What is actually present in the music?

Examples:

```text
G4 note onset
C major = C + E + G
kick at 8.42s
high swing value
build = 0.82
drop event at 13.0s
phrase tension rising
```

This layer must remain accurate.

Do not invent musical evidence for visual convenience.

---

### 2. Actor Interpretation

This layer answers:

> How does this actor physically express that musical evidence?

Examples:

```text
G4
→ Carousel carrier activation / pitch expression

C + E + G
→ FerrisWheel C / E / G harmonic carriers active simultaneously

kick
→ BumperCars impulse

groove / swing
→ PirateShip driven pendulum relationship

build / tension / drop
→ DropTower lift / hold / release

phrase / energy / tension
→ RollerCoaster drive / restraint / momentum
```

Interpretation may be expressive.

It must not falsify the underlying musical evidence.

---

### 3. Experience Composition

This layer answers:

> How does the visitor perceive the whole world?

Possible responsibilities include:

- park-map layout
- spatial framing
- camera attention
- Primary / Secondary / Ambient / Resting hierarchy
- region emphasis
- lighting
- visual density
- focus
- labels
- optional explanatory information

Experience Composition may guide attention.

It must not alter musical truth.

It must not activate musical carriers that are not supported by the current
music merely to make the scene more attractive.

---

## Musical evidence accuracy

Musical activation is evidence, not decoration.

If a local actor element visually represents a musical fact, it must correspond
to a real value supplied by AudioWorld.

Examples:

```text
Carousel carrier lights / activates
→ corresponding melody note is actually active
```

```text
FerrisWheel cabins C, E, G activate
→ C, E, G are actual members of the current chord representation
```

```text
BumperCars receives percussion impulse
→ corresponding percussion event actually occurred
```

```text
DropTower releases
→ explicit structural drop event occurred
```

Do not:

- activate extra notes for visual balance
- omit actual chord tones because an actor is visually Ambient
- trigger rhythmic events merely to keep the scene busy
- fabricate confidence when analysis is uncertain
- convert musical-domain availability into decorative blinking

The project should retain the feeling of watching music being transcribed into
physical behavior.

A useful internal concept is:

```text
Z.land = spatial score
```

This is an experience concept, not a requirement to imitate traditional music
notation.

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

`requestAnimationFrame` is a rendering opportunity.

It is not the musical clock.

If rendering drops frames, musical time remains authoritative.

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
- musical-domain availability
- confidence where applicable

AudioWorld does NOT own:

- authoritative transport time
- ride geometry
- ride animation
- ride physics
- visual transforms
- collisions
- page layout
- camera movement
- experience hierarchy
- park-map layout

Individual actors must not independently analyze the same raw audio source.

Given the same AudioMap and musical time, AudioWorld should derive the same
continuous musical truth where practical.

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

AudioMap may currently come from:

- authored deterministic fixtures
- prepared JSON
- MIDI

Future analysis may come from:

- DSP
- beat / onset analysis
- pitch tracking
- predominant melody extraction
- harmony analysis
- structural segmentation
- source separation
- ML transcription
- manual correction
- external tooling

Do not introduce heavy analysis infrastructure until a milestone requires it.

Changing the analysis implementation must not require actor simulations,
PhysicsWorld, or renderers to be rewritten.

---

## Partial musical understanding

Not every song is guaranteed to provide every musical domain reliably.

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
- it may use a musically defensible fallback only when explicitly designed
- unrelated actors continue functioning normally

A smaller truthful performance is preferable to a false complete performance.

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

AudioEvents represent timeline crossings such as:

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

Discrete events must be emitted from timeline-crossing logic.

Do not depend on a render frame landing exactly on an event timestamp.

Do not represent short events only as transient booleans inside a render-frame
snapshot.

---

## Seek semantics

Seeking is synchronization, not playback.

Seeking must:

- move directly to the requested musical time
- recompute the current AudioSnapshot
- emit seek semantics where appropriate
- reset event cursors
- reconcile actor state
- NOT replay every historical musical event between old and new positions

Skipped:

- notes
- beats
- kicks
- chord changes
- structural drops
- physical collisions

must not be replayed merely because seek crossed them.

Actor-specific physical reconciliation remains actor-owned.

---

## Pause semantics

Pausing musical transport does not automatically erase physical energy already
present in the world.

For example:

```text
kick
→ BumperCar receives impulse
→ audio pauses
→ car still has velocity
→ collision may still occur
→ PhysicsWorld may still propagate that collision
```

Therefore:

```text
Audio pause ≠ Physics reset
```

Actor-specific pause behavior may differ when required by physical semantics.

---

## Actor autonomy

Actors own their high-frequency simulation state.

AudioWorld may provide targets, conditions, events, phase, or semantic state.

AudioWorld must not replace actor simulation with direct visual animation.

Current responsibilities are:

```text
Carousel
→ melody / pitch / note identity / note expression

FerrisWheel
→ harmony / simultaneous chord-tone membership / sustained relationships

PirateShip
→ groove / swing / continuous rhythmic phase

BumperCars
→ percussion / transient impulses / collisions

DropTower
→ build / tension / explicit major drop / rebound

RollerCoaster
→ phrase / energy trajectory / tension / release

Free Bodies / Orb
→ texture / atmosphere / spectral conditions + PhysicsWorld response
```

These mappings are current design contracts.

Do not silently reassign them.

---

## Carousel musical evidence rule

Carousel is the primary melody-transcription actor.

Local carrier activation should correspond to actual melody evidence.

Conceptually:

```text
specific note
→ identifiable carrier / local pitch expression
```

Do not select arbitrary carriers merely for visual variety.

Whole-carousel rotation remains a mechanical behavior.

Note identity remains local musical evidence.

Do not confuse the two.

---

## FerrisWheel musical evidence rule

FerrisWheel is the primary harmony-transcription actor.

Harmony must preserve simultaneity.

Conceptually:

```text
C major
→ C + E + G active simultaneously

A minor
→ A + C + E active simultaneously
```

FerrisWheel should expose chord membership through exact harmonic carriers where
the current representation supports it.

Do not reduce harmony to:

```text
chord active
→ whole wheel glows
```

The wheel may have broader mechanical behavior, but local harmonic activation
must remain evidence-based.

---

## PhysicsWorld

PhysicsWorld owns shared physical causality.

Supported participant roles may include:

- Force Source
- Physics Receiver
- Collider / Exclusion Zone
- Dynamic Body

A participant may combine roles.

Text, Image, CMS content, Button, Navigation, Logo, particles, rides, 3D
objects, and other content may participate when explicitly registered.

Cross-object physical effects must pass through PhysicsWorld.

Preferred:

```text
AudioWorld
→ Actor A
→ Actor A simulation
→ actual physical event / force
→ PhysicsWorld
→ Actor B / Content response
```

Avoid:

```text
AudioWorld
→ Actor A animation

AudioWorld
→ separate hard-coded Actor B animation
```

The second form only imitates shared physics.

---

## Layout and physics response

Ordinary page content should retain layout ownership.

Use:

```text
authored/current layout
+
temporary physics response
=
rendered result
```

Do not make PhysicsWorld own responsive layout.

Do not permanently write physical displacement back into authored layout.

When the physics response settles:

```text
response offset → zero
```

and the object returns to its current authored anchor.

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
- actor-local simulation coordinates

without an adapter.

Prefer:

```text
Actor / Content Geometry
→ Spatial Adapter
→ PhysicsWorld Coordinates
→ Physical Interaction
→ Renderer Adapter
```

Camera, scrolling, responsive relayout, or host-container movement must not
automatically become fictitious actor velocity.

Coordinate conversion must not be hidden inside unrelated actor logic.

---

## MotionWorld relationship

MotionWorld owns scroll/page choreography when an experience uses scroll as an
input.

MotionWorld and AudioWorld are sibling domains.

Do not make AudioWorld depend on MotionWorld.

Musical time should not be controlled by scroll by default.

The current vertical development page is not evidence that the final Z.land
experience should be scroll-driven.

---

## Development layout vs final experience

The current vertically stacked development page is a temporary engineering
workbench.

Its purpose is:

- isolated actor inspection
- DebugConsole visibility
- manual QA
- simulation diagnostics
- integration testing

It is NOT the committed final experience layout.

Do not optimize core architecture around the current vertical card stack.

The intended final experience direction is a persistent shared spatial world,
potentially organized as a park map / land plan / spatial score.

Multiple musical actors should be capable of remaining visible within one
shared composition while music advances in time.

The exact final layout is not locked yet.

---

## Spatial Score direction

The current experience direction is:

> one persistent park, multiple simultaneously active musical and physical
> systems.

The park may be spatially divided into areas associated with different actors,
but these areas are not music-theory dashboard panels.

Do not design:

```text
Melody Region
Harmony Region
Percussion Region
```

as isolated information modules.

Organize space around:

- actors
- routes
- shared fields
- physical proximity
- interaction opportunities
- visitor orientation

Musical semantics remain inside actor behavior.

---

## Region emphasis rule

A region may be visually emphasized to help the visitor locate activity.

Region emphasis is attention guidance.

It is NOT musical truth.

Do not implement:

```text
melody available
→ Carousel district status light ON
```

as the primary representation.

Instead:

```text
actual note
→ Carousel local musical carrier responds
```

and optional spatial emphasis may help the visitor notice it.

Likewise:

```text
actual chord tones
→ FerrisWheel harmonic carriers respond
```

The region itself does not substitute for musical evidence.

---

## Experience hierarchy

Musical activity and visual dominance are different concepts.

An actor may be visually:

```text
Primary
Secondary
Ambient
Resting
```

Experience hierarchy may influence:

- camera attention
- framing
- line weight
- contrast
- lighting
- renderer detail
- visual density
- region emphasis
- opacity where appropriate

But:

> Experience hierarchy must never falsify musical evidence.

If FerrisWheel is Ambient, do not hide a real chord tone.

If Carousel is Primary, do not activate extra notes.

Presentation may change.

Musical truth may not.

---

## Visual comprehension

The audience should not need prior music-theory knowledge to understand that
different parts of the park correspond to different kinds of musical behavior.

Prefer:

```text
behavior first
terminology second
```

The final experience does not need to display large labels such as:

- MELODY
- HARMONY
- GROOVE
- STRUCTURE
- PHRASE

unless a learning/debug/info mode deliberately exposes them.

The physical language should carry as much meaning as possible.

Optional labels may explain what the visitor has already begun to perceive.

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

Reserve separate audience and development interfaces.

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
- AudioMap identity
- domain availability
- note identity
- chord identity / chord tones
- rhythm / phase
- energy
- build / tension
- phrase state
- spectrum
- emitted events
- actor states
- PhysicsWorld registrations
- force / impact diagnostics
- settling state
- deterministic random seed

Do not compromise debug observability for art direction.

---

## Subjective QA boundary

Automated systems and Codex may verify objective implementation facts such as:

- tests
- typecheck
- build
- deterministic state
- event delivery
- runtime values
- actor registration
- bounds
- data flow
- browser presence

Do not treat automated or agent judgment as final approval for:

- visual quality
- mechanical feel
- musical feel
- pacing
- composition
- spatial readability
- motion aesthetics
- whether an interaction "feels right"

The user performs final subjective visual and experiential QA.

Do not report subjective QA as passed unless the user explicitly approves it.

---

## Reduced-motion rule

Reduced-motion behavior must preserve semantic identity where practical.

Do not replace the actor's musical role with an unrelated fallback.

Examples:

```text
Carousel
→ preserve note identity while reducing continuous rotation
```

```text
FerrisWheel
→ preserve harmonic carrier identity while suppressing wheel/cabin motion
```

```text
PirateShip
→ preserve rhythmic-phase identity with restrained movement
```

Physical causality should remain conceptually consistent.

---

## Refactoring existing work

Existing validated simulations are assets.

When migrating an existing actor:

1. locate the canonical implementation
2. identify pure geometry
3. identify pure simulation
4. identify actor-local state
5. identify renderer code
6. identify Framer-only code
7. extract behavior without redesigning it
8. verify behavioral parity
9. connect AudioWorld only after extraction is stable
10. change presentation only when the current milestone requires it

Never rewrite working simulation merely to make integration easier.

Do not mix legacy and current versions.

The newer segmented RollerCoaster architecture is the canonical coaster
baseline.

The old closed-circuit RollerCoaster is reference-only.

Detailed migration classifications live in:

```text
references/legacy-reuse.md
```

---

## Engineering rules

Prefer:

- TypeScript
- explicit contracts
- pure deterministic functions where practical
- actor-local high-frequency state
- dependency injection at world boundaries
- bounded dt
- explicit wake / sleep behavior
- reduced-motion support
- clean lifecycle / disposal
- testable simulation independent of DOM
- serializable AudioMap fixtures
- explicit spatial adapters
- measurable runtime behavior

Avoid:

- per-frame global React state
- duplicate global listeners
- multiple authoritative clocks
- independent raw-audio analysis per actor
- hidden cross-component mutation
- speculative abstractions
- giant god components
- uncontrolled randomness
- unnecessary layout reads in hot loops
- musical evidence invented for aesthetics
- premature production dependencies

Before adding a production dependency, explain why the current platform or
existing dependencies are insufficient.

Do not claim runtime performance is validated unless it was actually measured.

---

## Scope discipline

Before implementing a feature, identify:

1. What current Story Map or milestone requires it?
2. Is this musical evidence, actor interpretation, physics, rendering, or
   experience composition?
3. Which system owns the data?
4. Which actor consumes it?
5. Is the musical input continuous state or a discrete event?
6. What actor-local simulation does it affect?
7. Does it create a PhysicsWorld consequence?
8. Does it require a spatial adapter?
9. Does it preserve exact musical evidence?
10. Can it be implemented without changing unrelated validated systems?
11. Is it required now, or merely theoretically useful?

If there is no current requirement, leave the capability out.

---

## Current validated project state

The project has already validated the following actor mappings:

```text
Carousel
→ melody

FerrisWheel
→ harmony

PirateShip
→ groove / swing

BumperCars
→ percussion

DropTower
→ structure / build / tension / explicit drop

RollerCoaster
→ phrase / energy / tension / release
```

The project has also validated:

```text
BumperCars actual collision
→ PhysicsWorld
→ Anchored Content Participant
```

and:

```text
authored layout
+
temporary PhysicsWorld response
→ anchored content rendering
```

Do not regress these validated contracts.

---

## Near-term implementation sequence

The next world-building priorities are:

```text
RollerCoaster actual motion
→ PhysicsWorld directional wake
→ existing Anchored Content Participant
```

then:

```text
AudioWorld texture / spectrum
+
PhysicsWorld forces
→ Free Bodies / Orb
```

Only after these world-physics foundations are validated should the project
commit significant effort to the final Park Map / Spatial Score experience
composition.

The current vertical development layout remains temporary until then.

---

## Repository invariant

When uncertain about a feature, ask four questions:

```text
Is it true in the music?
→ Musical Evidence / AudioWorld

What does that truth mean to this machine?
→ Actor Interpretation

What physical consequence does the machine create?
→ PhysicsWorld

How should the visitor notice and understand it?
→ Experience Composition
```

Do not solve one question inside the wrong layer.

The canonical project spine remains:

```text
Music
→ Evidence
→ Actor
→ Physics
→ World
```

The intended experience remains:

```text
one song
→ one shared park
→ many simultaneous musical truths
→ precise local musical hits
→ shared physical consequences
```