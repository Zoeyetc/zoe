# Z.land Music Box — Architecture v0.3

## 1. System definition

Z.land Music Box is a shared computational physical world driven by musical
evidence and musical meaning.

It is not a conventional audio visualizer.

It is not a collection of independent ride animations synchronized to the same
song.

It is not a dashboard that reduces music to generic activity indicators.

The system must preserve two things simultaneously:

1. precise musical evidence;
2. expressive physical interpretation.

Its canonical causal chain is:

```text
Music
↓
Musical Evidence
↓
Actor Interpretation
↓
Actor Simulation
↓
PhysicsWorld
↓
World
```

A song provides musical facts and conditions.

Actors interpret those facts according to their own mechanical language.

PhysicsWorld propagates physical consequences between participants.

Experience Composition determines how the visitor perceives the resulting
shared world.

The architecture intentionally separates:

- audio analysis
- musical transport
- musical evidence
- actor interpretation
- actor-local simulation
- shared physical causality
- rendering
- experience composition
- audience controls
- developer instrumentation

These domains may evolve independently.

---

## 2. Core ownership rule

The system must never have multiple competing owners of the same truth.

Use this ownership model:

```text
Analysis Pipeline
→ derives AudioMap from an audio source

AudioClock
→ owns authoritative musical transport time

AudioWorld
→ owns current musical truth

Actor Adapter / Interpretation
→ owns what musical truth means to one actor

Actor Simulation
→ owns the actor's physical state

PhysicsWorld
→ owns shared physical causality

Renderer
→ displays actor / world state

Experience Composition
→ organizes attention and spatial presentation

ControlSurface
→ requests audience-facing actions

DebugConsole
→ observes system truth
```

No layer should silently take over another layer's responsibility merely to
simplify implementation.

---

## 3. Three-layer meaning model

Keep these layers conceptually distinct.

### 3.1 Musical Evidence

Musical Evidence answers:

> What is actually present in the music?

Examples:

```text
G4 is active
C major contains C / E / G
kick occurs at 8.42s
swing = 0.68
build = 0.82
drop occurs at 13.0s
phrase tension is rising
```

Musical Evidence must remain truthful.

It is derived from:

```text
AudioMap + AudioClock time
→ AudioWorld
```

Musical Evidence may include:

- exact notes
- note onset / offset
- pitch
- chord identity
- chord-tone membership
- percussion events
- beat / phase
- groove / swing
- structure
- build
- tension
- phrase state
- spectral / texture state

This layer must not be altered for visual balance.

---

### 3.2 Actor Interpretation

Actor Interpretation answers:

> What does this musical evidence mean to this machine?

Examples:

```text
G4
→ Carousel local carrier activation

C + E + G
→ FerrisWheel C / E / G carriers active simultaneously

kick
→ BumperCars local impulse

swing / groove
→ PirateShip drive timing

build / tension / drop
→ DropTower lift / hold / release

phrase energy / tension
→ RollerCoaster drive / restraint / release
```

Actor interpretation may be expressive.

It must not falsify Musical Evidence.

---

### 3.3 Experience Composition

Experience Composition answers:

> How should the visitor notice and understand the shared world?

Possible responsibilities:

- Park Map layout
- spatial framing
- camera / zoom
- Primary / Secondary / Ambient / Resting hierarchy
- region emphasis
- contrast
- visual density
- labels
- information overlays
- focus / de-emphasis

Experience Composition is presentation.

It must not modify Musical Evidence.

It must not activate extra notes, hide real chord tones, or invent musical
events.

---

## 4. High-level architecture

```text
                         AUDIO SOURCE
                              │
                              ▼
                     Analysis Pipeline
                              │
                              ▼
                           AudioMap
                              │
                       authoritative time
                              │
                              ▼
                          AudioClock
                              │
                              ▼
                         AudioWorld
                    ┌─────────┴─────────┐
                    │                   │
              AudioSnapshot        AudioEvents
               continuous            discrete
                    │                   │
                    └─────────┬─────────┘
                              │
                              ▼
                    Musical Evidence
                              │
                              ▼
                    Actor Interpretation
                              │
                              ▼
                      Actor Simulation
                              │
                              ▼
                         PhysicsWorld
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
          Actors            Content          Free Bodies
            │                 │                 │
            └─────────────────┼─────────────────┘
                              │
                              ▼
                           Renderer
                              │
                              ▼
                   Experience Composition
```

ControlSurface and DebugConsole sit alongside these systems.

ControlSurface requests actions.

DebugConsole observes state.

---

## 5. Musical evidence accuracy

Musical activation is evidence, not decoration.

If an actor-local visual element represents a musical fact, it must correspond
to actual AudioWorld data.

Examples:

```text
Carousel carrier active
→ corresponding melody note is actually present
```

```text
FerrisWheel C / E / G carriers active
→ C / E / G are actual members of the current chord representation
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

- activate extra musical carriers for symmetry
- remove real chord tones because an actor is visually Ambient
- invent percussion to increase motion
- fabricate confidence
- treat domain availability as a decorative status light
- allow Experience Composition to modify musical truth

A useful internal principle is:

```text
If it looks like musical evidence, it must be musical evidence.
```

---

## 6. Spatial Score principle

The intended final experience is closer to a spatial score than a conventional
audio visualizer or dashboard.

Traditional notation organizes musical evidence primarily through:

```text
time
×
pitch / staff position
```

Z.land may organize musical evidence through:

```text
time
×
space
×
mechanical behavior
×
physical causality
```

The Park Map is therefore not merely navigation.

It may become a persistent spatial representation of simultaneous musical
dimensions.

However:

```text
Park Map
≠
Musical Evidence
```

The map organizes the world.

The actors expose the music.

---

## 7. Park Map / district boundary

Future spatial composition may use districts or actor regions.

Do not design the map as:

```text
Melody Region
Harmony Region
Percussion Region
```

with domain status lights.

Prefer spatial organization around:

- actors
- routes
- force fields
- interaction opportunities
- physical proximity
- visitor orientation
- shared-world composition

Musical semantics remain inside actor behavior.

For example:

```text
Carousel district exists
but
specific note evidence appears on Carousel carriers
```

```text
FerrisWheel district exists
but
specific harmonic evidence appears on exact cabins
```

The region itself must not substitute for precise musical evidence.

---

## 8. Region emphasis

Region emphasis is an Experience Composition tool.

It may help the visitor locate current activity.

Possible techniques:

- line weight
- contrast
- local fill
- subtle illumination
- density
- camera framing
- scale emphasis
- localized motion traces

Region emphasis is secondary.

Do not implement:

```text
melody domain available
→ Carousel region ON
```

as the primary representation.

Prefer:

```text
actual melody note
→ local Carousel evidence

optional district emphasis
→ helps visitor notice it
```

---

## 9. Experience hierarchy

An actor may be visually:

```text
Primary
Secondary
Ambient
Resting
```

This hierarchy may influence:

- camera attention
- framing
- contrast
- line weight
- lighting
- visual density
- detail
- region emphasis
- opacity where appropriate

But:

> Experience hierarchy must never falsify Musical Evidence.

Wrong:

```text
FerrisWheel becomes Ambient
→ hide one real chord tone
```

Wrong:

```text
Carousel becomes Primary
→ activate extra note carriers
```

Correct:

```text
same musical evidence
+
different presentation emphasis
```

---

## 10. Audio analysis boundary

Audio analysis and AudioWorld runtime are separate systems.

```text
Audio File
    │
    ▼
Analysis Pipeline
    │
    ▼
AudioMap
──────────────────── runtime boundary
    │
    ▼
AudioWorld
```

AudioWorld must not depend on how AudioMap was produced.

During development, AudioMap may come from:

- authored fixtures
- deterministic test data
- prepared JSON
- MIDI

Future AudioMap generation may use:

- audio decoding
- DSP
- BPM / beat detection
- onset detection
- pitch tracking
- predominant melody extraction
- harmony analysis
- structural segmentation
- source separation
- machine-learning transcription
- external preprocessing
- manual correction

Changing analysis implementation must not require actor simulations,
PhysicsWorld, or renderers to be rewritten.

---

## 11. Partial musical understanding

AudioMap must support incomplete analysis.

Examples:

```text
melody      available
rhythm      available
harmony     uncertain
structure   available
```

or:

```text
melody      unavailable
rhythm      available
harmony     unavailable
energy      available
```

Do not fabricate musical evidence simply to activate every actor.

If a musical domain is unavailable:

- the actor may remain resting
- it may use a musically defensible fallback only if explicitly designed
- unrelated actors continue functioning

A smaller truthful performance is preferable to a false complete performance.

---

## 12. AudioMap

AudioMap describes whole-song musical information.

It is timeline data.

It is not current runtime state.

Conceptually:

```ts
type AudioMap = {
    version: number
    duration: number

    capabilities: MusicalCapabilities

    tempo: TempoMap

    beats: BeatEvent[]
    bars: BarEvent[]

    melody: MelodyNote[]
    harmony: HarmonyEvent[]
    percussion: PercussionEvent[]

    sections: SectionEvent[]
    phrases: PhraseEvent[]

    energy: ContinuousCurve
    spectrum: SpectralData

    builds: BuildEvent[]
    drops: DropEvent[]
}
```

The exact representation may evolve.

Do not add fields because they might theoretically become useful.

A field should exist because:

- current Musical Evidence requires it
- a current actor requires it
- a current Story Map milestone requires it
- DebugConsole needs it to verify truth

AudioMap should remain serializable.

---

## 13. AudioClock

AudioClock owns authoritative musical transport time.

Responsibilities:

- play
- pause
- seek
- restart
- current musical time
- duration
- transport state

When real audio is used, time must ultimately derive from Web Audio transport.

`requestAnimationFrame` is not musical time.

Correct relationship:

```text
AudioClock
↓
current musical time
↓
AudioWorld
↓
Musical Evidence
↓
Actors
```

If rendering drops frames, musical time remains authoritative.

---

## 14. AudioWorld

AudioWorld owns current musical truth.

It consumes:

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

AudioWorld may expose transport-facing APIs, but it does not own:

- ride geometry
- actor simulation
- collisions
- visual transforms
- world rendering
- page layout
- camera
- Park Map
- experience hierarchy

Individual actors must not independently analyze the same raw audio source.

---

## 15. AudioSnapshot

AudioSnapshot represents continuous Musical Evidence at a specific transport
time.

Where practical:

```text
AudioMap + time
→ deterministic AudioSnapshot
```

The same map and time should produce the same continuous musical truth.

The public snapshot should be treated as immutable by consumers.

Current domains may include:

```text
transport
rhythm
melody
harmony
structure
spectrum
```

Musical-domain fields should expose availability and confidence where
appropriate.

Normalized scalar values should normally remain within documented ranges.

---

## 16. AudioEvents

Short musical occurrences must not depend on a rendering frame landing exactly
on their timestamp.

Discrete Musical Evidence uses events.

Examples:

```text
note-on
note-off
beat
downbeat
kick
snare
hat
chord-change
section-change
drop
seek
```

Events must be emitted through timeline-crossing logic.

Do not model short musical events only as frame-local booleans.

---

## 17. Event delivery

AudioWorld must distinguish:

```text
continuous Musical Evidence
```

from:

```text
timeline crossings
```

During normal forward playback:

```text
previous transport time
→ current transport time
```

AudioWorld may emit discrete events whose timestamps were crossed.

Event delivery must not depend on frame rate.

The same event must not be emitted repeatedly merely because multiple render
frames occur near its timestamp.

---

## 18. Seek semantics

Seek is synchronization, not playback.

Example:

```text
12s
→ seek
→ 32s
```

The system must not replay every event between those times.

Correct behavior:

```text
seek
↓
AudioClock = target
↓
AudioWorld recomputes snapshot
↓
event cursor resets
↓
seek semantics emitted
↓
actors reconcile
```

Historical:

- notes
- beats
- percussion
- chord changes
- structural drops
- collisions
- wake history

must not be replayed automatically.

Actor-specific reconciliation remains actor-owned.

---

## 19. Pause, restart, and replacement

### Pause

Pause stops musical transport.

It does not erase existing physical energy.

```text
Audio pause ≠ Physics reset
```

Actor simulation and PhysicsWorld may continue resolving existing physical
state.

---

### Restart

Restart returns musical transport to the beginning.

Actor-specific deterministic reset behavior may restore development initial
state.

Do not assume every visual object must teleport blindly.

---

### Song replacement

Replacing AudioMap must not require rebuilding the application.

Conceptually:

```text
same park
+
new AudioMap
=
new musical conditions
```

The world systems remain.

---

## 20. Actor layer

Actors are autonomous physical interpreters.

Each actor receives Musical Evidence and decides what it means within its own
motion model.

AudioWorld must not command visual transforms directly.

Wrong:

```text
AudioWorld:
rotate Carousel 14 degrees
```

Correct:

```text
AudioWorld:
active melody note = G4
```

then:

```text
Carousel:
G4 maps to this local carrier expression
```

then:

```text
Carousel simulation:
calculates actual motion
```

Actors retain high-frequency simulation state locally where practical.

---

## 21. Carousel contract

Carousel owns:

```text
melody
pitch
note identity
note expression
```

Its mechanical system may contain:

- base angle
- angular velocity
- inertia
- carriers
- local vertical expression

The important distinction:

```text
whole-carousel mechanical motion
≠
local note evidence
```

A local carrier activation should correspond to actual melody evidence.

Do not activate arbitrary carriers for visual variety.

Do not make whole-carousel motion chase fast note changes.

---

## 22. FerrisWheel contract

FerrisWheel owns:

```text
harmony
chord identity
simultaneous chord-tone membership
sustained harmonic relationships
```

Harmony must preserve simultaneity.

Conceptually:

```text
C major
→ C / E / G active simultaneously
```

```text
A minor
→ A / C / E active simultaneously
```

FerrisWheel mechanical behavior may include:

- wheel rotation
- angular velocity
- suspended cabins
- gravity-oriented cabins
- cabin swing

Local harmonic activation must remain exact Musical Evidence.

Do not reduce harmony to whole-wheel glow or generic activity.

---

## 23. PirateShip contract

PirateShip owns:

```text
groove
swing
continuous rhythmic phase
```

It is not a percussion-event display.

Musical phase may influence:

- drive torque
- target phase
- timing asymmetry
- bounded amplitude

Actor-local pendulum simulation owns:

- angle
- angular velocity
- damping
- settling

---

## 24. BumperCars contract

BumperCars owns:

```text
percussion
transient impulses
collision energy
```

AudioWorld creates semantic percussion events.

BumperCars interprets those as physical impulses.

Actual collision outcomes belong to simulation.

Secondary motion must emerge physically.

Do not author collision outcomes directly from percussion events.

---

## 25. DropTower contract

DropTower owns:

```text
build
tension
explicit major drop
rebound
```

Continuous structure prepares the actor.

Discrete `drop` event authorizes the major release.

Do not trigger major release solely because energy is high.

The actor-local state machine owns actual lift, hold, fall, braking, rebound,
and settling.

---

## 26. RollerCoaster contract

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

Musical state may influence:

- drive
- restraint
- braking tendency
- available momentum

Actor simulation owns:

- routeDistance
- velocity
- acceleration
- gravity
- drag
- route-segment behavior

Never map:

```text
phraseProgress
→ routeDistance directly
```

The newer segmented route architecture is canonical.

The old closed-circuit RollerCoaster is reference-only.

---

## 27. Free Bodies / Orb contract

Free Bodies are intended to consume:

```text
AudioWorld atmospheric / spectral conditions
+
PhysicsWorld forces
```

They should be genuine Dynamic Bodies.

Possible state:

- position
- velocity
- mass
- drag
- turbulence
- collision response
- exclusion response

Do not implement final Free Bodies as simple decorative sine-wave particles if
the milestone requires real physical participation.

---

## 28. PhysicsWorld

PhysicsWorld owns shared spatial causality.

Participants may register as:

```text
Force Source
Physics Receiver
Collider / Exclusion Zone
Dynamic Body
```

A participant may combine roles.

Examples:

```text
RollerCoaster
→ autonomous actor + future Force Source
```

```text
Anchored Content
→ Physics Receiver
```

```text
Free Orb
→ Receiver + Collider + Dynamic Body
```

Page/content objects may participate.

Cross-object effects should emerge through PhysicsWorld.

---

## 29. Validated shared causality

The project has already validated:

```text
percussion event
→ BumperCars impulse
→ actual local collision
→ PhysicsWorld impact
→ Anchored Content Participant
→ bounded response
→ spring recovery
```

This is now an established architecture contract.

The Anchored Content Participant does not subscribe directly to AudioWorld.

Preserve this distinction.

---

## 30. Layout ownership

Ordinary content retains authored layout ownership.

Use:

```text
current authored layout
+
temporary physics response
=
rendered transform
```

PhysicsWorld must not own responsive layout.

When physical response settles:

```text
physics offset → zero
```

The object returns to its current authored anchor.

If layout changes, the anchor changes with it.

Do not recover toward obsolete startup coordinates.

---

## 31. Spatial coordinate contract

PhysicsWorld requires one explicit canonical coordinate space per experience.

Do not implicitly mix:

- actor-local coordinates
- DOM layout coordinates
- SVG coordinates
- Canvas coordinates
- Three.js coordinates
- viewport coordinates
- camera-projected coordinates

without an adapter.

Use:

```text
Actor / Content Geometry
→ Spatial Adapter
→ PhysicsWorld Coordinates
→ Physical Interaction
→ Renderer Adapter
```

Camera movement, scrolling, responsive layout, or host movement must not become
fake physical velocity.

---

## 32. Shared source types

PhysicsWorld may contain physically different shared effects.

Examples:

### Transient impact

Produced by:

```text
BumperCars real collision
```

Properties may include:

- position
- normal
- strength
- radius
- timestamp

---

### Continuous directional field / wake

Future example:

```text
RollerCoaster actual movement
→ directional wake
```

Properties may include:

- moving position
- forward direction
- physical speed
- radius
- strength
- active lifetime

Do not collapse physically different semantics merely to force one universal
event shape.

Keep the distinction minimal and explicit.

---

## 33. PhysicsWorld must see physical results

PhysicsWorld should receive physical facts.

It should not receive upstream musical semantics when a physical actor is
supposed to mediate the effect.

Correct:

```text
phrase energy
→ RollerCoaster simulation
→ actual speed
→ wake strength
```

Wrong:

```text
phrase energy
→ PhysicsWorld wake strength
```

Likewise:

Correct:

```text
kick
→ BumperCars impulse
→ actual collision
→ shared impact
```

Wrong:

```text
kick
→ shared collision effect
```

This distinction is central to Z.land.

---

## 34. Cross-actor causality

Preferred causal chain:

```text
AudioWorld
↓
Actor A
↓
Actor A simulation
↓
actual spatial force / event
↓
PhysicsWorld
↓
Actor B / Content
↓
secondary physical response
```

Avoid synchronization disguised as physics.

If one object is claimed to affect another physically, the effect must arise
through the shared world.

---

## 35. MotionWorld relationship

MotionWorld and AudioWorld are sibling domains.

```text
MotionWorld
→ page / scroll choreography

AudioWorld
→ musical time / musical truth
```

The Music Box does not require scroll to drive music.

Do not make song time depend on page scroll by default.

The current vertical development page is only an engineering layout.

---

## 36. Current development layout

The current vertically stacked page is a temporary development workbench.

It exists for:

- actor isolation
- manual QA
- DebugConsole visibility
- regression inspection
- integration testing

It is NOT the committed final Z.land experience.

Do not optimize the architecture around:

```text
actor card
↓
scroll
↓
actor card
```

Final composition may place multiple actors simultaneously inside one persistent
shared spatial world.

---

## 37. Future Experience Composition / Park Map

After core musical and physical systems are validated, a dedicated experience
composition milestone may create:

```text
persistent Park Map / Spatial Score
```

Possible characteristics:

- multiple actors visible simultaneously
- actor districts
- RollerCoaster traversing larger portions of the land
- shared Free Bodies crossing boundaries
- Gate / Ticket Booth at the park edge
- subtle region emphasis
- actor-local precise musical hits
- physical cross-world interactions
- restrained camera / zoom behavior

The map should not become a set of six dashboard modules.

---

## 38. Visual comprehension

The final audience should not need prior music-theory knowledge.

Prefer:

```text
behavior first
terminology second
```

For example, a visitor may understand:

- one local carrier follows a melodic note
- several cabins activate together as a chord
- BumperCars respond to impacts
- PirateShip embodies swing
- DropTower anticipates a major release
- RollerCoaster expresses larger phrase motion

without needing large technical labels.

Music-theory terminology may appear in:

- debug mode
- info mode
- optional legend
- ticket summary
- educational overlay

but should not be required to understand the experience.

---

## 39. Rendering boundary

Renderers visualize simulation state.

They do not own simulation truth.

Potential renderers include:

- DOM
- SVG
- Canvas
- Three.js
- WebGL
- shaders

Changing renderer technology should not require redesigning:

- AudioWorld
- Musical Evidence
- actor simulation
- PhysicsWorld

---

## 40. ControlSurface

ControlSurface is audience-facing.

Current working metaphor:

```text
Z.land Gate + Ticket Booth
```

Possible actions:

- bring/load song
- prepare/analyze song
- inspect ticket
- enter park
- play
- pause
- seek
- restart
- change song
- exit/reset

ControlSurface requests actions.

It does not own AudioClock or AudioWorld state.

The Gate / Ticket Booth visual metaphor remains replaceable.

---

## 41. DebugConsole

DebugConsole is developer-facing.

It may expose:

### Transport

- current time
- duration
- play state
- AudioMap identity

### Musical Evidence

- domain availability
- exact melody note
- note progress
- chord
- chord tones
- beat / bar / phase
- groove
- swing
- structure
- build
- tension
- phrase state
- spectrum
- event history

### Actor State

- simulation mode
- position
- velocity
- acceleration
- angular state
- route state
- settling state

### PhysicsWorld

- registered sources
- receivers
- impacts
- wake fields
- source positions
- force vectors
- response offsets
- settling state

### Determinism

- random seed
- deterministic initial state

DebugConsole may remain visually utilitarian.

Observability is more important than presentation.

---

## 42. Determinism

Emergent behavior does not mean untestable randomness.

Where stochastic behavior exists:

- use explicit seeded randomness during development
- expose relevant seeds in DebugConsole when useful
- avoid uncontrolled random calls in simulation loops
- preserve reproducibility for debugging

Given:

```text
same AudioMap
same initial state
same parameters
same seed
```

the system should be reproducible enough to investigate.

---

## 43. Performance and lifecycle

Prefer:

- one authoritative musical clock
- deterministic AudioMap lookup
- actor-local simulation
- bounded dt
- explicit wake / sleep
- clear setup / disposal
- renderer-independent simulation
- no per-frame application-level React state
- minimal hot-loop layout measurement

Avoid:

- duplicate audio analysis
- duplicate global listeners
- independent clocks per actor
- uncontrolled randomness
- renderer state becoming simulation truth
- giant world components
- unnecessary global rerenders

Runtime performance must be measured.

Do not claim stable performance from source inspection alone.

---

## 44. Reduced motion

Reduced-motion behavior should preserve semantic identity.

Examples:

```text
Carousel
→ preserve exact note identity
```

```text
FerrisWheel
→ preserve exact harmonic carriers
```

```text
PirateShip
→ preserve rhythmic-phase identity
```

```text
DropTower
→ preserve build / hold / release semantics
```

Do not replace actor meaning with unrelated visual flashes.

---

## 45. Subjective QA boundary

Automated tests and Codex may verify objective facts.

Examples:

- tests pass
- typecheck passes
- build passes
- actor is mounted
- event delivery is correct
- note carrier matches note identity
- chord carriers match chord tones
- values remain bounded
- PhysicsWorld source is registered
- receiver response is spatially correct
- no NaN / Infinity
- reduced-motion branch executes

Codex must not self-approve subjective qualities such as:

- visual quality
- mechanical feel
- musical feel
- tension
- pacing
- spatial composition
- map readability
- aesthetic correctness

The user performs final subjective QA.

---

## 46. Migration of existing Z.land work

Existing validated simulations are assets.

When migrating:

1. locate canonical implementation
2. identify pure geometry
3. identify pure simulation
4. identify actor state
5. identify renderer code
6. identify Framer-only code
7. extract without changing validated behavior
8. verify parity
9. connect current AudioWorld / PhysicsWorld
10. change presentation only when required

Do not rewrite validated behavior merely to make integration easier.

Detailed classifications belong in:

```text
legacy-reuse.md
```

---

## 47. Current validated state

The project currently validates:

```text
Carousel
→ melody / note evidence

FerrisWheel
→ harmony / chord-tone evidence

PirateShip
→ groove / swing

BumperCars
→ percussion

DropTower
→ build / tension / explicit drop

RollerCoaster
→ phrase / energy / tension / release
```

Shared-world validation includes:

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
→ anchored content rendering
```

These are established contracts.

Do not regress them.

---

## 48. Current near-term sequence

### Milestone 6B

Validate:

```text
AudioWorld phrase
→ RollerCoaster actual simulation
→ actual position / forward / physical speed
→ PhysicsWorld directional wake
→ Anchored Content Participant
```

Wake must derive from actual physical motion.

Not directly from musical energy.

---

### Milestone 7A

Validate:

```text
AudioWorld spectrum / texture
+
PhysicsWorld forces
→ Free Bodies / Orb simulation
```

Free Bodies become genuine Dynamic Bodies.

---

### After world-physics foundations

Begin dedicated:

```text
Experience Composition
→ Park Map
→ Spatial Score
```

Only then should significant final-layout work begin.

The current vertical development workbench remains temporary until that stage.

---

## 49. Architecture invariant

When uncertain about a feature, ask:

```text
Is this actually true in the music?
→ Musical Evidence / AudioWorld

What does that truth mean to this machine?
→ Actor Interpretation

What state does the machine physically simulate?
→ Actor Simulation

What physical consequence reaches the rest of the world?
→ PhysicsWorld

How should the visitor notice and understand it?
→ Experience Composition
```

Do not answer one question inside the wrong layer.

The canonical architecture remains:

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
→ a spatial score that can be watched and explored
```