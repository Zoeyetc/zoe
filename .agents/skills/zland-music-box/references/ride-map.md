# Z.land Music Box — Ride Map v0.2

## 1. Purpose

This document defines the current musical, physical, and evidence-level
responsibilities of Z.land Music Box actors.

It exists to prevent role drift.

Each actor must have:

- a distinct musical responsibility
- explicit musical evidence
- a distinct physical language
- actor-local simulation ownership
- explicit AudioWorld inputs
- explicit PhysicsWorld roles
- explicit seek / pause / restart behavior
- a renderer that does not become simulation truth
- a clear distinction between musical evidence and presentation

The current actor set is:

```text
Carousel
FerrisWheel
PirateShip
BumperCars
DropTower
RollerCoaster
Free Bodies / Orb
```

These mappings are current design contracts.

Do not silently reassign them.

---

## 2. Shared actor model

All musical actors conceptually follow:

```text
AudioWorld
↓
Musical Evidence
↓
Actor Interpretation
↓
Actor-local Simulation
↓
Physical State
↓
PhysicsWorld participation where relevant
↓
Renderer
↓
Experience Composition
```

An actor may consume:

- continuous AudioSnapshot values
- discrete AudioEvents
- PhysicsWorld forces
- explicit user interaction where appropriate

An actor must not independently analyze raw audio.

An actor must not own authoritative musical time.

---

## 3. Musical evidence vs actor behavior

This distinction is mandatory.

### Musical Evidence

Answers:

```text
what actually exists in the music?
```

Examples:

```text
G4
C major = C / E / G
kick
swing = 0.65
build = 0.82
drop event
phrase tension rising
```

### Actor Interpretation

Answers:

```text
what does this machine do with that evidence?
```

Examples:

```text
G4
→ Carousel local carrier expression
```

```text
C / E / G
→ FerrisWheel harmonic carriers active simultaneously
```

```text
kick
→ BumperCars impulse
```

### Presentation

Answers:

```text
how should the visitor notice it?
```

Examples:

- line weight
- contrast
- local illumination
- region emphasis
- camera focus

Presentation may change.

Musical evidence must not.

---

## 4. Evidence rule

If an actor-local visual element represents a musical fact, that element must
correspond to real AudioWorld data.

Do not:

- activate extra carriers for symmetry
- omit real tones because the scene looks crowded
- trigger fake musical events to keep motion interesting
- use region highlights as substitutes for exact evidence
- invent confidence

A useful rule:

```text
If it looks like musical evidence,
it must be musical evidence.
```

---

## 5. Shared actor lifecycle

Every actor should conceptually support:

```text
initialize
↓
resting
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

Inactive does not mean hidden.

---

## 6. Shared synchronization rules

### Play

When musical transport begins:

- the actor reads current AudioSnapshot
- future AudioEvents may affect it
- playback may begin from any valid transport time
- do not assume start time is always zero

---

### Pause

Pause stops musical progression.

Pause does not automatically erase physical state.

Depending on actor semantics:

- motion may continue
- inertia may continue
- gravity may continue
- springs may settle
- a held state may remain held

Pause behavior must be explicit per actor.

---

### Seek

Seek is synchronization.

It is not historical playback.

On seek:

```text
old time
↓
new musical time
↓
new AudioSnapshot
↓
actor reconciliation
```

Do not replay skipped musical history.

Each actor must define:

- which evidence synchronizes immediately
- what physical state remains continuous
- what transient state is discarded
- whether controlled reconciliation is needed

---

### Restart

Restart returns musical transport to the beginning.

Actors may restore deterministic initial state.

Do not invent a new global reset architecture for one actor.

---

### Song replacement

Replacing AudioMap must not require actor recreation.

Actors receive new musical evidence through AudioWorld.

---

## 7. Timescale hierarchy

Actors intentionally operate at different musical timescales.

```text
fast transient
│
├── BumperCars
│
├── Carousel note evidence
│
├── PirateShip rhythmic phase
│
├── FerrisWheel sustained harmony
│
├── DropTower structural build/drop
│
└── RollerCoaster phrase development
│
slow structural
```

Free Bodies may operate across atmospheric and physical timescales.

Do not make every actor respond visibly to every beat.

---

# 8. Carousel

## Musical responsibility

Carousel represents:

```text
MELODY
PITCH
NOTE IDENTITY
NOTE EXPRESSION
```

Carousel is the primary melodic transcription actor.

It must not become:

- harmony actor
- general rhythm actor
- generic amplitude visualizer

---

## Exact musical evidence

Carousel must expose precise note evidence.

Conceptually:

```text
specific melody note
→ identifiable local carrier response
```

Examples:

```text
G4
→ G4-compatible carrier / local pitch expression
```

```text
A4
→ A4-compatible carrier / local pitch expression
```

The exact carrier-mapping strategy may evolve.

The evidence rule does not:

```text
randomly choose visually convenient carriers
```

If a local activation visually claims a note identity, it must correspond to
the actual active note.

---

## Core musical inputs

### Continuous

From AudioSnapshot:

```text
melody.available
melody.active
melody.midi
melody.pitchHz
melody.noteName
melody.noteProgress
melody.intensity
melody.confidence

transport.time
```

Optional:

```text
rhythm.bpm
```

only for broad mechanical pacing.

BPM must not replace melody interpretation.

---

### Discrete

```text
note-on
note-off
seek
```

Potential future phrase-level melody events may be added only when a current
milestone requires them.

---

## Physical language

Carousel owns:

```text
central mechanical axis
base rotation
angular velocity
angular inertia
media-neutral carriers
carrier poles / mounts
carrier-local vertical expression
```

The Carousel behaves as one rotating machine.

Its carriers are not independent orbiting widgets.

---

## Mechanical vs musical motion

Keep two motion channels separate.

### Mechanical motion

```text
base angle
angular velocity
inertia
settling
```

### Musical evidence motion

```text
active note
pitch target
carrier expression
note envelope
```

Do not make note changes rotate the whole Carousel toward note positions.

Fast melody must not make the machine twitch.

---

## Pitch interpretation

Pitch should use bounded mapping.

Conceptually:

```text
midi / pitch
↓
normalize within useful musical range
↓
bounded carrier vertical target
```

Do not use unbounded raw MIDI-to-pixel mapping.

Future song-aware range strategies may evolve.

---

## Carrier representation

Carousel carriers must remain media-neutral.

Do not use:

- horses
- animals
- mascots
- nostalgic fairground characters

Acceptable carrier concepts:

- rounded plate
- capsule
- suspended platform
- media holder
- abstract mount

Future media may include:

- image
- logo
- icon
- text
- album artwork
- 3D object
- shader

The mechanical system must not depend on carrier content.

---

## Actor-owned state

Likely state includes:

```text
angle
angularVelocity
target mechanical drive
carrierStates[]
active musical carrier
expression envelopes
```

Exact implementation may evolve.

---

## PhysicsWorld role

Current default:

```text
Autonomous Actor
```

Possible future:

```text
Force Source — optional
Physics Receiver — optional
Collider — optional
```

Do not enable extra roles without an experience requirement.

---

## Seek behavior

On seek:

- synchronize active melody evidence
- discard obsolete transient note envelopes where appropriate
- do not replay skipped note-ons
- do not rotate through skipped notes
- preserve mechanical continuity where possible

---

## Pause behavior

On pause:

- no new note progression
- no new note events
- mechanical inertia may continue settling
- current carrier expression may decay naturally

Do not snap to zero angle.

---

## Reduced motion

Preserve:

```text
exact note identity
```

Reduce:

- continuous rotation
- large vertical travel
- prolonged movement

Do not replace note evidence with generic blinking.

---

# 9. FerrisWheel

## Musical responsibility

FerrisWheel represents:

```text
HARMONY
CHORD IDENTITY
SIMULTANEOUS CHORD-TONE MEMBERSHIP
SUSTAINED HARMONIC RELATIONSHIPS
```

FerrisWheel is the primary harmony-transcription actor.

It must remain distinct from Carousel.

---

## Exact musical evidence

Harmony must preserve simultaneity.

Examples:

```text
C major
→ C + E + G
```

```text
A minor
→ A + C + E
```

The corresponding harmonic carriers should activate simultaneously.

This is not decorative grouping.

It is musical evidence.

---

## Core musical inputs

### Continuous

```text
harmony.available
harmony.chord
harmony.rootPitchClass
harmony.pitchClasses
harmony.confidence

transport.time
```

Optional secondary:

```text
structure.energy
```

for bounded mechanical activity only.

---

### Discrete

```text
chord-change
seek
```

Optional:

```text
section-change
```

only if later justified.

---

## Physical language

FerrisWheel owns:

```text
large wheel rotation
wheel angular velocity
suspended cabins
gravity-oriented cabin pose
cabin swing
harmonic carrier activation
```

The key mechanical distinction:

```text
wheel rotates
while
cabins remain approximately upright
```

Do not make cabins rigidly rotate with wheel orientation.

---

## Harmonic carrier mapping

Current validated design uses:

```text
12 abstract cabins
→ 12 pitch classes
```

Current chord tones activate exact matching cabins.

This provides a strong spatial harmonic representation.

Do not silently replace this with:

```text
whole wheel glow
```

or:

```text
random cabin emphasis
```

Whole-wheel behavior may exist as secondary mechanics.

Local carrier identity remains the evidence layer.

---

## Harmonic simultaneity

FerrisWheel must visually support several active harmonic carriers at once.

This is a key distinction from Carousel.

Carousel:

```text
primarily sequential melodic identity
```

FerrisWheel:

```text
simultaneous harmonic membership
```

Do not make FerrisWheel behave like a circular piano roll.

---

## Chord interpretation

Possible actor-local interpretation:

```text
chord membership
→ exact active carriers
```

```text
chord duration
→ sustained carrier state
```

```text
chord change
→ carrier reassignment
```

Mechanical wheel rotation should remain physically continuous.

Do not teleport wheel angle because root pitch changed.

---

## Actor-owned state

Likely:

```text
wheelAngle
wheelAngularVelocity
wheelDrive
cabinSwing[]
cabinAngularVelocity[]
activePitchClasses[]
```

---

## PhysicsWorld role

Current default:

```text
Autonomous Actor
```

Possible future:

```text
Force Source — subtle / optional
Collider — optional
```

No shared-world effect should be added without a defined use case.

---

## Seek behavior

On seek:

- synchronize exact active chord
- synchronize exact chord-tone carriers
- do not replay skipped chord-change events
- wheel mechanical state may remain continuous

---

## Pause behavior

On pause:

- harmony progression stops
- wheel inertia may continue
- cabin swing may continue damping
- active chord identity may remain visible

---

## Reduced motion

Preserve:

```text
exact active harmonic carriers
```

Reduce:

- wheel rotation
- cabin swing
- continuous mechanical movement

Do not reduce harmony to a generic chord label only.

---

# 10. PirateShip

## Musical responsibility

PirateShip represents:

```text
GROOVE
SWING
CONTINUOUS RHYTHMIC PHASE
```

PirateShip is not a percussion-event actor.

---

## Musical evidence

PirateShip exposes continuous timing character rather than discrete note
identity.

Relevant evidence includes:

```text
beatPhase
barPhase
groove
swing
bpm
```

This evidence is continuous.

---

## Core musical inputs

### Continuous

```text
rhythm.available
rhythm.bpm
rhythm.beatPhase
rhythm.barPhase
rhythm.groove
rhythm.swing
```

Optional secondary:

```text
structure.energy
```

for bounded amplitude only.

---

### Discrete

Minimal.

Possible:

```text
downbeat
seek
```

Continuous phase remains primary.

---

## Physical language

PirateShip owns:

```text
pendulum angle
angular velocity
drive torque
damping
target phase relationship
amplitude envelope
```

---

## Groove interpretation

Conceptually:

```text
beatPhase
→ phase relationship
```

```text
swing
→ timing asymmetry
```

```text
groove
→ drive waveform / timing character
```

```text
energy
→ bounded expressive amplitude
```

Do not reduce swing to:

```text
more swing
→ larger angle
```

Temporal asymmetry must remain part of the interpretation.

---

## Important constraint

Do not directly assign:

```text
shipAngle = beatPhase
```

AudioWorld provides rhythmic truth.

Actor simulation owns physical angle.

---

## PhysicsWorld role

Current default:

```text
Autonomous Actor
```

Possible future:

```text
Force Source — optional
Collider — optional
```

---

## Seek behavior

On seek:

- synchronize musical phase target
- do not replay skipped swings
- reconcile physical state toward current phase relationship

---

## Pause behavior

On pause:

- musical drive stops progressing
- existing angular velocity remains
- pendulum continues damping

---

## Reduced motion

Preserve:

```text
rhythmic phase identity
```

Reduce:

- angular amplitude
- prolonged oscillation

Do not turn PirateShip into a percussion flash.

---

# 11. BumperCars

## Musical responsibility

BumperCars represents:

```text
PERCUSSION
TRANSIENT IMPULSES
COLLISION ENERGY
```

This is the primary discrete rhythmic physics actor.

---

## Musical evidence

Relevant exact evidence includes:

```text
kick
snare
hat
beat / downbeat where intentionally used
event strength
event timestamp
```

A BumperCars musical impulse should correspond to an actual percussion event.

---

## Core musical inputs

### Continuous

Optional:

```text
structure.energy
spectrum.bassEnergy
```

for bounded ambient/cruise behavior only.

They must not replace event semantics.

---

### Discrete

Primary:

```text
kick
snare
hat
seek
```

Beat/downbeat may be used only when deliberately designed.

---

## Physical language

BumperCars owns:

```text
position
velocity
heading
rotation
angularVelocity
collision bounds
body/body collision
wall collision
restitution
damping
speed limits
```

---

## Percussion interpretation

Current actor-local semantics may include:

```text
kick
→ stronger linear impulse
```

```text
snare
→ lateral + angular impulse
```

```text
hat
→ small perturbation
```

The exact mapping may evolve.

---

## Critical causal rule

AudioWorld creates the initial musical cause.

Simulation creates the physical consequence.

Correct:

```text
kick
↓
Car A impulse
↓
Car A reaches Car B
↓
real collision
↓
Car B motion
```

Incorrect:

```text
kick
→ animate Car A
→ animate Car B
```

---

## PhysicsWorld role

Validated:

```text
Dynamic Body
Collider
Physics Receiver
PhysicsWorld impact producer
```

A meaningful actual collision may publish a transient shared impact.

Shared impact strength must derive from physical collision data.

Not directly from musical event strength.

---

## Shared-impact evidence

The validated causal chain is:

```text
percussion event
→ BumperCars impulse
→ real collision
→ PhysicsWorld impact
→ external anchored content response
```

This is an established contract.

Do not bypass it.

---

## Seek behavior

On seek:

- do not replay skipped percussion events
- do not synthesize historical collisions
- preserve or reconcile current physical state according to current behavior
- future events resume normally

---

## Pause behavior

On pause:

- no new percussion events
- existing physical energy remains
- collisions may still occur
- post-pause real collisions may still emit PhysicsWorld impacts

---

## Restart behavior

Restore deterministic known initial body state.

Clear stale shared collision effects according to PhysicsWorld reset semantics.

---

## Reduced motion

Preserve percussion identity.

Reduce:

- impulse magnitude
- angular motion
- prolonged chaotic collision

Do not replace real event identity with decorative flashes.

---

# 12. DropTower

## Musical responsibility

DropTower represents:

```text
BUILD
TENSION
EXPLICIT MAJOR DROP
LARGE STRUCTURAL RELEASE
REBOUND
```

DropTower does not respond to every beat.

---

## Musical evidence

Relevant evidence includes:

```text
structure.available
build
tension
energy
drop event
bassEnergy where available
```

The explicit `drop` event is especially important.

---

## Core musical inputs

### Continuous

```text
structure.build
structure.tension
structure.energy
spectrum.bassEnergy — optional
```

### Discrete

```text
drop
seek
```

Optional:

```text
section-change
```

---

## Physical language

Validated state machine:

```text
IDLE
→ LIFTING
→ HOLDING
→ DROPPING
→ REBOUND
→ SETTLING
```

Possible physical state:

```text
position
velocity
lift drive
gravity
braking
rebound
```

---

## Structural interpretation

Conceptually:

```text
build
→ lift target / motor drive
```

```text
tension
→ hold eligibility / preparation
```

```text
explicit drop event
→ release
```

```text
bass / energy
→ bounded expressive strength
```

---

## Critical evidence rule

Do not trigger major release because:

```text
energy is high
```

if no explicit drop event exists.

The visible drop is evidence of a real structural event.

---

## PhysicsWorld role

Current:

```text
Autonomous Actor
```

Future possible:

```text
Force Source at impact / rebound
```

Do not add shared impact until a dedicated milestone requires it.

---

## Seek behavior

### Seek into build

Reconcile toward compatible lifting state.

### Seek into hold

Reconcile toward prepared / holding state.

### Seek after drop

Do not replay skipped drop.

Do not simulate historical freefall.

---

## Pause behavior

State-aware:

```text
LIFTING
→ musical drive may stop / hold
```

```text
HOLDING
→ hold may remain
```

```text
DROPPING
→ gravity generally continues
```

```text
REBOUND / SETTLING
→ damping continues
```

---

## Reduced motion

Preserve:

```text
build
hold
release
```

Reduce:

- freefall distance
- speed
- rebound amplitude

Do not replace structural meaning with a flash.

---

# 13. RollerCoaster

## Musical responsibility

RollerCoaster represents:

```text
PHRASE
ENERGY TRAJECTORY
TENSION
RELEASE
LONG-FORM DEVELOPMENT
```

It operates on a longer timescale than ordinary percussion.

---

## Musical evidence

Relevant evidence includes:

```text
structure.available
phraseProgress
sectionProgress
energy
tension
release region
section-change where relevant
```

RollerCoaster is not a note or beat actor.

---

## Core musical inputs

### Continuous

```text
structure.energy
structure.tension
structure.phraseProgress
structure.sectionProgress
```

### Discrete

Optional:

```text
section-change
seek
```

An explicit `drop` event may reinforce a major release only if deliberately
designed.

It does not define RollerCoaster's entire behavior.

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
rider pose
```

Current validated route subset:

```text
Station
→ Lift
→ Drop
→ Loop
→ Runout
→ Station
```

---

## Canonical architecture

Use the newer segmented RollerCoaster architecture.

Important concepts include:

```text
Vec3
TrackFrame
SegmentGeometry
Route
RoutePiece
HiddenConnector
RideState
persistent routeDistance
segment-specific physics
```

Do not restore old closed-loop modulo routing.

---

## Phrase interpretation

Conceptually:

```text
energy
→ drive conditions
```

```text
tension
→ restraint / anticipation appropriate to current segment
```

```text
release
→ reduced restraint / stronger momentum
```

Do not implement:

```text
energy → direct velocity assignment
```

Do not implement:

```text
phraseProgress → routeDistance
```

Musical evidence influences physical conditions.

Simulation owns actual route progression.

---

## Rider / media boundary

Route simulation and rider media are separate.

Current development rider:

```text
neutral Orb
```

Future media may include:

- Text
- Image
- Logo
- Icon
- 3D
- Shader
- custom media

Changing media must not reset:

- routeDistance
- velocity
- direction
- ride state

---

## PhysicsWorld role

Current validated state:

```text
Autonomous Actor
```

Next intended milestone:

```text
Force Source
→ directional wake
```

The future wake must derive from:

- actual position
- actual forward
- actual physical speed
- actual acceleration where used

Not directly from musical energy.

---

## Seek behavior

Current strategy:

- preserve route state where possible
- update future musical driving conditions
- do not replay skipped phrase history
- do not directly derive routeDistance from new phraseProgress

Large-seek reconciliation must remain explicit.

---

## Pause behavior

On pause:

- musical driving state stops progressing
- gravity / drag / inertia / braking may continue
- high-speed route motion is not automatically frozen

---

## Restart behavior

Restore deterministic Station state.

---

## Reduced motion

Preserve phrase identity.

Reduce:

- speed
- high-acceleration travel
- loop intensity
- large route traversal

Do not convert RollerCoaster into a progress bar.

---

# 14. Free Bodies / Orb

## Musical responsibility

Free Bodies represent:

```text
TEXTURE
ATMOSPHERE
BRIGHTNESS
SPECTRAL CONDITIONS
```

But their identity is dual:

```text
AudioWorld atmospheric input
+
PhysicsWorld physical input
```

They are not merely audio-reactive particles.

---

## Core musical inputs

Future likely continuous evidence:

```text
spectrum.available
spectrum.low
spectrum.mid
spectrum.high
spectrum.brightness
spectrum.texture
structure.energy
```

Exact mapping remains milestone-specific.

---

## Physical inputs

Free Bodies may receive:

```text
RollerCoaster wake
BumperCars impacts
collider / exclusion forces
other PhysicsWorld fields
```

---

## Physical language

Future state may include:

```text
position
velocity
mass
drag
turbulence
buoyancy-like force
collision
exclusion response
```

Unlike anchored content, Free Bodies do not necessarily recover to fixed layout
anchors.

---

## Important constraint

Do not implement final Free Bodies as:

```text
sin(time)
→ floating target
```

if the milestone requires real dynamics.

AudioWorld should modify environmental conditions.

PhysicsWorld should modify actual trajectories.

---

## PhysicsWorld role

Intended:

```text
Dynamic Body
Physics Receiver
Collider
Force Source — optional
```

---

## Seek behavior

Seek changes musical atmospheric conditions.

Do not replay historical forces.

Do not necessarily teleport bodies to predetermined positions.

---

## Pause behavior

Musical atmosphere stops progressing.

Existing physical velocity and shared forces may continue.

---

## Reduced motion

Reduce:

- body count
- turbulence
- displacement
- prolonged travel

A near-static atmospheric composition is acceptable.

---

# 15. Ordinary content participants

Z.land actors are not the only physical objects.

Ordinary content may include:

- Text
- Image
- CMS content
- Button
- Navigation
- Logo
- Icon
- Shader object
- 3D object

These are not assigned primary musical responsibilities by default.

Their responses usually come from PhysicsWorld.

---

## Anchored content model

Validated model:

```text
authored/current layout
+
temporary physics response
=
rendered transform
```

Anchored content may own:

```text
response offset
response velocity
rotation
angular velocity
stiffness
damping
bounds
settling state
```

It remains anchored.

It is not a Dynamic Body.

---

## Validated content causality

Current validated chain:

```text
BumperCars real collision
→ PhysicsWorld impact
→ Anchored Content Card
→ displacement / rotation
→ recovery
```

The content does not subscribe to percussion.

Preserve this distinction.

---

# 16. Material response concept

Different participants may respond differently to the same physical force.

Conceptually:

```text
same PhysicsWorld force
→ different material response
```

Possible future examples:

### Text

```text
glyph displacement
split
fragment
spring recovery
```

### Image

```text
tilt
shear
slice
temporary deformation
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

Do not build a general material engine before a milestone requires it.

---

# 17. Musical evidence matrix

Current semantic ownership:

| Actor | Primary Musical Evidence |
| --- | --- |
| Carousel | exact melody note / pitch / note expression |
| FerrisWheel | chord identity + simultaneous pitch-class membership |
| PirateShip | groove / swing / rhythmic phase |
| BumperCars | kick / snare / hat / transient percussion events |
| DropTower | build / tension / explicit major drop |
| RollerCoaster | phrase progress / energy trajectory / tension / release |
| Free Bodies | texture / brightness / spectral atmosphere |

This table defines evidence ownership.

Do not casually duplicate primary evidence across actors.

Secondary use is allowed only when it supports the actor's primary role without
confusing semantic ownership.

---

# 18. AudioWorld dependency matrix

| Actor | Continuous State | Discrete Events |
| --- | --- | --- |
| Carousel | melody note state, pitch, note progress, intensity | note-on, note-off |
| FerrisWheel | chord, root, pitch classes, confidence | chord-change |
| PirateShip | beat phase, bar phase, groove, swing, BPM | seek / optional downbeat |
| BumperCars | optional bounded energy | kick, snare, hat |
| DropTower | build, tension, energy, optional bass | drop |
| RollerCoaster | phrase, section progress, energy, tension | optional section-change |
| Free Bodies | spectrum, brightness, texture, energy | minimal / milestone-specific |

This matrix is the default semantic map.

---

# 19. PhysicsWorld role matrix

| Actor | Force Source | Receiver | Collider | Dynamic / Autonomous |
| --- | --- | --- | --- | --- |
| Carousel | optional | optional | optional | yes |
| FerrisWheel | optional | optional | optional | yes |
| PirateShip | optional | optional | optional | yes |
| BumperCars | impact producer | yes | yes | yes |
| DropTower | future | optional | optional | yes |
| RollerCoaster | next milestone: wake source | optional | optional | yes |
| Free Bodies | optional | yes | yes | yes |
| Anchored Content | no | yes | optional | no |

Do not enable every role merely because infrastructure supports it.

Each role must serve a current experience requirement.

---

# 20. Renderer independence

Every actor should conceptually separate:

```text
simulation
```

from:

```text
renderer
```

Possible renderers:

- DOM
- SVG
- Canvas
- Three.js
- WebGL
- Shader

Examples:

Carousel simulation must not depend on whether carrier content is:

```text
icon
image
album artwork
3D object
```

RollerCoaster simulation must not depend on whether rider media is:

```text
Orb
Text
Logo
3D
Shader
```

The actor defines motion.

Media defines appearance.

---

# 21. Experience hierarchy

Actors may be visually:

```text
Primary
Secondary
Ambient
Resting
```

This is presentation state.

It must not alter exact Musical Evidence.

Examples:

Wrong:

```text
FerrisWheel Ambient
→ remove E from C major
```

Wrong:

```text
Carousel Primary
→ activate extra notes
```

Correct:

```text
same musical evidence
+
different visual emphasis
```

---

# 22. Park Map / Spatial Score relationship

The final Park Map may spatially organize actors.

Do not use the Ride Map contract to create isolated music-theory dashboard
regions.

The Park Map should organize:

- actor geography
- routes
- shared fields
- physical proximity
- visitor orientation
- cross-actor interactions

Musical Evidence remains actor-local.

Examples:

```text
Carousel region exists
but
note hit occurs on precise local carrier
```

```text
FerrisWheel region exists
but
chord membership occurs on precise cabins
```

Region emphasis is not the evidence itself.

---

# 23. Development order

Do not treat this list as a requirement to build every actor before testing
shared-world behavior.

Current objectively validated actors:

```text
Carousel
FerrisWheel
PirateShip
BumperCars
DropTower
RollerCoaster
```

Current validated shared causality:

```text
BumperCars collision
→ PhysicsWorld
→ Anchored Content
```

Current near-term order:

### Milestone 6B

```text
RollerCoaster actual motion
→ PhysicsWorld directional wake
→ Anchored Content
```

### Milestone 7A

```text
AudioWorld atmospheric evidence
+
PhysicsWorld forces
→ Free Bodies / Orb
```

### After world-physics foundations

```text
Experience Composition
→ Park Map
→ Spatial Score
```

Do not prematurely redesign final layout before these world contracts are
validated.

---

# 24. Actor integration checklist

Before connecting or modifying an actor, explicitly document:

1. What musical domain does the actor own?
2. What exact Musical Evidence does it expose?
3. Which AudioSnapshot fields does it read?
4. Which AudioEvents does it consume?
5. Which inputs are continuous?
6. Which inputs are discrete?
7. Which visible elements represent Musical Evidence?
8. Which visible elements are merely mechanical behavior?
9. What actor-local interpretation is applied?
10. What simulation state remains actor-owned?
11. What validated behavior must remain unchanged?
12. What PhysicsWorld roles are registered?
13. Which spatial adapter is required?
14. What physical consequence may leave the actor?
15. What renderer state is presentation-only?
16. What happens on pause?
17. What happens on seek?
18. What happens on restart?
19. What happens on song replacement?
20. What happens when the musical domain is unavailable?
21. What happens under reduced motion?
22. What must remain deterministic?
23. What objective facts can Codex verify?
24. What subjective qualities require user manual QA?

If these answers are unclear, do not implement yet.

---

# 25. Objective vs subjective QA

Objective checks may verify:

- exact note mapping
- chord-tone membership
- event timing
- actor state
- bounded simulation
- deterministic restart
- PhysicsWorld registration
- spatial force propagation
- renderer receives correct state
- reduced-motion branch behavior

Subjective QA includes:

- visual quality
- mechanical feel
- musical feel
- pacing
- tension
- composition
- readability
- whether the experience feels intuitive

Codex may report objective verification.

The user approves subjective quality.

---

# 26. Ride-map invariant

Every actor should answer three separate questions.

First:

> What musical evidence do I understand?

Second:

> What physical mechanism do I use to express it?

Third:

> What physical consequence, if any, can I create in the shared world?

Examples:

```text
Carousel

evidence:
specific melody note

expression:
carrier activation + bounded pitch movement

shared consequence:
none required currently
```

```text
FerrisWheel

evidence:
simultaneous chord-tone membership

expression:
exact harmonic carriers + slow wheel mechanics

shared consequence:
none required currently
```

```text
BumperCars

evidence:
percussion event

expression:
body impulse + collision

shared consequence:
real collision → PhysicsWorld impact
```

```text
RollerCoaster

evidence:
phrase / energy / tension

expression:
route drive + momentum

shared consequence:
next milestone → directional wake
```

Do not choose mappings only because values are numerically easy to connect.

The mapping must make:

- musical sense
- physical sense
- perceptual sense

The canonical chain remains:

```text
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