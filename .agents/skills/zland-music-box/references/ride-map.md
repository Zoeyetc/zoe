# Z.land Music Box — Ride Map v0.3

## 1. Purpose

This document defines the current musical, physical, and evidence-level
responsibilities of Z.land Music Box actors.

It exists to prevent role drift.

Each actor must have:

- a distinct musical responsibility
- explicit Musical Evidence
- a distinct physical language
- actor-local simulation ownership
- explicit AudioWorld inputs
- explicit PhysicsWorld roles
- explicit seek / pause / restart behavior
- renderer independence
- a clear distinction between Musical Evidence and presentation
- a clear distinction between current transitional implementation and final
  semantic representation

The current musical actor set is:

```text
Carousel
FerrisWheel
PirateShip
BumperCars
DropTower
RollerCoaster
Free Bodies / Orb
```

Park Train is infrastructure, not a musical actor.

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

scale degree 5

C major = C / E / G

tonal center = G

kick

swing = 0.65

section boundary

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
scale degree 5
→ Carousel degree-5 carrier expression
```

```text
C / E / G
→ FerrisWheel harmonic cabins active simultaneously
```

```text
tonal center G
→ FerrisWheel target wheel orientation
```

```text
kick
→ Kick BumperCar impulse
```

### Presentation

Answers:

```text
how should the visitor notice it?
```

Examples:

- line weight
- contrast
- annotation
- local illumination
- region emphasis
- camera focus

Presentation may change.

Musical Evidence must not.

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
- use visual hierarchy to rewrite musical truth

Rule:

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

- actor reads current AudioSnapshot
- future AudioEvents may affect it
- playback may begin from any valid transport time
- do not assume start time is zero

### Pause

Pause stops musical progression.

Pause does not automatically erase physical state.

Depending on actor semantics:

- motion may continue
- inertia may continue
- gravity may continue
- springs may settle
- held state may remain held

### Seek

Seek is synchronization.

It is not historical playback.

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

### Restart

Restart returns musical transport to the beginning.

Actors may restore deterministic initial state.

Do not invent a new global reset architecture for one actor.

### Song replacement

Replacing AudioMap must not require actor recreation.

Actors receive new Musical Evidence through AudioWorld.

Some song-derived structures may regenerate.

Example:

```text
new AudioMap
→ new RollerCoaster TrackMap
```

---

## 7. Timescale hierarchy

Actors intentionally operate at different musical timescales.

```text
fast transient

│
├── BumperCars
│
├── Carousel local melodic evidence
│
├── PirateShip rhythmic phase
│
├── FerrisWheel chord evidence
│
├── FerrisWheel tonal-center rotation
│
├── DropTower structural build / drop
│
└── RollerCoaster phrase + whole-song development

slow whole-song
```

Free Bodies operate across atmospheric and physical timescales.

Do not make every actor respond visibly to every beat.

---

# 8. Carousel

## Musical responsibility

Carousel represents:

```text
MELODY

ABSOLUTE NOTE IDENTITY

SCALE DEGREE

NOTE EXPRESSION
```

Carousel is the primary melodic transcription actor.

It must not become:

- harmony actor
- generic rhythm actor
- amplitude visualizer

---

## Melody source hierarchy

Preferred melody-evidence source:

```text
1. MIDI / symbolic input
2. isolated melody stem
3. predominant melody analysis
4. unavailable
```

Carousel must not care which upstream source produced valid AudioWorld melody
evidence.

Source provenance should remain available for confidence and debugging.

---

## Exact Musical Evidence

Carousel must preserve absolute note truth.

Example:

```text
E4
MIDI 64
```

The canonical representation includes:

```text
scale degree 3
```

The relative representation must not erase the absolute representation.

---

## Final carrier semantics

The final target is:

```text
8 carriers
=
scale degrees 1–7
+
octave tonic
```

Example in C major:

```text
1  → C
2  → D
3  → E
4  → F
5  → G
6  → A
7  → B
8  → C'
```

Example:

```text
E4
→ absolute note = E4
→ MIDI = 64
→ degree = 3
→ carrier 3
```

If tonal center is unavailable:

- preserve absolute note truth
- do not fabricate a degree

---

## Canonical degree representation

AudioWorld derives scale degree from absolute melody plus the current validated
tonal center. Carousel maps degrees 1–8 directly to the eight fixed carriers.
Modulo allocation is absent. Chromatic, low-confidence, no-key, and unsupported
register evidence preserves exact noteName / MIDI in a separate marker and does
not activate a false diatonic carrier.

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

melody.source
melody.scaleDegree
melody.scaleDegree.inScale
melody.scaleDegree.octaveRelation
melody.scaleDegree.referenceTonicMidi

transport.time
```

### Discrete

```text
note-on
note-off
seek
```

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

Keep two channels separate.

### Mechanical motion

```text
base angle
angular velocity
inertia
settling
```

### Musical evidence motion

```text
active scale degree
absolute note identity
carrier expression
note envelope
```

Do not rotate the whole Carousel toward every note.

Fast melody must not make the machine twitch.

---

## Pitch / degree interpretation

Canonical mapping:

```text
absolute note
+
tonal center / scale
↓
scale degree
↓
one of 8 carrier identities
```

Vertical expression may still use:

- note contour
- register
- octave relation
- intensity

but must remain bounded.

Do not use unbounded MIDI-to-pixel mapping.

---

## Carrier representation

Carriers remain media-neutral.

Do not use:

- horses
- animals
- mascots
- nostalgic fairground characters

Acceptable concepts:

- rounded plate
- capsule
- suspended platform
- media holder
- abstract mount

The mechanical system must not depend on carrier content.

---

## Actor-owned state

Likely state includes:

```text
angle
angularVelocity
targetMechanicalDrive
carrierStates[]
activeDegreeCarrier
absoluteActiveNote
expressionEnvelopes
```

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

Do not enable without an experience requirement.

---

## Seek behavior

On seek:

- synchronize current melodic evidence
- synchronize scale degree if available
- discard obsolete transient note envelopes
- do not replay skipped note-ons
- do not rotate through skipped notes
- preserve mechanical continuity where reasonable

---

## Pause behavior

On pause:

- no new note progression
- no new note events
- mechanical inertia may continue settling
- current carrier expression may decay naturally

---

## Reduced motion

Preserve:

```text
absolute note identity
scale-degree identity when available
```

Reduce:

- rotation
- large vertical travel
- prolonged movement

---

# 9. FerrisWheel

## Musical responsibility

FerrisWheel represents:

```text
HARMONY

CHORD IDENTITY

SIMULTANEOUS CHORD-TONE MEMBERSHIP

TONAL CENTER

MODULATION DISTANCE

SUSTAINED HARMONIC RELATIONSHIPS
```

FerrisWheel is the primary tonal / harmonic actor.

---

## Exact chord evidence

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

The corresponding cabins activate simultaneously.

This is Musical Evidence.

---

## 12 pitch-class cabins

There are 12 harmonic cabins.

Each cabin retains one absolute pitch-class identity.

Pitch classes remain canonical:

```text
C  = 0
C# = 1
D  = 2
D# = 3
E  = 4
F  = 5
F# = 6
G  = 7
G# = 8
A  = 9
A# = 10
B  = 11
```

---

## Final display order

Future FerrisWheel display order:

```text
C
G
D
A
E
B
F#
C#
G#
D#
A#
F
```

Conceptual pitch-class order:

```text
[0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]
```

Changing display order must not change pitch-class truth.

---

## Two-layer harmonic motion

FerrisWheel should separate:

### Cabin layer

Shorter timescale:

```text
current chord
→ exact chord-tone cabins active
```

Example:

```text
C major
→ C / E / G
```

### Wheel layer

Longer timescale:

```text
tonal center
→ wheel target angle
```

Modulation becomes physical rotation.

Nearby tonal centers require short movement.

Distant tonal centers require larger movement.

Circle-of-fifths distance gives the rotation musical meaning.

---

## Tonic boarding position

Future target:

```text
current tonic cabin
→ bottom / boarding position
```

This provides a physical interpretation of tonal center.

The bottom of the wheel becomes the tonal boarding point.

---

## Wheel dynamics

The wheel should behave as a high-inertia system.

Preferred:

```text
tonal-center target
→ damped / heavy wheel response
```

The wheel should:

- move slowly
- lag changes
- respond clearly to meaningful modulation
- ignore local chord chatter

Do not rotate the whole wheel on every chord change.

---

## Cabin dynamics

Cabins remain suspended and gravity-oriented.

Wheel acceleration / deceleration may produce:

```text
secondary pendulum swing
```

Chord activation may produce:

- local accent
- small bounded impulse
- root emphasis where truthful

Do not distort pitch-class membership.

---

## Core musical inputs

### Continuous

```text
harmony.available
harmony.chord
harmony.rootPitchClass
harmony.pitchClasses
harmony.confidence

future:
tonalCenter.available
tonalCenter.rootPitchClass
tonalCenter.mode
tonalCenter.confidence
tonalCenter.progress

transport.time
```

### Discrete

```text
chord-change
future tonal-center-change
seek
```

---

## Actor-owned state

Likely state:

```text
wheelAngle
wheelAngularVelocity
targetTonalAngle
cabinSwing[]
activePitchClasses[]
currentChord
```

---

## PhysicsWorld role

Current:

```text
Autonomous Actor
```

Future:

```text
Physics Receiver — possible user drag
Force Source — optional
Collider — optional
```

Do not let user interaction rewrite source harmony.

---

## Seek behavior

On seek:

- synchronize current chord
- synchronize exact pitch-class membership
- synchronize tonal-center target if available
- do not replay skipped chord changes
- do not rotate through historical modulations

---

## Pause behavior

On pause:

- musical harmonic progression stops
- wheel inertia may continue settling
- cabin pendulum motion may continue damping
- evidence remains synchronized to current paused chord

---

## Reduced motion

Preserve:

```text
exact chord-tone membership
tonal-center identity
```

Reduce:

- large wheel rotation
- cabin swing amplitude
- secondary mechanical motion

---

# 10. PirateShip

## Musical responsibility

PirateShip represents:

```text
GROOVE

SWING

CONTINUOUS RHYTHMIC PHASE
```

It is not a percussion-event display.

---

## Musical Evidence

PirateShip consumes continuous rhythmic truth.

Examples:

```text
beat phase
groove
swing
tempo
confidence
```

---

## Core musical inputs

### Continuous

```text
rhythm.available
rhythm.bpm
rhythm.beatPhase
rhythm.groove
rhythm.swing
rhythm.confidence
```

### Discrete

Potentially:

```text
beat
seek
```

but discrete beat events must not replace continuous phase.

---

## Physical language

PirateShip owns:

```text
pivot
pendulum angle
angular velocity
gravity
drive torque
damping
settling
```

---

## Groove interpretation

Rhythm may influence:

```text
drive timing
asymmetry
phase bias
bounded amplitude
```

Do not directly set ship angle from beat phase.

---

## Important constraint

PirateShip must not subscribe directly to:

```text
kick
snare
hat
raw onset
```

Those belong to percussion / BumperCars.

---

## PhysicsWorld role

Current:

```text
Autonomous Actor
```

Possible future:

```text
Force Source
Collider
```

only if required.

---

## Seek behavior

On seek:

- immediately resolve current beat phase
- do not replay skipped beats
- reconcile drive state
- preserve physical continuity where appropriate

---

## Pause behavior

On pause:

- rhythmic drive stops progressing
- pendulum may continue naturally
- damping continues

---

## Reduced motion

Preserve:

```text
rhythmic phase identity
```

Reduce:

- swing amplitude
- prolonged movement

---

# 11. BumperCars

## Musical responsibility

BumperCars represents:

```text
PERCUSSION

TRANSIENT IMPULSES

COLLISION ENERGY
```

---

## Final six-car representation

Milestone 9G:

```text
6 cars
=
6 percussion roles
```

Locked semantic set:

```text
1. Kick
2. Snare
3. Closed Hat
4. Open Hat / Cymbal
5. Tom / Low Percussion
6. Other Percussive
```

This role set may evolve only through an explicit milestone.

Do not force uncertain events into a named instrument merely to fill all six
roles.

---

## Percussion-analysis source

Implemented deterministic baseline:

```text
AudioBuffer
↓
existing shared STFT
↓
positive spectral-difference percussive evidence
↓
onset detection
↓
local spectral / temporal descriptors
↓
percussion role
↓
AudioWorld percussion event
```

Useful descriptors may include:

- low-band energy
- mid/high ratio
- spectral centroid
- transient duration
- spectral spread
- decay
- onset strength

Frequency band alone is insufficient.

---

## Core musical inputs

### Continuous

Possible:

```text
percussion.available
percussion.activity
percussion.confidence
```

### Discrete

```text
kick
snare
closed-hat
open-hat
tom
other-percussion
seek
```

---

## Physical language

BumperCars owns:

```text
multiple dynamic car bodies
position
velocity
heading
angular velocity
collision bounds
wall collisions
car-to-car collisions
damping
```

---

## Percussion interpretation

Musical event:

```text
kick
```

should mean:

```text
Kick car receives physical impulse
```

not:

```text
fake collision occurs
```

The same applies to other percussion roles.

---

## Critical causal rule

Correct:

```text
percussion event
→ car impulse
→ physical movement
→ actual collision
→ PhysicsWorld impact
```

Wrong:

```text
percussion event
→ pre-authored collision animation
```

---

## PhysicsWorld role

BumperCars may be:

```text
Dynamic Bodies
Colliders
Force Sources through real collision impacts
Physics Receivers where shared forces apply
```

---

## Shared-impact evidence

Only real collision results may become shared impacts.

Example:

```text
Kick car hits Snare car
↓
actual collision impulse
↓
PhysicsWorld transient impact
```

---

## Seek behavior

On seek:

- do not replay skipped percussion
- discard obsolete transient musical impulses
- preserve or reconcile physical state according to current actor rules

---

## Pause behavior

On pause:

- no new musical impulses
- cars may continue physically
- collisions may still occur from existing momentum

---

## Restart behavior

Restart may restore deterministic initial car configuration.

---

## Reduced motion

Preserve:

```text
percussion-role identity
```

Reduce:

- impulse magnitude
- angular response
- collision speed

---

# 12. DropTower

## Musical responsibility

DropTower represents:

```text
STRUCTURE

BUILD

TENSION

EXPLICIT MAJOR DROP

REBOUND
```

---

## Musical Evidence

DropTower consumes structural truth.

Examples:

```text
section progression
build
tension
release probability
explicit drop event
```

---

## Core musical inputs

### Continuous

```text
structure.available
structure.section
structure.build
structure.tension
structure.confidence
```

### Discrete

```text
section-change
drop
seek
```

---

## Physical language

DropTower owns an actor-local state machine:

```text
IDLE
LIFTING
HOLDING
DROPPING
REBOUND
SETTLING
```

Actor state controls:

- carriage height
- lift speed
- hold
- release
- braking
- rebound
- settling

---

## Structural interpretation

Build / tension may prepare:

```text
lift
hold
anticipation
```

Explicit release evidence authorizes:

```text
major drop
```

High energy alone is not enough.

---

## Critical evidence rule

Do not implement:

```text
energy > threshold
→ drop
```

unless the structure-analysis contract explicitly defines that evidence as a
valid release event.

---

## Attention relationship

DropTower does NOT direct other actors.

Correct:

```text
AudioWorld.structure
├─→ DropTower
└─→ Attention Resolver
```

Wrong:

```text
DropTower state
→ tell FerrisWheel to become Ambient
```

Structure may act like a composition-level conductor.

DropTower itself does not.

---

## PhysicsWorld role

Current default:

```text
Autonomous Actor
```

Possible future:

```text
Force Source
```

only from actual physical carriage motion if needed.

---

## Seek behavior

### Seek into build

Reconcile to an appropriate lifted / lifting state.

### Seek into hold

Reconcile to hold semantics.

### Seek after drop

Do not replay the historical drop.

Resolve current structural state directly.

---

## Pause behavior

Pause is state-aware.

Possible:

- lifting may pause musical drive
- holding may remain held
- dropping may continue physical fall
- rebound / settling may continue

---

## Reduced motion

Preserve:

```text
build
hold
release identity
```

Reduce:

- travel distance
- acceleration
- rebound amplitude

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

SONG-SPECIFIC TRACK MORPHOLOGY
```

---

## Core design change

RollerCoaster no longer has one permanent canonical route geometry.

The canonical asset is:

```text
TRACK GRAMMAR
```

Each song generates:

```text
TRACK INSTANCE
```

This is a semantic contract.

---

## Whole-song generation

Track generation happens after analysis and before / independently of runtime
playback.

Conceptually:

```text
whole-song energy envelope
+
structure timeline
+
phrase boundaries
+
tension / release evidence
↓
Track Planner
↓
TrackMap
```

The track must remain stable during playback.

Do not deform track geometry every frame from current loudness.

---

## Track grammar

The RollerCoaster should still read mechanically as a RollerCoaster.

Grammar may include:

```text
Station
Lift
Crest
Drop
Loop
Runout
```

These are semantic mechanical primitives.

Song evidence determines:

- where they appear
- how large they are
- how intense they are
- how far apart they are
- how many major features are justified
- how the full route occupies its district

---

## Do not generate a waveform

Wrong:

```text
energy envelope
→ y coordinate
→ waveform-like track
```

Correct:

```text
musical evidence
→ mechanical feature planner
→ RollerCoaster grammar
→ track geometry
```

A track must look like a designed physical machine.

---

## Example mapping

Milestone 9F baseline rules:

```text
long build
→ Lift

major tension peak
→ Crest

major release
→ Drop

sustained high energy
→ Loop / aggressive geometry

breakdown
→ lower flatter region

ending
→ Runout / Station
```

Exact mapping belongs to a dedicated milestone.

---

## TrackMap

Future TrackMap may contain:

```text
TrackMap {
  points[]
  segments[]

  station
  lifts[]
  crests[]
  drops[]
  loops[]
  runouts[]

  sourceEvidence
}
```

Every major feature should retain evidence provenance.

Example:

```text
drop-2

sourceEvidence:
  section = B
  releasePeak = 0.91
  time = 92.4s
```

---

## Runtime rider semantics

After track generation:

```text
TrackMap
↓
actor-local rider simulation
```

Actor simulation owns:

```text
routeDistance
velocity
acceleration
gravity
drag
segment behavior
```

Do not set routeDistance directly from phraseProgress.

---

## Phrase interpretation

Phrase evidence may influence:

- drive
- restraint
- braking tendency
- available momentum
- rider energy

But geometry belongs to TrackMap.

Runtime phrase evidence should not rewrite track shape.

---

## Rider / media boundary

The rider / vehicle may remain abstract.

Current Orb-like rider is acceptable.

Do not introduce a themed coaster train unless explicitly required.

---

## PhysicsWorld role

RollerCoaster actual movement may generate:

```text
continuous directional wake
```

Wake must derive from:

```text
actual rider / train position
actual forward direction
actual speed
bounded acceleration
```

not directly from music.

---

## Seek behavior

On seek:

- synchronize current phrase / section evidence
- do not replay historical route events
- reconcile rider state using explicit current rules
- track geometry remains unchanged for the current song

---

## Pause behavior

On pause:

- musical drive stops progressing
- physical momentum may continue according to current simulation
- wake derives only from actual motion

---

## Restart behavior

Restart may:

- reset rider to Station
- reset simulation deterministically

TrackMap remains the same for the current song.

---

## Song replacement

Song replacement may regenerate:

```text
TrackMap
```

The actor implementation remains the same.

---

## Reduced motion

Preserve:

```text
song-specific track shape
phrase identity
```

Reduce:

- rider speed
- acceleration
- wake strength
- violent motion

---

# 14. Free Bodies / Orb

## Musical responsibility

Free Bodies represent:

```text
TEXTURE

ATMOSPHERE

BRIGHTNESS

SPECTRAL ACTIVITY
```

---

## Core musical inputs

```text
spectrum.available
spectrum.low
spectrum.mid
spectrum.high
spectrum.brightness
spectrum.texture
```

---

## Physical inputs

```text
PhysicsWorld forces
collision responses
wake
impacts
exclusion fields
```

---

## Physical language

Free Bodies own:

```text
position
velocity
mass
drag
radius
environment force
PhysicsWorld force
combined force
sleep / wake
```

---

## Important constraint

Free Bodies are not Balloons.

Do not add:

- strings
- literal balloon semantics
- pre-authored sine-wave paths

Their identity comes from physical movement.

---

## PhysicsWorld role

Typical:

```text
Physics Receiver
Collider
Dynamic Body
```

---

## Seek behavior

Spectrum synchronizes immediately.

Existing physical position does not necessarily reset.

---

## Pause behavior

Musical environmental force may stop progressing.

Existing physical momentum continues.

---

## Reduced motion

Reduce:

- turbulence
- acceleration
- wake response

Preserve atmospheric identity.

---

# 15. Ordinary content participants

Ordinary content may participate in PhysicsWorld without becoming musical
actors.

Examples:

- text
- logo
- image
- card
- navigation
- content block

---

## Anchored content model

Use:

```text
current authored layout
+
temporary physics offset
=
rendered transform
```

Content returns to its current layout anchor.

PhysicsWorld must not own page layout.

---

## Validated content causality

Validated:

```text
BumperCars real collision
→ PhysicsWorld impact
→ Anchored Content
```

and:

```text
RollerCoaster actual movement
→ directional wake
→ Anchored Content
```

---

# 16. Material response concept

Different content may interpret the same PhysicsWorld force differently.

### Text

Possible response:

```text
split
tilt
displace
recover
```

### Image

Possible response:

```text
tilt
warp
displace
recover
```

### Card

Possible response:

```text
translate
rotate
spring
recover
```

### Navigation

Possible response:

```text
impulse
separate
rejoin
```

### Free Body

Possible response:

```text
accelerate
collide
continue dynamically
```

Material response is downstream of PhysicsWorld.

---

# 17. Musical evidence matrix

| Actor | Primary evidence | Secondary evidence | Final semantic representation |
|---|---|---|---|
| Carousel | melody note | tonal context | scale degree 1–7 + octave tonic, with absolute MIDI preserved |
| FerrisWheel | chord pitch classes | tonal center / modulation | circle-of-fifths cabins + wheel orientation |
| PirateShip | beat phase / groove | swing / BPM | pendulum timing |
| BumperCars | percussion roles | onset intensity | 6 role-specific cars |
| DropTower | structure / build / drop | tension | structural state machine |
| RollerCoaster | whole-song energy / phrase / structure | release | song-generated TrackMap + rider |
| Free Bodies | spectrum / texture | PhysicsWorld forces | atmospheric dynamic bodies |

---

# 18. AudioWorld dependency matrix

| Actor | Snapshot domains | Events |
|---|---|---|
| Carousel | melody, future tonal context | note-on, note-off, seek |
| FerrisWheel | harmony, future tonalCenter | chord-change, future tonal-center-change, seek |
| PirateShip | rhythm | beat optional, seek |
| BumperCars | future percussion | percussion events, seek |
| DropTower | future structure | section-change, drop, seek |
| RollerCoaster | future phrase / structure / energy | section / phrase events where needed, seek |
| Free Bodies | spectrum | seek only if required |

No actor reads raw PCM directly.

---

# 19. PhysicsWorld role matrix

| Actor | Force Source | Receiver | Collider | Dynamic Body |
|---|---:|---:|---:|---:|
| Carousel | optional | optional | optional | actor-local |
| FerrisWheel | optional | future | optional | actor-local |
| PirateShip | optional | optional | optional | actor-local |
| BumperCars | collision impacts | yes | yes | yes |
| DropTower | optional | optional | optional | actor-local |
| RollerCoaster | wake | optional | optional | actor-local |
| Free Bodies | usually no | yes | yes | yes |
| Anchored Content | no | yes | optional | no |

This table may evolve through explicit milestones.

---

# 20. Renderer independence

Renderers display simulation state.

They do not become simulation truth.

Possible renderers:

- DOM
- SVG
- Canvas
- Three.js
- WebGL

Changing visual technology must not redefine musical semantics.

---

# 21. Doodle visual language

Current visual direction:

```text
technical doodle
mechanical sketch
annotated spatial score
```

Doodle is renderer-only.

It must not alter:

- pitch identity
- pitch-class membership
- scale degree
- track geometry truth
- collision bounds
- PhysicsWorld coordinates
- actor simulation

Preferred precision hierarchy:

```text
Musical Evidence
→ cleanest

Actor mechanics
→ lightly hand-drawn

Infrastructure
→ slightly looser

Districts / annotations
→ loosest
```

The park may look hand-drawn.

The music remains exact.

Hand-drawn perturbation must be deterministic.

Do not create frame-to-frame shimmer.

---

# 22. Experience hierarchy

Actors may be:

```text
Primary
Secondary
Ambient
Resting
```

This changes presentation only.

Do not change evidence membership.

Example:

```text
FerrisWheel Ambient
→ C / E / G still active
```

An actor may remain musically active while visually Ambient.

---

# 23. Structural attention

Future structure evidence may guide attention.

Use:

```text
AudioWorld.structure
↓
Attention Resolver
↓
Primary / Secondary / Ambient / Resting
```

DropTower is a sibling consumer.

Do not make DropTower the controller.

---

# 24. Park Map / Spatial Score relationship

The Park Map is a shared physical world.

It is not seven widgets arranged together.

Important relationships:

```text
FerrisWheel
→ tonal world

Carousel
→ melodic movement inside tonal world

DropTower
→ structural tension / release

RollerCoaster
→ song-wide morphology / phrase journey

PirateShip
→ continuous rhythmic phase

BumperCars
→ discrete percussion

Free Bodies
→ sonic atmosphere
```

The map should make these scales coexist without requiring every actor to be
equally visually dominant at all times.

---

# 25. Park Train

Park Train is not a musical actor.

It belongs to Experience Composition.

Role:

```text
circulation
perimeter
orientation
infrastructure
```

Do not subscribe Park Train to AudioWorld.

Do not use it to represent phrase or rhythm.

Park Train must remain visually quieter than musical actors.

---

# 26. Future Performance / Intervention behavior

User interaction may eventually disturb audible performance.

Examples:

```text
BumperCars collision
→ short audio FX event
```

```text
FerrisWheel drag
→ resonator / filter modulation
```

This must occur through a separate Performance / Intervention Layer.

Do not rewrite source AudioWorld Musical Evidence.

---

## Intervention levels

### Physical only

```text
interaction
→ PhysicsWorld
→ visual consequence
```

### Performance FX

```text
physical consequence
→ audio processing
→ altered audible output
```

Source evidence remains unchanged.

### Musical transformation

Examples:

```text
transpose
tempo shift
mute chord tone
restructure
```

These change musical content and require explicit evidence transformation.

Do not treat them as ordinary FX.

---

# 27. Current validated state

Real-audio validated:

```text
Spectrum / Texture
→ Free Bodies

Rhythm / Beat
→ PirateShip

Predominant Melody
→ Carousel

Harmony / Chord Tones
→ FerrisWheel
```

Current analysis milestones:

```text
9A Spectrum  ✅
9B Rhythm    ✅
9C Melody    ✅
9D Harmony   ✅
```

Shared-world validated:

```text
BumperCars actual collision
→ PhysicsWorld impact
→ Anchored Content
```

```text
RollerCoaster actual movement
→ PhysicsWorld wake
→ Anchored Content
```

---

# 28. Transitional vs final actor semantics

### Carousel

Current:

```text
modulo 8 mechanical allocation
+
exact absolute note label
```

Final:

```text
scale degrees 1–7
+
octave tonic
+
absolute MIDI truth preserved
```

### FerrisWheel

Current:

```text
chromatic cabin display
+
exact chord-tone membership
```

Final:

```text
circle-of-fifths display
+
exact chord-tone membership
+
tonal-center orientation
```

### RollerCoaster

Current:

```text
fixed segmented track
```

Final:

```text
song-generated track instance
from canonical track grammar
```

Do not treat transitional implementations as permanent contracts.

---

# 29. Recommended development sequence

### 8B.2 — Doodle Visual Language

Presentation only.

### 9D.1 — Tonal Center / Key Foundation

```text
long-window chroma
→ tonal center
→ modulation
```

### 9D.2 — Circle-of-Fifths FerrisWheel

```text
chord → exact cabins
tonal center → wheel angle
tonic → bottom boarding
```

### 9E — Structure Analysis Foundation

```text
beat-synchronous features
→ self-similarity matrix
→ novelty
→ section timeline
```

### 9E.1 — Structural Attention

```text
structure
→ Attention Resolver
```

### 9F — Song-Generated RollerCoaster

```text
energy + structure + phrase
→ TrackMap
```

### 9G — Percussion Classification

```text
HPSS percussive
→ onset
→ percussion roles
→ six BumperCars
```

### 9H — Carousel Scale-Degree Representation

```text
melody + tonal center
→ scale degree
→ 8 carriers
```

Future:

```text
Performance / Intervention Layer
```

---

# 30. Actor integration checklist

Before adding or changing an actor, verify:

1. What Musical Evidence does it own?
2. Is that evidence actually available?
3. What AudioSnapshot fields does it read?
4. What AudioEvents does it read?
5. What does the actor simulate locally?
6. What belongs to renderer only?
7. What physical outputs reach PhysicsWorld?
8. What does seek mean?
9. What does pause mean?
10. What does restart mean?
11. What does reduced motion preserve?
12. Does presentation alter evidence?
13. Is any transitional implementation being mistaken for final semantics?
14. Does a physical effect arise from actual actor state rather than upstream
    musical shortcuts?
15. Does any future user intervention alter only performance output or musical
    source truth?

---

# 31. Objective vs subjective QA

Objective QA may verify:

- exact note identity
- scale-degree mapping
- exact chord pitch classes
- FerrisWheel cabin membership
- tonal-center angle mapping
- percussion-role classification output
- TrackMap determinism
- TrackMap source evidence
- event timing
- seek behavior
- PhysicsWorld registration
- actor instance count
- bounded values
- no NaN / Infinity
- test / typecheck / build status
- no duplicate actor simulation
- no duplicate musical clock

Subjective QA belongs to the user:

- visual quality
- musical plausibility
- mechanical feel
- doodle quality
- tension
- spatial readability
- whether song-generated track feels meaningful
- whether attention hierarchy feels natural
- whether real transcription feels musically correct

---

# 32. Ride-map invariant

For every actor, ask:

```text
What musical truth belongs here?

How is that truth represented locally?

What is mechanical motion versus Musical Evidence?

What simulation state belongs to the actor?

What actual physical consequence reaches PhysicsWorld?

What is presentation only?

Is the current implementation transitional or final?
```

The actor set should feel like one shared musical model, not seven unrelated
visualizers.

The final conceptual hierarchy remains:

```text
Whole Song
→ Structure / Energy
→ DropTower + RollerCoaster

Tonal World
→ FerrisWheel
→ Carousel

Time / Groove
→ PirateShip + BumperCars

Sonic Material
→ Free Bodies
```

The project goal is:

```text
one song
→ one shared park
→ one song-specific physical world
→ precise local Musical Evidence
→ physically meaningful interactions
→ a spatial score that can be watched, explored, and eventually played
```

---

# 33. Milestone 9E.2 evidence compatibility

Repetitive and texture-driven music uses the same analysis architecture as all
other material. Rhythm combines full-band, low-band, high-band subdivision, and
energy-pulse evidence without genre labels. Structure separates short-scale
Arrangement Changes from medium/long-scale Section Boundaries. Beat-count block
alignment is a bounded bonus and does not claim meter.

```text
Arrangement Change ≠ Section Boundary
Structure operates at multiple temporal scales
Musically Resting ≠ Physically Inactive
```

Arrangement evidence remains analysis-only. It does not emit section changes,
retune Structural Attention, activate DropTower, create RollerCoaster phrase
evidence, or alter actor simulation and PhysicsWorld state.

---

# 34. Milestone 9H.1 liveness map

```text
Rhythm snapshot
→ ParkPulse
→ PhysicsWorld
├── Anchored Content receiver
└── Free Bodies receivers
```

ParkPulse is a shared physical source, not a musical actor and not a direct ride
input. Carousel can continue neutral mechanical idle when melody is unavailable,
but its note, degree, and carrier evidence remain empty. Its short presentation
envelope never delays or rewrites evidence. Free Bodies keep their existing
spectrum atmosphere and shared-force simulation; only Park Map prominence is
reduced.

---

# 35. Milestone 9I DropTower interpretation map

DropTower now accepts authored and analyzed structure through one explicit drive
contract. Authored fixtures keep their exact authored cues. Analyzed structure
uses bounded build, tension, and release heuristics before it may request a
physical state transition from the same existing simulation.

```text
current AudioWorld.structure snapshot
+ forward section-change cue at the current boundary
→ DropTower real-structure adapter
→ build / tension / release / lift intent / hold intent / drop authorization
→ existing actor-local state machine
```

`section-change ≠ Drop`. Arrangement changes do not lift, hold, or drop the
tower. High energy alone does not lift it. Drop authorization requires sustained
preparation and combined strong release evidence, then starts a six-second
cooldown. A hold may return through SETTLING when release evidence disappears.
Seek reconciles only the destination snapshot and never replays historical
drops.

The two structure consumers remain independent:

```text
AudioWorld.structure
├─→ Structural Attention
└─→ DropTower
```

Neither controls the other. ParkPulse remains on the separate
`rhythm → PhysicsWorld → receiver` path. DropTower structure evidence does not
emit a shared-world force. `Musically Resting ≠ Physically Inactive`; inertia,
fall, rebound, and settling may continue after current musical intent becomes
neutral.
