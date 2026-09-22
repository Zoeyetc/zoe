# Z.land Music Box — Architecture v0.2

## 1. System definition

Z.land Music Box is a shared computational physical world driven by musical
meaning.

It is not a conventional audio visualizer.

It is not a collection of independent ride animations synchronized to the same
song.

The system does not map raw audio amplitude directly to arbitrary visual motion.

Its primary causal chain is:

```text
Music
↓
Musical Meaning
↓
Actor
↓
Physics
↓
World
```

A song provides musical conditions.

Actors interpret those conditions according to their own motion language.

PhysicsWorld propagates physical consequences between participants.

The resulting performance emerges from:

```text
musical structure
+
actor behavior
+
shared physical causality
```

The architecture intentionally separates:

- audio analysis
- musical transport
- musical interpretation
- actor simulation
- shared physics
- rendering
- audience controls
- developer instrumentation

These domains may evolve independently.

---

## 2. Core ownership rule

The system must never have multiple competing owners of the same truth.

Use this ownership model:

```text
Analysis Pipeline
→ describes the complete source

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
→ requests user-facing actions

DebugConsole
→ observes system truth
```

No layer should silently take over another layer's responsibility merely to
simplify implementation.

---

## 3. High-level architecture

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
                         AudioWorld
                    ┌─────────┴─────────┐
                    │                   │
              AudioSnapshot        AudioEvents
               continuous            discrete
                    │                   │
                    └─────────┬─────────┘
                              │
                              ▼
                            ACTORS
          ┌───────────────────┼───────────────────┐
          │                   │                   │
       Carousel           FerrisWheel        PirateShip
      BumperCars          DropTower        RollerCoaster
          │                   │                   │
          └───────────────────┼───────────────────┘
                              │
                              ▼
                         PhysicsWorld
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
        Text                Image            Free Bodies
        CMS                 Button               Orb
        Logo                Navigation       Other Actors
```

AudioWorld describes music.

Actors interpret music.

PhysicsWorld propagates spatial consequences.

Renderers display the world.

---

## 4. Audio analysis boundary

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

During early development, AudioMap may come from:

- authored test data
- deterministic fixtures
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

Changing the analysis implementation must not require actor simulations,
PhysicsWorld, or renderers to be rewritten.

Heavy analysis may eventually run:

- in the browser
- in a worker
- in a local preprocessing tool
- in a backend service

The runtime contract remains AudioMap.

---

## 5. Partial musical understanding

AudioMap must support incomplete analysis.

A song may provide:

```text
melody      available
rhythm      available
harmony     uncertain
structure   available
spectrum    available
```

or:

```text
melody      unavailable
rhythm      available
harmony     unavailable
energy      available
```

The system must not fabricate confident musical information simply to activate
every actor.

Each musical domain should expose availability and, where relevant, confidence.

Conceptually:

```ts
type MusicalCapabilities = {
    rhythm: boolean
    melody: boolean
    harmony: boolean
    structure: boolean
    spectrum: boolean
}
```

An unavailable musical domain must degrade gracefully.

The corresponding actor may:

- remain resting
- use a musically defensible fallback
- remain physically present without expressive musical behavior

A smaller valid performance is preferable to a false complete performance.

---

## 6. AudioMap

AudioMap describes the musical structure of the complete source.

It is timeline data.

It is not the current runtime state.

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

The exact analysis representation may evolve.

Do not add fields merely because they might become useful later.

A field should exist because:

- a current actor requires it
- a current Story Map milestone requires it
- DebugConsole needs it to verify system truth

AudioMap should be serializable so deterministic fixtures and prepared maps can
be loaded without running the analysis pipeline.

---

## 7. AudioClock

AudioClock owns authoritative musical transport time.

When real audio is used, musical time must ultimately derive from the Web Audio
transport clock.

AudioClock is responsible for:

- play
- pause
- seek
- restart
- current musical time
- duration
- transport state

`requestAnimationFrame` is NOT the musical clock.

`requestAnimationFrame` only provides rendering opportunities.

Correct relationship:

```text
AudioClock
    │
    ▼
current musical time
    │
    ▼
AudioWorld
    │
    ▼
musical truth
    │
    ├──────────────► Actor simulation
    │
    └──────────────► Renderer on next available frame
```

If rendering drops frames, musical time remains authoritative.

The visual system should synchronize to the correct musical state rather than
allowing musical timing to drift with rendering performance.

---

## 8. AudioWorld

AudioWorld owns musical truth at runtime.

AudioWorld consumes:

```text
AudioMap
+
AudioClock time
```

and exposes two fundamentally different outputs:

```text
AudioSnapshot
+
AudioEvents
```

AudioWorld may also expose transport commands or a transport facade, but it
does not own:

- ride geometry
- ride simulation
- collisions
- visual transforms
- world rendering
- page layout
- camera movement

Individual actors must not independently analyze the same raw audio source.

---

## 9. AudioSnapshot

AudioSnapshot represents continuous musical truth at a specific transport time.

Where practical:

```text
AudioMap + musical time
→ deterministic AudioSnapshot
```

The same AudioMap and same musical time should produce the same continuous
musical snapshot.

The public snapshot should be treated as immutable by consumers.

Initial v0.1 contract:

```ts
type AudioSnapshot = Readonly<{
    transport: {
        time: number
        duration: number
        progress: number
        playing: boolean
    }

    rhythm: {
        available: boolean
        bpm: number | null
        beatIndex: number | null
        beatInBar: number | null
        beatPhase: number
        barIndex: number | null
        barPhase: number
        groove: number
        swing: number
    }

    melody: {
        available: boolean
        active: boolean
        midi: number | null
        pitchHz: number | null
        noteName: string | null
        noteProgress: number
        intensity: number
        confidence: number
    }

    harmony: {
        available: boolean
        chord: string | null
        rootPitchClass: number | null
        confidence: number
    }

    structure: {
        available: boolean
        section: string | null
        sectionProgress: number
        phraseProgress: number
        energy: number
        tension: number
        build: number
    }

    spectrum: {
        available: boolean
        low: number
        mid: number
        high: number
        bassEnergy: number
        brightness: number
        texture: number
    }
}>
```

Normalized scalar values such as:

- energy
- tension
- build
- groove
- swing
- brightness
- texture

should normally remain within a documented normalized range, preferably:

```text
0 → 1
```

unless a field explicitly uses physical or musical units.

This contract is v0.1.

Do not treat every field as permanently fixed if later musical evidence shows
that a different representation is necessary.

---

## 10. AudioEvents

Short musical occurrences must not depend on a rendering frame landing exactly
on their timestamp.

Discrete musical occurrences therefore use events.

Initial event categories may include:

```ts
type AudioEvent =
    | NoteOnEvent
    | NoteOffEvent
    | BeatEvent
    | DownbeatEvent
    | KickEvent
    | SnareEvent
    | HatEvent
    | ChordChangeEvent
    | SectionChangeEvent
    | DropEvent
    | SeekEvent
```

Conceptually:

```ts
type NoteOnEvent = {
    type: "note-on"
    time: number
    midi: number
    intensity: number
}

type KickEvent = {
    type: "kick"
    time: number
    strength: number
}

type DropEvent = {
    type: "drop"
    time: number
    strength: number
}

type SeekEvent = {
    type: "seek"
    from: number
    to: number
}
```

Events must be emitted by timeline-crossing logic.

Do not model a short musical event only as:

```ts
kick: true
```

inside a frame snapshot.

---

## 11. Event delivery

AudioWorld must distinguish:

```text
continuous state
```

from:

```text
timeline crossings
```

During ordinary forward playback:

```text
previous transport time
→ current transport time
```

AudioWorld may emit discrete events whose timestamps were crossed during that
interval.

This prevents short events from being missed when rendering or polling does
not occur exactly on an event timestamp.

Event delivery must not depend on frame rate.

The same event must not be emitted repeatedly merely because several render
frames occur while its timestamp remains nearby.

---

## 12. Seek semantics

Seeking is synchronization, not playback.

Example:

```text
12s
 │
 └──────────── seek ────────────► 32s
```

The system must NOT replay every musical event between 12s and 32s.

Correct behavior:

```text
seek
↓
AudioClock = 32s
↓
recalculate AudioSnapshot at 32s
↓
emit seek transport event
↓
actors synchronize to 32s musical state
```

Historical:

- beats
- kicks
- notes
- drops
- collisions

between the old and new transport positions are not replayed.

Event cursors must be reset to the new transport position.

Events after the new position resume normally.

Actor-specific synchronization behavior is defined by each actor contract.

---

## 13. Pause, restart, and song replacement

### Pause

Pausing stops musical transport.

It does not automatically erase physical energy already present in the world.

Example:

```text
Kick
↓
BumperCar receives impulse
↓
PAUSE
↓
AudioClock stops
↓
car continues moving
↓
PhysicsWorld damping eventually settles it
```

Therefore:

```text
Audio pause ≠ Physics reset
```

Actor-specific pause behavior may differ where musically necessary.

---

### Restart

Restart returns musical transport to the beginning.

Restart must synchronize musical state to time zero.

The physical world does not need to teleport blindly to its initial state.

Actors may define controlled reset or reconciliation behavior.

---

### Song replacement

Replacing a song must not require reconstructing the complete application.

Conceptually:

```text
same park
+
new AudioMap
=
new musical conditions
```

Actors and PhysicsWorld remain systems.

The current musical source changes.

---

## 14. Actor layer

Actors are autonomous physical interpreters.

Each actor receives semantic musical information and decides what that
information means within its own motion model.

AudioWorld must not command visual transforms directly.

Wrong:

```text
AudioWorld:
"rotate Carousel 14 degrees"
```

Correct:

```text
AudioWorld:
"active melodic note = G4"
```

then:

```text
Carousel:
"G4 changes my current musical target"
```

then:

```text
Carousel simulation:
calculates movement
```

Actors retain high-frequency simulation state locally where practical.

Actors may consume:

- continuous AudioSnapshot state
- discrete AudioEvents
- PhysicsWorld forces
- user interaction permitted by that actor

These inputs must remain explicit.

---

## 15. Current musical actor responsibilities

### Carousel

Primary musical domain:

- melody
- pitch
- note expression

Physical language:

- orbit
- angular velocity
- inertia
- targeting
- individual rider vertical movement

Existing Carousel mechanics worth preserving:

- orbital projection
- angular motion
- inertia
- targeting / selected-item motion

Its existing independent decorative bob clock must eventually be separated
from musical note expression.

AudioWorld becomes the source of musical timing.

---

### FerrisWheel

Primary musical domain:

- harmony
- chords
- sustained harmonic relationships

Physical language:

- slow rotation
- suspended cabins
- secondary swing
- harmonic persistence

FerrisWheel must not duplicate Carousel melody behavior.

---

### PirateShip

Primary musical domain:

- groove
- swing
- continuous rhythmic phase

Physical language:

- pendulum
- oscillation
- weight transfer
- phase relationship

PirateShip is not a percussion trigger visualizer.

It represents how the music swings.

---

### BumperCars

Primary musical domain:

- percussion
- rhythmic impulses

Physical language:

- linear impulse
- angular impulse
- collisions
- secondary collisions
- wall response

Audio creates initial impulses.

Subsequent collisions belong to physics.

---

### DropTower

Primary musical domain:

- build
- tension
- major drop
- large accent
- bass impact

Physical language:

- lift
- hold
- release
- fall
- rebound

DropTower does not respond to every ordinary beat.

---

### RollerCoaster

Primary musical domain:

- phrase
- energy trajectory
- tension
- release
- large-scale musical development

Physical language:

- constrained route
- momentum
- velocity
- acceleration
- airflow

RollerCoaster operates on a longer musical timescale than ordinary percussion.

The newer segmented RollerCoaster architecture is the canonical baseline.

The old closed-circuit version is reference-only.

---

### Free Bodies / Orb / Balloon

Primary musical domain:

- texture
- atmosphere
- brightness
- spectral ambience

Physical language:

- free-body movement
- turbulence
- buoyancy-like motion
- collision response
- exclusion response

These bodies must also remain capable of responding to PhysicsWorld forces from
other actors.

The final visual representation does not need to be a literal balloon.

---

## 16. PhysicsWorld

PhysicsWorld owns shared spatial causality.

Participants may register one or more roles:

```text
Force Source
Physics Receiver
Collider / Exclusion Zone
Dynamic Body
```

A participant may have multiple roles.

Examples:

```text
RollerCoaster
Force Source ✓
Dynamic Body / autonomous actor ✓
```

```text
Project Card
Physics Receiver ✓
Collider ✓
Dynamic Body ✗
```

```text
Free Orb
Physics Receiver ✓
Collider ✓
Dynamic Body ✓
```

Page/content objects may participate, including:

- Text
- Image
- CMS content
- Button
- Navigation
- Logo
- Icon
- Shader object
- 3D object

Cross-object physical effects should emerge through PhysicsWorld.

Do not author duplicate visual animations merely to make two objects appear to
interact.

---

## 17. Spatial coordinate contract

PhysicsWorld requires an explicit spatial contract.

Do not implicitly mix:

- viewport coordinates
- DOM layout coordinates
- SVG coordinates
- Three.js world coordinates
- camera-projected coordinates

without an adapter.

The preferred conceptual model is:

```text
Actor / Content Geometry
        ↓
Spatial Adapter
        ↓
PhysicsWorld coordinates
        ↓
Physics interaction
        ↓
Renderer adapter
```

PhysicsWorld should operate in a documented canonical coordinate space for the
current experience.

Renderers may project that space differently.

DOM/SVG/Canvas/Three.js integrations may provide adapters.

Camera movement, page scrolling, or host-container movement must not
automatically become fictitious actor velocity.

If an object moves only because its camera or viewport moved, PhysicsWorld
should not interpret that as a physical impulse unless explicitly intended.

This contract is especially important for:

- RollerCoaster airflow
- free-body trajectories
- content receivers
- exclusion colliders
- future 3D actors

Do not hide coordinate conversion inside unrelated actor logic.

---

## 18. Cross-actor causality

Preferred causal chain:

```text
AudioWorld
↓
Actor A
↓
Actor A simulation
↓
Actor A spatial movement / force
↓
PhysicsWorld
↓
Actor B / Content
↓
secondary physical response
```

Example:

```text
phrase energy rises
↓
RollerCoaster accelerates
↓
airflow strength increases
↓
Orb receives spatial force
↓
Orb trajectory changes
```

Avoid:

```text
phrase energy
↓
RollerCoaster visual animation

phrase energy
↓
separate Orb visual animation
```

The latter creates synchronization but not physical causality.

Cross-actor responses must arise from world relationships whenever the concept
claims that one object physically affected another.

---

## 19. Simulation determinism and randomness

The project may contain emergent physical behavior.

Emergence does not mean untestable randomness.

Where stochastic behavior is used:

- use explicit seeded randomness during development and tests
- make the seed observable through DebugConsole when useful
- do not call uncontrolled random values throughout simulation hot paths
- preserve reproducibility when debugging a specific performance

Given:

```text
same AudioMap
same initial world state
same simulation parameters
same seed
```

the system should be reproducible enough to investigate behavior.

A final artistic mode may intentionally randomize the seed between performances.

That artistic choice must remain separate from engineering reproducibility.

---

## 20. Experience hierarchy boundary

Musical activity and visual dominance are not the same concept.

A loud musical section does not imply that every actor becomes visually
dominant.

Experience hierarchy may classify actors as:

```text
Primary
Secondary
Ambient
Resting
```

This hierarchy belongs to the experience / direction layer.

It may influence:

- camera attention
- lighting
- renderer detail
- opacity where appropriate
- visual emphasis
- framing

It must not silently rewrite the actor's physical simulation solely to make the
composition cleaner.

Actor physics and experience emphasis remain separate concerns.

Detailed hierarchy behavior belongs in `story-map.md` and actor-specific
experience design.

---

## 21. Rendering and camera boundary

Renderers visualize simulation state.

They do not own simulation truth.

Potential renderers may include:

- DOM
- SVG
- Canvas
- Three.js
- WebGL
- shaders

Changing a renderer should not require:

- musical analysis
- AudioWorld
- actor simulation
- PhysicsWorld

to be redesigned.

Camera and viewpoint are also presentation concerns.

Camera movement may guide attention but must not create false physical
causality.

A camera passing an object does not create a PhysicsWorld force unless the
experience explicitly defines such an interaction.

---

## 22. MotionWorld relationship

MotionWorld and AudioWorld are sibling input/director domains.

```text
                 Z.land World
                      ▲
                      │
           ┌──────────┴──────────┐
           │                     │
      MotionWorld            AudioWorld
         scroll                music
```

MotionWorld may own:

- scroll choreography
- section progress
- viewport ownership
- page-level motion hierarchy

AudioWorld owns:

- musical transport truth
- musical interpretation state
- musical timeline events

The Music Box prototype does not require MotionWorld.

Do not force existing scroll choreography into AudioWorld.

A future experience may combine both through explicit contracts.

Neither becomes authoritative over the other's domain.

---

## 23. ControlSurface

Reserve an audience-facing control boundary.

Current working metaphor:

```text
Z.land Gate + Ticket Booth
```

Possible actions:

- bring/load a song
- prepare/analyze song
- inspect song ticket
- enter park
- play
- pause
- seek
- restart
- change song
- exit/reset

Possible narrative:

```text
Song
↓
Ticket preparation
↓
Ticket issued
↓
Admit One Song
↓
Gate opens
↓
Audio transport starts
↓
Park performs
```

ControlSurface calls world APIs.

It does not own AudioWorld state.

The gate/ticket-booth visual metaphor is replaceable.

A future ControlSurface may look completely different without requiring core
world systems to change.

---

## 24. DebugConsole

DebugConsole is separate from ControlSurface.

It exists for development and validation.

It may expose:

### Transport

- current time
- duration
- playing
- current AudioMap ID

### Analysis capability

- rhythm available
- melody available
- harmony available
- structure available
- spectrum available

### Rhythm

- BPM
- bar
- beat
- beat phase
- groove
- swing

### Melody

- active note
- MIDI
- pitch
- note progress
- confidence

### Harmony

- chord
- root
- confidence

### Structure

- section
- phrase
- energy
- tension
- build

### Spectrum

- low
- mid
- high
- bass energy
- brightness
- texture

### Events

- latest AudioEvent
- event timestamp
- event strength

### Actor state

- actor mode
- actor-local state
- simulation awake/asleep

### Physics

- registered sources
- registered receivers
- colliders
- dynamic bodies
- current force interactions
- world settling state

### Determinism

- random seed where applicable

DebugConsole may remain visually utilitarian.

Observability is more important than presentation.

---

## 25. Performance and lifecycle model

Prefer:

- one authoritative musical clock
- deterministic AudioMap lookup
- actor-local simulation
- bounded simulation dt
- explicit wake / sleep behavior
- PhysicsWorld registration
- clear setup / disposal
- imperative high-frequency rendering where appropriate
- worker/off-main-thread analysis when later justified

Avoid:

- per-frame global React state
- duplicate audio analysis
- duplicate global listeners
- independent musical clocks per actor
- avoidable layout measurement in hot loops
- uncontrolled random behavior
- one giant world component containing every simulation
- renderer state becoming simulation truth

The world may contain multiple simulations.

It should not contain multiple competing truths.

Performance must be measured in runtime.

Do not claim a stable frame rate from source inspection alone.

---

## 26. Migration of existing Z.land work

Existing validated simulations are assets.

When migrating an existing actor:

1. Locate the canonical implementation.
2. Identify pure geometry.
3. Identify pure simulation.
4. Identify actor state.
5. Identify renderer code.
6. Identify Framer-only code.
7. Extract simulation without changing behavior.
8. Verify parity.
9. Only then connect AudioWorld.
10. Only then change presentation when the current milestone requires it.

Do not rewrite validated ride behavior merely to make integration easier.

Do not migrate legacy Framer scaffolding into the standalone core unless it
serves a current requirement.

Framer-specific concerns such as:

- Property Controls
- RenderTarget guards
- Canvas adapters
- legacy scene choreography
- legacy section maps

belong in adapters or reference material, not core simulation.

Detailed migration decisions belong in `legacy-reuse.md`.

---

## 27. First vertical milestone

Do not migrate the entire park first.

The first end-to-end implementation is:

```text
Authored AudioMap
↓
AudioClock
↓
AudioWorld
├── AudioSnapshot
└── AudioEvents
↓
Carousel
↓
observable melody response
```

Required behaviors:

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
- debug visibility

The initial interface is intentionally utilitarian.

ControlSurface APIs may be reserved, but final Gate / Ticket Booth visuals are
not part of this milestone.

PhysicsWorld does not need to be fully exercised in the first milestone unless
Carousel requires it.

Only after this vertical path is stable should a second musical actor be
integrated.

---

## 28. Second vertical milestone principle

The second actor should consume a different kind of musical information from
Carousel.

Do not choose the second actor merely because it is easiest to migrate.

The purpose is to verify that AudioWorld supports multiple semantic domains.

Good examples include:

```text
Carousel
→ note-scale continuous + discrete melody information
```

paired with:

```text
BumperCars
→ discrete percussion events
```

or:

```text
PirateShip
→ continuous groove / phase information
```

The specific second actor is selected after milestone one is stable.

---

## 29. Architecture invariant

When uncertain about where new behavior belongs, ask:

> Is this describing the music, interpreting the music, propagating physical
> consequences, or displaying the result?

The answer determines ownership:

```text
describing music
→ AudioWorld

interpreting music
→ Actor

propagating physical consequences
→ PhysicsWorld

displaying result
→ Renderer
```

For interaction controls, also ask:

```text
requesting user action
→ ControlSurface

observing system truth
→ DebugConsole
```

For complete-song understanding:

```text
deriving AudioMap
→ Analysis Pipeline
```

Do not blur these boundaries without an explicit architecture decision.

The canonical causal spine remains:

```text
Music
→ Meaning
→ Actor
→ Physics
→ World
```