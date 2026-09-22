---
name: zland-music-box
description: >
  Work on Z.land Music Box architecture, AudioClock, AudioWorld, PhysicsWorld,
  musical evidence, musical ride actors, spatial score behavior, audio-driven
  physical causality, ControlSurface, DebugConsole, Park Map / experience
  composition, or migration/refactoring of existing Z.land and Framer ride
  simulations. Use for Carousel, FerrisWheel, PirateShip, BumperCars,
  DropTower, RollerCoaster, Free Bodies / Orb, AudioMap, AudioSnapshot,
  AudioEvent, AudioClock, PhysicsWorld, Anchored Content, spatial adapters,
  or cross-actor physics work in this repository. Do not use for unrelated
  React, Framer, web design, or general coding tasks.
---

# Z.land Music Box workflow

Always obey the repository `AGENTS.md`.

Z.land Music Box is not merely a set of music-reactive rides.

The project must preserve both:

```text
precise musical evidence
```

and:

```text
shared physical world behavior
```

The canonical causal spine is:

```text
Music
→ Musical Evidence
→ Actor Interpretation
→ Actor Simulation
→ PhysicsWorld
→ World
```

Experience Composition may guide attention around that world, but must not
falsify musical evidence.

Before implementation, determine which kind of task this is.

---

## Read strategy

Use references progressively.

### For architecture / ownership / world-boundary work

Read:

- `references/architecture.md`
- `references/ride-map.md`

Also read:

- `references/story-map.md`

when the architecture decision affects visitor experience.

---

### For experience / choreography / Park Map / Spatial Score work

Read:

- `references/story-map.md`
- `references/ride-map.md`
- `references/architecture.md`

Do not design final experience composition without understanding current actor
and PhysicsWorld contracts.

---

### For existing ride migration or refactor

Read:

- `references/legacy-reuse.md`
- `references/architecture.md`
- `references/ride-map.md`

Do not migrate from memory.

Locate and inspect the canonical implementation first.

---

## First classify the layer

Before implementing, explicitly identify which layer owns the requested change.

### Musical Evidence

Questions such as:

```text
What note is active?
Which chord tones are present?
Did a kick occur?
What is current swing?
Is structure in build / tension / release?
```

belong to:

```text
Analysis Pipeline / AudioMap / AudioWorld
```

depending on whether the information is precomputed or runtime.

---

### Actor Interpretation

Questions such as:

```text
What does G4 mean to Carousel?
What do C/E/G mean to FerrisWheel?
How does groove drive PirateShip?
How does build affect DropTower?
How does phrase tension affect RollerCoaster?
```

belong to:

```text
Actor adapter / actor-local interpretation
```

---

### Actor Simulation

Questions such as:

```text
angle
velocity
acceleration
routeDistance
collision state
spring state
pendulum state
```

belong to:

```text
actor-local simulation
```

---

### Shared Physical Causality

Questions such as:

```text
What force reaches another object?
Did a real collision affect content?
Does RollerCoaster wake push nearby objects?
```

belong to:

```text
PhysicsWorld
```

---

### Experience Composition

Questions such as:

```text
Which actor should be visually Primary?
How should the Park Map organize actors?
Should a district receive subtle emphasis?
Where should the camera look?
How should the visitor understand the whole song?
```

belong to:

```text
Experience Composition
```

Do not solve experience-composition problems by changing musical truth or actor
physics.

---

## Musical evidence rule

Musical activation is evidence.

It is not decorative animation.

If an actor-local visual element represents a musical fact, that element must
correspond to actual AudioWorld data.

Examples:

```text
Carousel carrier active
→ corresponding melody note actually exists
```

```text
FerrisWheel C / E / G carriers active
→ C / E / G are actual members of current chord
```

```text
BumperCars percussion impulse
→ corresponding percussion event actually occurred
```

```text
DropTower release
→ explicit drop event occurred
```

Never activate extra musical carriers merely because:

- the composition looks empty
- the current actor is visually Primary
- symmetry would improve
- a region needs more motion
- the experience feels too quiet

Musical evidence must remain truthful.

---

## Musical evidence vs presentation

Maintain this separation:

```text
Musical Evidence
= exact musical truth

Actor Interpretation
= physical expression of that truth

Experience Composition
= presentation / attention guidance
```

Experience hierarchy may alter:

- camera attention
- line weight
- contrast
- opacity
- lighting
- region emphasis
- detail
- framing

It must NOT:

- add false notes
- remove real chord tones
- fabricate percussion events
- suppress real evidence merely because an actor is Ambient
- invent musical confidence

---

## Spatial Score principle

The intended experience direction is closer to a spatial score than a
music-domain dashboard.

Do not interpret the final Park Map as:

```text
Melody Region
Harmony Region
Percussion Region
```

with status lights.

Prefer:

```text
one shared park
+
multiple physical actors
+
precise local musical hits
+
shared spatial causality
```

Examples:

```text
specific melody note
→ specific Carousel carrier
```

```text
current chord tones
→ simultaneous FerrisWheel carriers
```

```text
percussion event
→ BumperCars impulse
```

```text
phrase movement
→ RollerCoaster physical development
```

A district may receive subtle emphasis to guide attention, but the district
itself is not the musical evidence.

---

## Development layout rule

The current vertically stacked development page is temporary.

Treat it as:

```text
development workbench
```

Its purpose is:

- isolated actor QA
- diagnostics
- DebugConsole visibility
- regression testing
- integration testing

Do not infer final UX from this layout.

Do not optimize core architecture around vertical scrolling.

Do not make musical time depend on scroll by default.

The final experience may later become a persistent Park Map / Spatial Score
with multiple actors simultaneously visible.

---

## Audio analysis work

Read:

- `references/architecture.md`
- `references/story-map.md`

Preserve:

```text
Audio Source
→ Analysis Pipeline
→ AudioMap
──────── runtime boundary ────────
→ AudioWorld
```

AudioWorld must not depend on how AudioMap was produced.

Current authored fixtures are development inputs, not final analysis strategy.

Do not add:

- DSP
- ML
- transcription
- source separation
- pitch tracking
- harmony analysis

unless the current milestone explicitly requires real analysis.

---

## AudioClock work

AudioClock owns authoritative musical transport time.

Responsible for:

- play
- pause
- seek
- restart
- current time
- duration
- transport state

Do not move authoritative time ownership into:

- AudioWorld
- React rendering
- actor simulation
- requestAnimationFrame

`requestAnimationFrame` is a render opportunity, not the musical clock.

---

## AudioWorld work

Maintain four distinct concepts.

### AudioClock

Authoritative transport time.

### AudioMap

Whole-song authored or analyzed musical information.

### AudioSnapshot

Continuous musical truth at one transport time.

Prefer deterministic derivation:

```text
AudioMap + transport time
→ AudioSnapshot
```

### AudioEvent

Discrete timeline crossings such as:

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

Do not represent short events only as frame-local booleans.

Event delivery must use timeline-crossing logic.

---

## Partial musical understanding

Every musical-domain integration must define behavior when its domain is
unavailable.

Examples:

```text
melody unavailable
→ Carousel remains musically inactive / resting
```

```text
harmony unavailable
→ FerrisWheel remains present but does not invent chord carriers
```

```text
structure unavailable
→ DropTower does not fabricate build/drop
```

Do not generate fake musical data merely to keep all actors moving.

A smaller truthful performance is preferable to a visually fuller false one.

---

## Carousel rule

Carousel owns:

```text
melody
pitch
note identity
note expression
```

Carousel should preserve a clear distinction between:

```text
whole-carousel mechanical motion
```

and:

```text
local note evidence
```

A note-on should activate an identifiable carrier or local expression because
that note exists.

Do not select random carriers for variety.

Do not rotate the entire Carousel to chase every fast melody note.

---

## FerrisWheel rule

FerrisWheel owns:

```text
harmony
chord identity
simultaneous chord-tone membership
sustained harmonic relationship
```

Harmony must preserve simultaneity.

Conceptually:

```text
C major
→ C + E + G carriers active together
```

```text
A minor
→ A + C + E carriers active together
```

Do not reduce FerrisWheel to:

```text
harmony active
→ wheel glows
```

Wheel rotation and cabin mechanics are physical behavior.

Local harmonic carriers are musical evidence.

Keep those responsibilities distinct.

---

## PirateShip rule

PirateShip owns:

```text
groove
swing
continuous rhythmic phase
```

PirateShip is not a percussion event visualizer.

Do not drive it from kick/snare/hat.

Musical phase may influence driving torque or target phase.

The actor-local pendulum simulation owns actual angle and angular velocity.

---

## BumperCars rule

BumperCars owns:

```text
percussion
transient impulse
collision energy
```

AudioWorld provides percussion events.

BumperCars interprets them locally as physical impulses.

Actual collision outcomes belong to simulation.

Secondary collision effects must emerge physically.

Do not author collision outcomes directly from music events.

---

## DropTower rule

DropTower owns:

```text
build
tension
explicit major drop
rebound
```

Continuous build / tension prepares the actor.

The discrete `drop` event authorizes the major release.

Do not release merely because:

```text
energy > threshold
```

if no explicit drop event exists.

AudioWorld must not directly set vertical position.

---

## RollerCoaster rule

RollerCoaster owns:

```text
phrase
energy trajectory
tension
release
long-form development
```

Do not reduce to:

```text
energy → velocity
```

AudioWorld modifies physical conditions such as:

- drive
- restraint
- braking tendency
- available momentum

The actor simulation still owns:

- routeDistance
- velocity
- acceleration
- gravity
- drag
- segment behavior

Never map:

```text
phraseProgress
→ routeDistance directly
```

The newer segmented RollerCoaster is canonical.

The old closed-circuit implementation is reference-only.

---

## Free Bodies / Orb rule

Free Bodies are intended to consume two kinds of input:

```text
AudioWorld atmospheric / spectral conditions
+
PhysicsWorld forces
```

They are not merely decorative particles that follow FFT amplitude.

Future Free Bodies may own:

- position
- velocity
- mass
- drag
- turbulence
- collisions
- exclusion response

Do not implement them as canned sine-wave floating objects if the milestone
requires real dynamic-body behavior.

---

## Actor integration checklist

For every AudioWorld → actor integration, explicitly state:

1. What musical domain does the actor own?
2. What exact musical evidence does it expose?
3. Which AudioSnapshot fields does it read?
4. Which AudioEvents does it consume?
5. Which inputs are continuous?
6. Which inputs are discrete?
7. What actor-local interpretation is applied?
8. What actor-local simulation state changes?
9. Which existing validated behavior must remain unchanged?
10. Which visual elements represent exact musical evidence?
11. Which visual elements are only mechanical/presentation behavior?
12. Which PhysicsWorld roles does the actor register?
13. Which spatial adapter is required?
14. What does the renderer display?
15. What happens on pause?
16. What happens on seek?
17. What happens on restart?
18. What happens on song replacement?
19. What happens if the musical domain is unavailable?
20. What happens under reduced motion?
21. What must remain deterministic?
22. What objective runtime facts can Codex verify?
23. What subjective qualities must the user manually QA?

If these cannot be stated clearly, do not implement the integration yet.

---

## Seek implementation rule

Seek is synchronization, not historical playback.

On seek:

```text
old time
→ new time
→ recompute AudioSnapshot
→ reset event cursor
→ emit seek semantics
→ actors reconcile
```

Do not:

- replay skipped notes
- replay skipped percussion
- replay skipped chord changes
- replay skipped drop events
- replay historical collisions
- simulate skipped phrase history merely to catch up visually

Each actor owns its reconciliation strategy.

---

## Pause rule

Preserve:

```text
Audio pause ≠ Physics reset
```

Examples:

```text
BumperCars already moving
→ may continue colliding after pause
```

```text
PirateShip already swinging
→ may continue damping
```

```text
RollerCoaster in gravity-dominated motion
→ may continue moving
```

PhysicsWorld follows physical state, not AudioClock.playing.

---

## PhysicsWorld work

PhysicsWorld owns shared spatial causality.

Do not move actor-local simulations into PhysicsWorld merely because they
interact with the world.

Prefer:

```text
Actor
→ owns its simulation

PhysicsWorld
→ receives meaningful physical consequence
```

Examples:

```text
BumperCars local collision
→ shared impact
```

```text
RollerCoaster actual movement
→ shared directional wake
```

Do not let PhysicsWorld consume musical state directly when a physical actor is
supposed to mediate the effect.

---

## Cross-actor interaction rule

Preferred:

```text
AudioWorld
→ Actor A
→ Actor A physical state
→ PhysicsWorld
→ Actor B / Content
```

Avoid:

```text
AudioWorld
→ Actor A visual animation

AudioWorld
→ separate hard-coded Actor B visual response
```

If a concept claims that one physical object affected another, the consequence
must pass through PhysicsWorld.

---

## Anchored content rule

Ordinary content may participate physically without becoming a free body.

Use:

```text
authored layout
+
temporary physics response
=
rendered result
```

PhysicsWorld must not own responsive layout.

A content receiver returns to its current authored anchor.

Do not hard-code startup pixels as permanent recovery targets.

---

## Spatial integration rule

Read `references/architecture.md` before connecting:

- DOM participants
- SVG actors
- Canvas actors
- Three.js actors
- page-relative content
- camera-relative content
- scroll-relative content

Do not implicitly mix coordinate systems.

Use explicit spatial adapters.

Camera movement, scroll, responsive relayout, or host movement must not become
false physical velocity.

Do not hide coordinate conversion inside renderer code.

---

## Experience Composition rule

Experience Composition may eventually include:

- Park Map / land layout
- district boundaries
- camera / zoom
- attention hierarchy
- labels
- paths
- region emphasis
- information overlays

It must remain downstream of musical truth.

Do not implement:

```text
domain active
→ district status light
```

as the primary musical representation.

Prefer:

```text
actual musical evidence
→ local actor response

optional district emphasis
→ helps visitor notice it
```

---

## Region emphasis rule

Region highlighting is allowed only as attention guidance.

It is not musical truth.

Do not make whole-region activation replace:

- note identity
- chord-tone membership
- percussion events
- structural state

If region emphasis is used, it should be derived from the actual actor /
experience state and remain secondary to local evidence.

---

## Experience hierarchy rule

Current conceptual hierarchy:

```text
Primary
Secondary
Ambient
Resting
```

This may affect presentation.

It must not change underlying musical evidence.

Examples:

Wrong:

```text
FerrisWheel becomes Ambient
→ hide one real chord tone
```

Wrong:

```text
Carousel becomes Primary
→ activate extra riders
```

Correct:

```text
same musical evidence
+
different presentation emphasis
```

---

## Current development-page rule

The current vertical page should remain utilitarian while core systems are
still being validated.

Do not prematurely replace it with final Park Map UI during world-physics
milestones unless explicitly requested.

This prevents:

- layout work
- responsive complexity
- camera systems
- z-depth
- occlusion
- final composition

from interrupting core architecture development.

---

## Legacy migration rule

Read:

- `references/legacy-reuse.md`

Before migrating:

1. locate canonical implementation
2. identify reusable geometry
3. identify reusable simulation
4. identify renderer code
5. identify Framer-only code
6. extract validated behavior first
7. verify parity
8. integrate with current AudioWorld / PhysicsWorld after extraction

Never silently replace validated simulation with a simpler animation.

Never choose an obsolete implementation because it is easier to copy.

---

## Determinism rule

Emergent simulation must remain debuggable.

When randomness affects:

- BumperCars
- Free Bodies
- particle initialization
- body layouts
- other physical initial conditions

use explicit seeded randomness during development where practical.

Do not scatter uncontrolled `Math.random()` calls through simulation loops.

Expose relevant seed information through DebugConsole when useful.

---

## Performance rules

Keep high-frequency simulation local to actors.

Do not push body positions, particle positions, ride state, or force fields
through application-level React state every frame.

Prefer:

- bounded dt
- actor-local simulation
- imperative rendering where appropriate
- explicit wake / sleep
- lifecycle cleanup
- avoiding per-frame layout reads

Do not create one `requestAnimationFrame` loop per trivial visual effect without
checking existing simulation ownership.

Do not claim runtime performance is validated unless measured.

---

## Reduced-motion rule

Reduced motion should preserve semantic identity.

Examples:

```text
Carousel
→ preserve note identity
```

```text
FerrisWheel
→ preserve harmonic carrier identity
```

```text
PirateShip
→ preserve rhythmic-phase identity
```

```text
DropTower
→ preserve build / hold / release semantics
```

Do not replace an actor's musical role with unrelated flashing or labels.

---

## ControlSurface work

ControlSurface is audience-facing.

Read:

- `references/story-map.md`
- `references/architecture.md`

Potential responsibilities include:

- bring/load a song
- preparation / analysis state
- ticket presentation
- enter/start
- play
- pause
- seek
- restart
- change song
- exit/reset

Current Gate / Ticket Booth treatment is a working metaphor, not a locked
visual design.

ControlSurface must request actions through world APIs.

It must not own AudioClock or AudioWorld truth.

---

## DebugConsole work

DebugConsole is developer-facing.

It may expose:

- transport
- AudioMap identity
- musical-domain availability
- exact note
- chord / chord tones
- rhythm / swing / phase
- structure
- phrase
- spectrum
- emitted events
- actor-local state
- PhysicsWorld sources
- impacts
- wakes
- receiver response
- settling state
- deterministic seed

Debug observability has priority over aesthetics.

Do not remove useful diagnostics merely because the development page becomes
visually dense.

---

## Objective QA vs subjective QA

Codex may verify objective facts.

Examples:

- tests pass
- typecheck passes
- build passes
- actor is mounted
- event was emitted
- routeDistance changed continuously
- note carrier ID matches current note
- chord carriers match current chord tones
- force source is registered
- values remain bounded
- no NaN / Infinity
- reduced-motion branch is active
- debug state matches live actor state

Codex must NOT self-approve subjective qualities such as:

- "looks good"
- "feels musical"
- "mechanical feel is correct"
- "motion is elegant"
- "tension feels dramatic"
- "layout is readable"
- "park composition works"
- "visual QA passed"

The user performs subjective visual and experiential QA.

Before finishing a milestone, clearly separate:

```text
objective implementation verification
```

from:

```text
user manual QA
```

---

## Working style

Make the smallest architectural change that satisfies the current milestone.

Before editing, report:

- files expected to change
- reference files consulted
- ownership boundary affected
- musical evidence involved
- actor-local interpretation
- validated behavior that must remain unchanged
- PhysicsWorld role if relevant
- acceptance tests

After editing, report:

- files changed
- what was deliberately not changed
- tests run
- typecheck result
- build result
- git diff check when relevant
- objective runtime state actually observed
- manual QA cases for the user
- anything not yet validated

Never report unobserved browser behavior as passed.

Never report subjective QA as passed.

---

## Current validated project state

The following musical actor mappings are already implemented and validated
objectively:

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
BumperCars real collision
→ PhysicsWorld impact
→ Anchored Content Participant
```

and:

```text
authored layout
+
temporary PhysicsWorld response
→ rendered anchored content
```

Do not regress these systems when adding new milestones.

---

## Current near-term milestones

### Next: RollerCoaster Wake → PhysicsWorld

Target:

```text
AudioWorld phrase
→ RollerCoaster actual motion
→ real world position / forward / physical speed
→ PhysicsWorld directional wake
→ Anchored Content Participant
```

Wake strength must derive from actual physical motion.

Do not derive the shared force directly from phrase energy.

---

### Then: Free Bodies / Orb

Target:

```text
AudioWorld spectrum / texture
+
PhysicsWorld external forces
→ Free Body simulation
```

Free Bodies should be genuine dynamic participants.

They should not be simple audio-reactive decorative particles.

---

### After world-physics foundations

Begin dedicated:

```text
Experience Composition / Park Map / Spatial Score Prototype
```

At that stage, use the established musical-evidence and PhysicsWorld contracts.

Do not redesign actor truth merely to make the map composition easier.

---

## Final invariant

When uncertain, ask:

```text
Is this actually present in the music?
→ Musical Evidence

What does this machine do with it?
→ Actor Interpretation

What happens physically because the machine moved?
→ PhysicsWorld

How does the visitor notice and understand it?
→ Experience Composition
```

Keep those questions separate.

The canonical project spine remains:

```text
Music
→ Evidence
→ Actor
→ Physics
→ World
```

The intended audience experience remains:

```text
one song
→ one shared park
→ many simultaneous musical truths
→ precise local musical hits
→ shared physical consequences
→ a spatial score that can be watched and explored
```