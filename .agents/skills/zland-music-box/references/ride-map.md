# Z.land Music Box — Ride Map v0.1

## 1. Purpose

This document defines the current musical and physical responsibilities of
Z.land Music Box actors.

It exists to prevent role drift.

Each actor must have:

- a distinct musical responsibility
- a distinct physical language
- actor-local simulation ownership
- explicit AudioWorld inputs
- explicit PhysicsWorld roles
- explicit seek / pause / reset behavior
- a renderer that does not become simulation truth

The current actor set is:

```text
Carousel
FerrisWheel
PirateShip
BumperCars
DropTower
RollerCoaster
Free Bodies / Orb / Balloon
```

These mappings are current design contracts.

Do not silently reassign musical responsibilities between actors.

---

# 2. Shared actor contract

All musical actors conceptually follow:

```text
AudioWorld
    ↓
musical state / events
    ↓
Actor Interpretation
    ↓
Actor-local Simulation
    ↓
Physical State
    ↓
PhysicsWorld registration
    ↓
Renderer
```

An actor may consume:

- continuous AudioSnapshot values
- discrete AudioEvents
- PhysicsWorld forces
- user interaction explicitly allowed by that actor

An actor must not independently analyze the raw audio source.

An actor must not own the authoritative musical clock.

---

# 3. Shared actor lifecycle

Every actor should eventually support the following conceptual lifecycle:

```text
initialize
↓
idle / resting
↓
musically active
↓
physical simulation
↓
settling
↓
resting
```

Actors may remain physically present while musically inactive.

Inactive does not necessarily mean hidden.

---

# 4. Shared synchronization rules

## Play

When musical transport begins:

- the actor reads the current AudioSnapshot
- relevant future AudioEvents may affect it
- it must not assume playback always starts from time zero

---

## Pause

Pause stops new musical progression.

Pause does not automatically erase actor velocity or PhysicsWorld energy.

Actor-specific behavior determines whether:

- existing motion continues
- motion damps naturally
- a held musical state is preserved
- an actor deliberately freezes for musical reasons

Pause behavior must be explicit per actor.

---

## Seek

Seek is synchronization.

It is not historical playback.

On seek:

```text
old time
↓
seek
↓
new AudioSnapshot
↓
actor reconciles
```

The actor must not replay every skipped musical event.

Actor-specific seek behavior must define:

- which continuous state synchronizes immediately
- which physical state is preserved
- which transient state is discarded
- whether a controlled visual reconciliation is required

---

## Restart

Restart moves musical transport to time zero.

Actor state may:

- reset immediately
- settle back
- use a controlled reset transition

depending on actor semantics.

Do not assume all actors must teleport to initial state.

---

## Song replacement

Replacing AudioMap must not require actor implementation to be recreated.

Actors receive a new musical source through AudioWorld.

Actor-specific state may need reset or reconciliation.

---

# 5. Musical timescale hierarchy

Actors intentionally operate at different musical timescales.

```text
fast transient
│
├── BumperCars
│
├── Carousel note events
│
├── PirateShip rhythmic phase
│
├── FerrisWheel harmony
│
├── RollerCoaster phrase
│
└── DropTower structural event
│
slow structural
```

Free Bodies may operate across several timescales depending on atmosphere and
PhysicsWorld input.

Do not make every actor react visibly to every beat.

---

# 6. Carousel

## Musical responsibility

Carousel represents:

```text
MELODY
PITCH
NOTE EXPRESSION
```

It is the primary melodic actor.

Carousel must not become the harmony actor.

Carousel must not become the general rhythm actor.

---

## Core musical inputs

### Continuous

From AudioSnapshot:

```text
melody.available
melody.active
melody.midi
melody.pitchHz
melody.noteProgress
melody.intensity
melody.confidence

rhythm.bpm
transport.time
```

BPM may influence broad rotational pacing, but must not replace melodic
interpretation.

---

### Discrete

From AudioEvents:

```text
note-on
note-off
seek
```

Potential future events:

```text
phrase-change
melodic-accent
```

only if Story Map later requires them.

---

## Physical language

Carousel owns:

```text
orbit
angular position
angular velocity
angular inertia
rider targeting
individual rider vertical expression
```

The Carousel should feel like one mechanical rotational system.

It is not a set of independently animated icons.

---

## Existing useful mechanics

Existing Carousel work already contains useful ideas:

- orbital distribution
- projection
- angular velocity
- inertia
- drag interaction
- selected-item targeting
- front/back depth ordering

These mechanics should be preserved when migrating.

Its existing decorative bob clock must not remain the source of musical
vertical motion.

---

## Melody interpretation

Conceptually:

```text
pitch
↓
vertical target / rider height
```

```text
note-on
↓
activate / emphasize melodic rider
```

```text
note duration
↓
expression envelope
```

```text
note intensity
↓
response amplitude
```

```text
phrase movement
↓
overall rotational development
```

The exact visual mapping is not locked.

---

## Important constraint

Do not force the entire Carousel to rotate to a new selected rider on every
rapid melody note.

Fast melody would produce visual twitching.

Separate:

```text
overall Carousel motion
```

from:

```text
individual note expression
```

---

## Actor-owned state

Likely actor-local state includes:

```text
angle
angularVelocity
targetAngle
riderStates[]
selected / active musical rider
expression envelopes
```

Exact implementation may evolve.

---

## PhysicsWorld roles

Carousel may register as:

```text
Dynamic Body / autonomous actor
Force Source — optional
Collider — optional
Physics Receiver — optional
```

Early milestone does not require Carousel to emit strong cross-world forces.

---

## Seek behavior

On seek:

- synchronize active melody state to the new AudioSnapshot
- discard obsolete note envelopes
- do not replay skipped note-on events
- reconcile Carousel presentation to the current musical phrase

Do not spin through every skipped note.

---

## Pause behavior

On pause:

- no new note events
- existing angular inertia may settle naturally
- current sustained note expression may remain or decay according to design

Do not automatically snap Carousel to zero angle.

---

## Reduced motion

Reduced-motion mode should preserve:

- current melody identity
- readable rider state

while reducing or removing continuous orbit and strong vertical motion.

---

# 7. FerrisWheel

## Musical responsibility

FerrisWheel represents:

```text
HARMONY
CHORDS
SUSTAINED HARMONIC RELATIONSHIPS
```

FerrisWheel must remain slower and more persistent than Carousel.

---

## Core musical inputs

### Continuous

```text
harmony.available
harmony.chord
harmony.rootPitchClass
harmony.confidence

structure.energy
transport.time
```

---

### Discrete

```text
chord-change
section-change — optional secondary use
seek
```

---

## Physical language

FerrisWheel owns:

```text
slow rotation
wheel angular velocity
suspended cabins
cabin swing
gravity-stabilized orientation
harmonic persistence
```

The characteristic FerrisWheel property is important:

> the wheel rotates while cabins remain gravity-oriented.

This distinguishes FerrisWheel from Carousel.

---

## Harmony interpretation

Potential mapping:

```text
chord identity
↓
cabin relationship / visual grouping
```

```text
chord duration
↓
sustained rotational state
```

```text
chord change
↓
slow transition / acceleration / cabin response
```

Do not make every chord produce a sudden impulse.

Harmony is persistent.

---

## Actor-owned state

Likely:

```text
wheelAngle
wheelAngularVelocity
cabins[]
cabinSwing[]
```

---

## PhysicsWorld roles

Potential:

```text
Dynamic Body / autonomous actor
Force Source — subtle / optional
Collider — optional
```

FerrisWheel should usually produce lower-frequency environmental effects than
RollerCoaster or BumperCars.

---

## Seek behavior

On seek:

- synchronize harmonic identity immediately
- wheel angle may reconcile continuously rather than teleport
- skipped chord changes are not replayed

---

## Pause behavior

FerrisWheel may continue slowly settling after musical pause.

Cabin swing may continue damping.

---

## Reduced motion

May preserve:

- static wheel composition
- harmonic grouping

while disabling sustained rotation.

---

# 8. PirateShip

## Musical responsibility

PirateShip represents:

```text
GROOVE
SWING
CONTINUOUS RHYTHMIC PHASE
```

PirateShip is not a percussion event visualizer.

---

## Core musical inputs

### Continuous

```text
rhythm.available
rhythm.beatPhase
rhythm.barPhase
rhythm.groove
rhythm.swing
rhythm.bpm
```

Potential secondary:

```text
structure.energy
```

---

### Discrete

PirateShip should require relatively few discrete musical events.

Possible:

```text
downbeat
seek
```

But continuous rhythmic phase remains primary.

---

## Physical language

PirateShip owns:

```text
pendulum angle
angular velocity
oscillation
weight transfer
period
amplitude
phase
```

---

## Groove interpretation

Conceptually:

```text
beatPhase
↓
pendulum phase relationship
```

```text
swing
↓
temporal asymmetry
```

```text
groove
↓
motion character / phase offset / amplitude response
```

```text
energy
↓
maximum expressive amplitude
```

PirateShip should not merely oscillate as a sine wave unrelated to musical
phase.

---

## Important constraint

Do not make audio directly set:

```text
shipAngle = beatPhase * angle
```

if doing so destroys the physical pendulum character.

Musical phase may influence targets or driving force.

The actor simulation still owns the physical motion.

---

## Actor-owned state

Likely:

```text
angle
angularVelocity
drive
targetPhase
amplitude
```

---

## PhysicsWorld roles

Potential:

```text
Dynamic Body
Force Source — optional periodic field
Collider — optional
```

---

## Seek behavior

On seek:

- synchronize musical phase target
- do not replay missed swings
- actor may reconcile from current physical angle toward new phase relationship

---

## Pause behavior

Musical drive stops.

Pendulum may continue physically oscillating and damping.

This is desirable.

---

## Reduced motion

Reduce amplitude substantially.

Preserve rhythmic identity through restrained movement if appropriate.

---

# 9. BumperCars

## Musical responsibility

BumperCars represent:

```text
PERCUSSION
TRANSIENT IMPULSES
COLLISION ENERGY
```

They are the primary discrete rhythmic physics actor.

---

## Core musical inputs

### Continuous

Optional:

```text
structure.energy
spectrum.bassEnergy
```

These may influence global cruise energy.

They must not replace event-driven impulses.

---

### Discrete

Primary:

```text
kick
snare
hat
beat
downbeat
seek
```

Not every implementation must use all percussion event types.

---

## Physical language

BumperCars own:

```text
position
velocity
heading
angularVelocity
collision bounds
body/body collision
wall collision
restitution
damping
```

---

## Percussion interpretation

Possible first mapping:

```text
kick
↓
strong linear impulse
```

```text
snare
↓
lateral or angular impulse
```

```text
hat
↓
small perturbation
```

```text
onset strength
↓
impulse magnitude
```

The exact mapping is provisional.

---

## Critical rule

AudioWorld creates the initial impulse.

AudioWorld does NOT author collision outcomes.

Correct:

```text
kick
↓
Car A impulse
↓
Car A hits Car B
↓
Car B moves
```

Incorrect:

```text
kick
↓
animate Car A collision

kick
↓
animate Car B response
```

---

## Actor-owned state

Likely:

```text
bodies[]
arena bounds
collision state
```

Each body may own:

```text
position
velocity
rotation
angularVelocity
mass
radius / bounds
```

---

## PhysicsWorld roles

Strong:

```text
Dynamic Body ✓
Collider ✓
Physics Receiver ✓
Force Source ✓ where appropriate
```

BumperCars are one of the clearest PhysicsWorld-native actors.

---

## Seek behavior

On seek:

- do not replay skipped percussion impulses
- current physical body state may be preserved or deliberately reconciled
- future percussion events resume from new transport time

The default should favor preserving current physical state rather than
teleporting every car.

---

## Pause behavior

No new percussion impulses.

Existing collisions and damping continue until the arena settles.

---

## Restart behavior

A deterministic development mode should be able to reset bodies using a known
initial seed/state.

---

## Reduced motion

Use substantially reduced impulse strength and collision movement.

A static fallback may be preferable depending on final accessibility design.

---

# 10. DropTower

## Musical responsibility

DropTower represents:

```text
BUILD
TENSION
MAJOR DROP
LARGE ACCENT
BASS IMPACT
```

DropTower does NOT respond to every beat.

---

## Core musical inputs

### Continuous

```text
structure.build
structure.tension
structure.energy
spectrum.bassEnergy
```

---

### Discrete

```text
drop
section-change — optional
major accent — future if needed
seek
```

---

## Physical language

DropTower owns:

```text
IDLE
LIFTING
HOLDING
DROPPING
REBOUND
SETTLING
```

Physical quantities may include:

```text
position
velocity
acceleration
lift motor
gravity
braking
rebound
```

---

## Musical interpretation

Conceptually:

```text
build 0 → 1
↓
lift progression / lift drive
```

```text
high tension
↓
hold
```

```text
drop event
↓
release
```

```text
bass energy
↓
drop / rebound expressive strength
```

---

## Important constraint

Do not force a DropTower release simply because:

```text
energy > threshold
```

when AudioMap explicitly provides a major `drop` event.

Structural event semantics should remain primary.

---

## Actor-owned state

Existing state machine should be preserved when migrated.

Do not replace it with a keyframe timeline.

---

## PhysicsWorld roles

Potential:

```text
Dynamic Body
Force Source
Collider
```

A major braking/rebound event may eventually emit environmental impulse.

---

## Seek behavior

Seek is especially important.

If the new time is:

```text
inside build
```

the tower should reconcile to the build state.

If:

```text
after drop
```

it must not replay the drop automatically merely because the seek crossed it.

The actor needs a state reconciliation function based on current AudioSnapshot
and nearby structural timeline information.

---

## Pause behavior

Possible behavior depends on current phase.

Examples:

```text
LIFTING
→ motor input pauses or actor holds
```

```text
DROPPING
→ physical fall should generally not freeze mid-air
```

This behavior must be designed explicitly during integration.

Do not assume one global pause rule fits every DropTower phase.

---

## Reduced motion

Do not perform sudden freefall.

Represent build/drop through restrained position or state changes.

---

# 11. RollerCoaster

## Musical responsibility

RollerCoaster represents:

```text
PHRASE
ENERGY TRAJECTORY
TENSION
RELEASE
LONG-FORM MUSICAL DEVELOPMENT
```

It operates at a larger timescale than ordinary beat/percussion actors.

---

## Core musical inputs

### Continuous

```text
structure.energy
structure.tension
structure.phraseProgress
structure.sectionProgress
spectrum.bassEnergy — optional secondary influence
```

---

### Discrete

```text
section-change
drop — possible major release cue
seek
```

RollerCoaster should not react visibly to every ordinary beat.

---

## Physical language

RollerCoaster owns:

```text
route geometry
routeDistance
velocity
acceleration
segment state
gravity
drag
drive
braking
camera-independent world pose
```

Current route concepts may include:

```text
Lift
Drop
Loop
Helix
Runout
Station
```

Not every final experience must use every segment.

---

## Rider / media layer

RollerCoaster trajectory and rider media are separate concepts.

A ride may carry:

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

The route defines motion.

The media defines what rides it.

Media changes must not automatically reset route physics.

A future experience may hand off rider media while preserving:

```text
routeDistance
velocity
direction
physical continuity
```

---

## Musical interpretation

Possible conceptual relationship:

```text
low phrase energy
↓
restrained ride state
```

```text
build
↓
lift / anticipation
```

```text
tension
↓
crest / hold / constrained state
```

```text
release
↓
drop / acceleration
```

```text
high phrase energy
↓
high-momentum route section
```

Do not reduce this to:

```text
energy = coaster speed
```

The actor should interpret structure through its route and state machine.

---

## Actor-owned state

The newer segmented RollerCoaster simulation is canonical.

Preserve its existing:

```text
Route
SegmentGeometry
RideState
velocity
gravity
drag
connectors
camera-independent simulation
```

when migrating.

---

## PhysicsWorld roles

Strong:

```text
Force Source ✓
Autonomous actor ✓
Collider — optional
Physics Receiver — optional
```

Primary environmental force:

```text
airflow / wake
```

Potential source properties:

```text
position
forward
velocity
acceleration
airflowRadius
airflowStrength
```

---

## Cross-world interaction

Example:

```text
phrase energy
↓
Coaster accelerates
↓
wake becomes stronger
↓
Orb receives force
↓
Orb trajectory changes
```

This must happen through PhysicsWorld.

Do not directly animate the Orb from RollerCoaster musical state.

---

## Seek behavior

Do not replay the complete route history between old and new song positions.

RollerCoaster requires an actor-specific musical reconciliation strategy.

Potential strategies may include:

- preserve current physical route state and retarget future behavior
- map major structural location to a compatible route phase
- controlled hidden reposition where justified

The final strategy is not locked.

What is locked:

> seek must not fake playback of skipped musical events.

---

## Pause behavior

New musical drive stops.

Existing coaster momentum may continue depending on physical safety/state logic.

Do not automatically freeze a high-speed coaster in mid-route unless the final
experience explicitly wants that behavior.

---

## Reduced motion

Use a stable representative state or substantially simplified route motion.

Do not run full high-speed ride simulation purely for decoration in reduced
motion mode.

---

# 12. Free Bodies / Orb / Balloon

## Musical responsibility

Free Bodies represent:

```text
TEXTURE
ATMOSPHERE
BRIGHTNESS
SPECTRAL AMBIENCE
```

They also serve as important PhysicsWorld participants.

The visual representation does not need to be a literal balloon.

Possible visual forms:

```text
Orb
particle cluster
soft body
light body
abstract floating object
```

---

## Core musical inputs

### Continuous

```text
spectrum.available
spectrum.high
spectrum.brightness
spectrum.texture
structure.energy
```

Potential secondary:

```text
spectrum.low
spectrum.mid
```

depending on future material design.

---

### Discrete

Free Bodies should generally require fewer musical events.

Possible:

```text
major accent
drop
seek
```

only when justified.

---

## Physical language

Free Bodies may own:

```text
position
velocity
mass
drag
buoyancy-like force
turbulence
collision
exclusion response
```

Unlike ordinary Physics Receivers, Dynamic Free Bodies do not necessarily
recover to a fixed authored anchor.

A force may permanently alter their later trajectory.

---

## Audio interpretation

AudioWorld provides environmental conditions.

Example:

```text
brightness ↑
↓
vertical / atmospheric tendency changes
```

```text
texture ↑
↓
turbulence increases
```

But PhysicsWorld forces remain equally important.

Example:

```text
Coaster wake
↓
Orb displaced
```

That displacement must not be overwritten immediately by an AudioWorld visual
target.

---

## PhysicsWorld roles

Strong:

```text
Dynamic Body ✓
Physics Receiver ✓
Collider ✓
Force Source — optional
```

---

## Seek behavior

Seek changes musical environmental conditions.

It should not necessarily teleport free bodies back to a predetermined place.

Future design may choose:

- preserve current positions
- retarget environmental forces
- gradually reconcile density/energy

Historical musical forces are not replayed.

---

## Pause behavior

Musical environmental input stops changing.

Existing body velocity and PhysicsWorld forces may continue until settling.

---

## Reduced motion

Reduce body count and movement substantially.

A stable or near-static atmospheric composition is acceptable.

---

# 13. Content participants

Z.land actors are not the only physical objects.

Page and experience content may participate through PhysicsWorld.

Possible participants:

```text
Text
Image
CMS content
Button
Navigation
Logo
Icon
Shader object
3D Object
```

These are not assigned primary musical responsibilities by default.

Their physical responses usually originate from nearby world interactions.

---

## Common content roles

### Physics Receiver

Receives force and responds visually.

Example:

```text
Coaster wake
↓
Title displacement
↓
spring recovery
```

---

### Collider / Exclusion Zone

Influences Dynamic Bodies.

Example:

```text
Project Card
↓
Orb cannot occupy card region
↓
Orb trajectory deflects
```

---

### Dynamic Body

Used only when the content is intentionally physically simulated.

Do not convert ordinary readable content into a free body by default.

---

# 14. Material response concept

Different participants may respond differently to the same PhysicsWorld force.

Conceptually:

```text
same force
↓
different material response
```

Examples:

### Text

```text
glyph displacement
split
fragment response
spring recovery
```

### Image

```text
tilt
shear
slice
temporary deformation
recovery
```

### Card

```text
small rigid displacement
rotation
spring recovery
```

### Navigation

```text
very small anchored impulse
rapid recovery
```

### Free Body

```text
velocity changes
trajectory remains changed
```

The exact material system is future work.

Do not build a large material engine before a current milestone requires it.

---

# 15. AudioWorld dependency matrix

Current intended mapping:

| Actor | Continuous Musical State | Discrete Musical Events |
| --- | --- | --- |
| Carousel | Melody, note progress, intensity | note-on, note-off |
| FerrisWheel | Harmony, chord state | chord-change |
| PirateShip | Beat phase, groove, swing | downbeat / seek if needed |
| BumperCars | Optional energy | kick, snare, hat, beat |
| DropTower | Build, tension, bass energy | drop, major accent |
| RollerCoaster | Energy, phrase, tension, section progress | section-change, major release |
| Free Bodies | Texture, brightness, spectral energy | minimal / optional |

This matrix is the default semantic map.

Do not duplicate a musical domain across actors without a specific reason.

Secondary use of another domain is allowed when it supports the actor's primary
musical responsibility.

---

# 16. PhysicsWorld role matrix

| Actor | Force Source | Receiver | Collider | Dynamic / Autonomous Body |
| --- | --- | --- | --- | --- |
| Carousel | optional | optional | optional | yes |
| FerrisWheel | optional | optional | optional | yes |
| PirateShip | optional | optional | optional | yes |
| BumperCars | yes | yes | yes | yes |
| DropTower | yes / future | optional | optional | yes |
| RollerCoaster | yes | optional | optional | yes |
| Free Bodies | optional | yes | yes | yes |

These are current defaults, not permanent limitations.

Do not enable every role merely because the infrastructure supports it.

Each role must serve an actual experience requirement.

---

# 17. Renderer independence

Every actor should conceptually separate:

```text
simulation
```

from:

```text
renderer
```

Potential renderer technologies include:

```text
DOM
SVG
Canvas
Three.js
WebGL
Shader
```

Examples:

Carousel simulation should not care whether its riders are:

```text
Icons
Album art
3D horses
Abstract shapes
```

RollerCoaster simulation should not care whether its rider is:

```text
Orb
Text
Logo
Chocolate fragment
Shader
```

The actor defines motion.

The renderer/media defines appearance.

---

# 18. Experience hierarchy

Actor musical activity does not determine visual hierarchy automatically.

An actor may be musically active while visually Secondary or Ambient.

Conceptual experience roles:

```text
Primary
Secondary
Ambient
Resting
```

Example:

During a DropTower build:

```text
DropTower
→ Primary

Carousel
→ Secondary

FerrisWheel
→ Ambient

BumperCars
→ Resting / low activity
```

Experience hierarchy may affect presentation.

It must not silently replace the actor's physics.

---

# 19. Development order

Do not migrate all actors immediately.

Current order:

## Milestone 1

```text
Authored AudioMap
↓
AudioClock
↓
AudioWorld
↓
Carousel
```

Purpose:

- prove continuous melody state
- prove note event delivery
- prove seek
- prove pause
- prove restart
- prove debug visibility

---

## Milestone 2

Choose an actor using a substantially different musical signal type.

Preferred candidates:

```text
BumperCars
→ discrete percussion events
```

or:

```text
PirateShip
→ continuous groove / rhythmic phase
```

Purpose:

> prove AudioWorld is a general musical semantic layer, not a Carousel-specific
> melody system.

---

## Later milestones

Integrate:

```text
FerrisWheel
DropTower
RollerCoaster
Free Bodies
PhysicsWorld cross-actor events
```

Order should follow the Story Map and architecture verification needs.

Do not choose order based only on implementation convenience.

---

# 20. Actor integration checklist

Before connecting an actor to AudioWorld, explicitly document:

1. What musical domain does the actor own?
2. Which AudioSnapshot fields does it read?
3. Which AudioEvents does it consume?
4. What state remains actor-local?
5. What simulation already exists and must remain unchanged?
6. What musical input modifies the simulation?
7. What does the actor register in PhysicsWorld?
8. What does the renderer display?
9. What happens on pause?
10. What happens on seek?
11. What happens on restart?
12. What happens when the musical domain is unavailable?
13. What happens under reduced motion?
14. What must remain deterministic for debugging?
15. What runtime behavior must be manually verified?

If these answers are unclear, do not implement the integration yet.

---

# 21. Ride-map invariant

Every actor should answer two separate questions.

First:

> What part of music do I understand?

Second:

> What physical mechanism do I use to express it?

Examples:

```text
Carousel

understands:
melody

expresses through:
orbit + rider pitch movement
```

```text
BumperCars

understand:
percussion

express through:
impulse + collision
```

```text
RollerCoaster

understands:
phrase / energy

expresses through:
route + momentum
```

Do not choose musical mappings only because two values are numerically easy to
connect.

The mapping must make perceptual and physical sense.

The canonical chain remains:

```text
Musical Meaning
↓
Actor Interpretation
↓
Actor Simulation
↓
PhysicsWorld
↓
World
```