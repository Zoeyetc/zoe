# Z.land Music Box — Architecture v0.4

## 1. System definition

Z.land Music Box is a shared computational physical world driven by music.

It is not a conventional audio visualizer.

It is not a collection of independent ride animations synchronized to the same
song.

It is not a dashboard that reduces music to generic activity indicators.

It is not a decorative audio visualizer.

The system must preserve three things simultaneously:

1. precise Musical Evidence;
2. expressive physical interpretation;
3. shared physical causality.

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
- Musical Evidence
- actor interpretation
- actor-local simulation
- shared physical causality
- rendering
- experience composition
- audience controls
- developer instrumentation
- future performance intervention

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

Future Performance / Intervention Layer
→ modifies audible output without rewriting source Musical Evidence
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

beat phase = 0.34

swing = 0.68

section B begins

build = 0.82

drop occurs at 13.0s

phrase tension is rising

current tonal center = G major

spectrum brightness = 0.71
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
- scale degree
- chord identity
- chord-tone membership
- tonal center
- modulation
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

> What does this Musical Evidence mean to this machine?

Examples:

```text
scale degree 3
→ Carousel degree-3 carrier expression

C / E / G
→ FerrisWheel exact harmonic cabins active simultaneously

G major tonal center
→ FerrisWheel target wheel orientation

kick
→ Kick BumperCar receives impulse

swing / groove
→ PirateShip drive timing

build / tension / drop
→ DropTower lift / hold / release

whole-song energy + structure + phrase
→ song-specific RollerCoaster track geometry
```

Actor interpretation may be expressive.

It must not falsify Musical Evidence.

---

### 3.3 Experience Composition

Experience Composition answers:

> How should the visitor notice and understand the shared world?

Responsibilities may include:

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

It must not activate extra notes, hide real chord tones, invent musical events,
or rewrite actor simulation.

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

Future Performance / Intervention Layer sits downstream of source truth and
must remain separate from AudioWorld evidence.

---

## 5. Musical evidence accuracy

Musical activation is evidence, not decoration.

If an actor-local visual element represents a musical fact, it must correspond
to actual AudioWorld data.

Examples:

```text
Carousel degree carrier active
→ corresponding melodic scale degree is actually present
```

```text
FerrisWheel C / E / G cabins active
→ C / E / G are actual members of the current chord representation
```

```text
Kick BumperCar receives musical impulse
→ a kick-class percussion event actually occurred
```

```text
DropTower releases
→ explicit structural drop / release evidence exists
```

Do not:

- activate extra musical carriers for symmetry
- remove real chord tones because an actor is visually Ambient
- invent percussion to increase motion
- fabricate confidence
- treat domain availability as a decorative status light
- allow Experience Composition to modify musical truth
- map analysis uncertainty into fake certainty

A useful internal principle is:

```text
If it looks like musical evidence,
it must be musical evidence.
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

It is a persistent spatial representation of simultaneous musical dimensions.

However:

```text
Park Map
≠
Musical Evidence
```

The map organizes the world.

The actors expose the music.

---

## 7. Hierarchical musical model

The actors operate at different semantic and temporal scales.

A useful conceptual hierarchy is:

```text
                     WHOLE SONG
                        │
              ┌─────────┴─────────┐
              ↓                   ↓
          Structure            Energy
              ↓                   ↓
         DropTower        RollerCoaster Track
              │
              ↓
         Attention

────────────────────────────────────

                  TONAL WORLD
                        │
                  FerrisWheel
             tonal center + chords
                        │
                        ↓
                   Carousel
                  scale degree

────────────────────────────────────

                  TIME / GROOVE
                        │
                   PirateShip
                        │
                   BumperCars

────────────────────────────────────

                 SONIC MATERIAL
                        │
                   Free Bodies
```

This hierarchy must not become hard-coded orchestration between actors.

Shared Musical Evidence may have multiple downstream consumers.

---

## 8. Park Map / district boundary

Spatial composition may use districts or actor regions.

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
specific melodic degree evidence appears on Carousel carriers
```

```text
FerrisWheel district exists
but
specific harmonic evidence appears on exact cabins
```

The region itself must not substitute for precise Musical Evidence.

---

## 9. Region emphasis

Region emphasis is an Experience Composition tool.

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
actual melody evidence
→ local Carousel evidence

optional district emphasis
→ helps visitor notice it
```

---

## 10. Experience hierarchy

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
- annotation visibility
- region emphasis

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
FerrisWheel becomes Ambient
→ preserve exact chord-tone membership
→ reduce structural contrast
```

Musical state and presentation role are separate.

An actor may be:

```text
musically active = true
presentation role = Ambient
```

---

## 11. Structural attention rule

Structure may influence Experience Composition.

Use:

```text
Structure Analysis
↓
AudioWorld.structure
├─→ DropTower
└─→ Attention Resolver
```

Do NOT use:

```text
DropTower
→ commands other actors
```

DropTower is an interpreter of structure.

It is not an orchestrator.

Experience Composition independently consumes the same structural evidence.

This distinction prevents actor-to-actor control coupling.

---

## 12. Audio analysis boundary

Audio analysis and runtime interpretation remain separate.

Canonical boundary:

```text
Audio Source
↓
Analysis Pipeline
↓
AudioMap
──────── runtime boundary ────────
AudioMap + AudioClock
↓
AudioWorld
```

Actors must not analyze raw audio directly.

Do not allow:

- Carousel to read PCM
- FerrisWheel to read FFT frames directly
- BumperCars to run onset detection
- DropTower to inspect waveform energy
- RollerCoaster renderer to infer structure

All musical truth enters through AudioWorld.

---

## 13. Real-audio analysis domains

The current real-audio pipeline validates:

```text
Spectrum / Texture
Rhythm / Beat
Predominant Melody
Harmony / Chords
```

Current and future capability model may include:

```text
spectrum
rhythm
melody
harmony
structure
percussion
tonalCenter
phrase
```

Each domain must expose availability and confidence where appropriate.

Unavailable domains must remain unavailable.

Do not fabricate evidence merely to keep actors active.

---

## 14. Partial musical understanding

The park must support partial understanding.

Example:

```text
spectrum = available
rhythm = available
melody = unavailable
harmony = unavailable
structure = unavailable
```

Then:

```text
Free Bodies → active
PirateShip → active
Carousel → resting
FerrisWheel → resting
DropTower → resting
RollerCoaster → resting
```

This is correct.

The system must prefer:

```text
less motion + truthful evidence
```

over:

```text
full park activity + fabricated evidence
```

---

## 15. Melody evidence source hierarchy

Melody evidence may come from sources of different reliability.

Preferred hierarchy:

```text
1. MIDI / symbolic input
2. isolated melody stem
3. predominant melody analysis
4. unavailable
```

The system should preserve source provenance.

Example:

```text
melody.source = "midi"
melody.confidence = 1.0
```

or:

```text
melody.source = "predominant-analysis"
melody.confidence = 0.73
```

The current predominant-melody foundation remains valid.

Future MIDI input should not require rewriting Carousel or AudioWorld.

---

## 16. AudioMap

AudioMap is the analyzed representation of one song or fixture.

It may contain:

- metadata
- duration
- capability flags
- analysis metadata
- spectrum timeline
- rhythm analysis
- melody contour
- MelodyNote timeline
- harmony chroma frames
- ChordSegment timeline
- future tonal-center timeline
- future percussion-event timeline
- future structure timeline
- future phrase timeline
- future song-generated RollerCoaster TrackMap

AudioMap is not runtime mutable musical truth.

It is analyzed source data.

---

## 17. AudioClock

AudioClock owns authoritative musical transport time.

For real audio, authoritative time is synchronized to Web Audio playback.

Do not use:

```text
Date.now()
performance.now()
requestAnimationFrame accumulation
```

as musical truth.

RAF is only a render opportunity.

Pause, seek, restart, and playback replacement must all preserve AudioClock
authority.

---

## 18. AudioWorld

AudioWorld converts:

```text
AudioMap + AudioClock
```

into current Musical Evidence.

It owns:

- current continuous snapshot
- event timeline crossing
- current domain availability
- current confidence
- exact current note
- exact current chord tones
- current rhythm phase
- current spectrum
- future structure state
- future tonal-center state
- future percussion state
- future phrase state

AudioWorld must not command transforms.

Wrong:

```text
AudioWorld
→ rotate FerrisWheel 28°
```

Correct:

```text
AudioWorld
→ tonal center = G
```

Then FerrisWheel interprets that evidence.

---

## 19. AudioSnapshot

AudioSnapshot contains continuous current truth.

Conceptually:

```text
transport
rhythm
melody
harmony
structure
phrase
spectrum
tonalCenter
percussion
```

Fields should expose:

- availability
- confidence
- current values

where applicable.

Normalized scalar values should remain within documented ranges.

---

## 20. AudioEvents

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
closed-hat
open-hat
tom
other-percussion
chord-change
section-change
tonal-center-change
drop
seek
```

Events must be emitted through timeline-crossing logic.

Do not model short musical events only as frame-local booleans.

---

## 21. Event delivery

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

## 22. Seek semantics

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
- tonal-center changes
- structural drops
- collisions
- wake history

must not be replayed automatically.

Actor-specific reconciliation remains actor-owned.

---

## 23. Pause, restart, and replacement

### Pause

Pause stops musical transport.

It does not erase existing physical energy.

```text
Audio pause ≠ Physics reset
```

Actor simulation and PhysicsWorld may continue resolving existing physical
state.

### Restart

Restart returns musical transport to the beginning.

Actor-specific deterministic reset behavior may restore development initial
state.

Do not assume every visual object must teleport blindly.

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

Some song-derived geometry may be regenerated.

For example:

```text
new song
→ new RollerCoaster TrackMap
```

The park architecture remains.

---

## 24. Actor layer

Actors are autonomous physical interpreters.

Each actor receives Musical Evidence and decides what it means within its own
motion model.

AudioWorld must not command visual transforms directly.

Wrong:

```text
AudioWorld:
move Carousel carrier up 14 px
```

Correct:

```text
AudioWorld:
scale degree = 3
absolute note = E4
```

then:

```text
Carousel:
degree 3 maps to its carrier
```

then:

```text
Carousel simulation:
calculates actual motion
```

Actors retain high-frequency simulation state locally where practical.

---

## 25. Carousel contract

Carousel owns:

```text
melody
absolute note identity
scale-degree identity
local melodic motion
note expression
```

The canonical representation is:

```text
8 carriers
=
scale degrees 1–7
+
octave tonic
```

Example in C major:

```text
C4 → 1
D4 → 2
E4 → 3
F4 → 4
G4 → 5
A4 → 6
B4 → 7
C5 → 8 / octave tonic
```

Absolute truth remains preserved:

```text
E4
MIDI 64
scale degree 3
```

Carousel must not replace absolute note evidence with only relative degree.

The important distinction:

```text
whole-carousel mechanical motion
≠
local melodic evidence
```

Do not make whole-carousel motion chase fast note changes.

If tonal context is unavailable or insufficiently confident, do not fabricate scale degree.
Chromatic notes preserve absolute identity in a separate marker and never round
to the nearest diatonic degree. AudioWorld owns the derived degree evidence;
Carousel owns the explicit degree-to-carrier interpretation.

---

## 26. FerrisWheel contract

FerrisWheel owns:

```text
harmony
chord identity
simultaneous chord-tone membership
tonal center
modulation distance
sustained harmonic relationships
```

Current validated chord evidence uses exact pitch classes.

Example:

```text
C major
→ [0,4,7]
```

Future display order should use circle-of-fifths ordering:

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

Conceptual pitch-class display order:

```text
[0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5]
```

Pitch-class truth remains canonical.

Display order is actor interpretation.

Future FerrisWheel semantics:

```text
Chord
→ exact active cabins

Tonal center / key
→ wheel target orientation

Modulation
→ wheel rotation distance
```

The tonic cabin should target the bottom / boarding position.

Wheel rotation should be high-inertia and slow.

Local chord changes should not make the whole wheel twitch.

Suspended cabins remain gravity-oriented and may respond physically to wheel
acceleration.

---

## 27. PirateShip contract

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

Do not drive PirateShip directly from raw onsets.

---

## 28. BumperCars contract

BumperCars owns:

```text
percussion
transient impulses
collision energy
```

Milestone 9G representation:

```text
6 cars
→ 6 percussion roles
```

Locked initial role set:

```text
Kick
Snare
Closed Hat
Open Hat / Cymbal
Tom / Low Percussion
Other Percussive
```

The deterministic baseline derives from:

```text
shared-STFT positive spectral difference
↓
onset detection
↓
spectral / temporal descriptors
↓
percussion role candidate
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

Actual collision outcomes belong to simulation.

Do not author collision outcomes directly from percussion events.

```text
Percussion Event
→ actor-local role-car impulse
→ actual movement
→ actual collision
→ PhysicsWorld impact
```

Musically Resting does not mean Physically Inactive.

---

## 29. DropTower contract

DropTower owns:

```text
structure
build
tension
explicit major drop
rebound
```

Continuous structure prepares the actor.

Discrete `drop` / release evidence authorizes major release.

Do not trigger major release solely because energy is high.

DropTower is not the park conductor.

Shared structure may separately influence Experience Composition:

```text
AudioWorld.structure
├─→ DropTower
└─→ Attention Resolver
```

---

## 30. RollerCoaster contract

RollerCoaster owns:

```text
phrase
energy trajectory
tension
release
long-form development
song-specific track morphology
```

The previous fixed segmented route is no longer the long-term canonical
geometry.

The canonical contract is now:

> RollerCoaster owns a track grammar, not one permanent track shape.

Each analyzed song may generate one track instance.

Conceptually:

```text
whole-song energy
+
section structure
+
phrase boundaries
+
tension / release
↓
Track Planner
↓
song-specific TrackMap
```

The result must remain RollerCoaster-like.

Do not reduce this to:

```text
energy envelope
→ raw waveform-shaped path
```

Track grammar may contain:

```text
Station
Lift
Crest
Drop
Loop
Runout
```

but each song determines:

- ordering where allowed
- scale
- height
- spacing
- intensity
- number of major features

Runtime rider movement remains actor-local simulation.

Track generation happens from analyzed whole-song evidence, not frame-by-frame
during playback.

---

## 31. Song-generated RollerCoaster TrackMap

Milestone 9F materializes one actor-owned runtime instance:

```text
TrackMap {
  points
  segments
  station
  lifts
  crests
  drops
  loops
  runouts
  sourceEvidence
}
```

`sourceEvidence` is required.

Every major generated track feature should be explainable.

Example:

```text
major release at 92.4s
→ Drop segment
```

not:

```text
random geometry variation
→ Drop
```

The track is a musical artifact, not decorative procedural noise.

Track generation must be deterministic for the same analyzed song and
generation parameters.

---

## 32. Free Bodies / Orb contract

Free Bodies consume:

```text
AudioWorld spectrum / texture
+
PhysicsWorld forces
```

They are genuine Dynamic Bodies.

Possible state:

- position
- velocity
- mass
- drag
- turbulence
- collision response
- exclusion response

Do not implement them as decorative sine-wave particles.

Do not restore literal Balloon semantics.

---

## 33. PhysicsWorld

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
RollerCoaster rider / train
→ autonomous actor + Force Source
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

## 34. Validated shared causality

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

and:

```text
RollerCoaster actual movement
→ PhysicsWorld directional wake
→ Anchored Content Participant
```

The Anchored Content Participant does not subscribe directly to AudioWorld.

Preserve this distinction.

Future percussion classification may change which BumperCar receives the
initial impulse.

It must not change the rule that shared impact derives from actual collision.

---

## 35. Layout ownership

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

## 36. Spatial coordinate contract

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

## 37. Shared source types

PhysicsWorld may contain physically different shared effects.

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

### Continuous directional field / wake

Produced by:

```text
RollerCoaster actual movement
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

---

## 38. PhysicsWorld must see physical results

PhysicsWorld should receive physical facts.

It should not receive upstream musical semantics when a physical actor is
supposed to mediate the effect.

Correct:

```text
phrase / track conditions
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
→ Kick BumperCar impulse
→ actual collision
→ shared impact
```

Wrong:

```text
kick
→ shared collision effect
```

---

## 39. Cross-actor causality

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

## 40. Structure Analysis

Future structure analysis should operate on whole-song or beat-synchronous
features.

Preferred conceptual pipeline:

```text
audio features
↓
beat-synchronous feature sequence
↓
self-similarity matrix
↓
novelty / repetition analysis
↓
section boundaries
↓
section recurrence / identity
```

Initial section labels should prefer neutral identities:

```text
A
B
A'
C
```

rather than prematurely claiming:

```text
Verse
Chorus
Bridge
```

Useful structural evidence includes:

- boundary
- recurrence
- section energy
- section contrast
- structural importance

---

## 41. Phrase Analysis

Phrase analysis does not need to solve full symbolic phrase understanding.

A practical first baseline may use:

```text
Beat Grid
+
Section Boundaries
+
Energy Contour
↓
Phrase Candidates
```

Possible priors:

```text
4 bars
8 bars
```

Then adjust using:

- onset density
- melodic cadence proxies
- energy change
- section boundaries

RollerCoaster primarily needs:

```text
phrase begins
phrase develops
tension rises
release
phrase ends
```

not formal musicological terminology.

---

## 42. Tonal-center analysis

Future tonal-center analysis should use longer windows than chord analysis.

Possible foundation:

```text
long-window chroma
↓
key-profile comparison
↓
tonal-center candidate
↓
confidence
↓
non-causal temporal smoothing
```

Krumhansl-Schmuckler-style profiles are an acceptable baseline.

Offline analysis should exploit future context.

Do not artificially constrain tonal-center analysis to causal real-time
methods.

Tonal-center evidence should remain separate from individual chord identity.

---

## 43. Offline-analysis advantage

Z.land analysis is not limited to real-time causality.

Because the full song may be known before playback:

```text
full song known
↓
future + past context available
↓
non-causal smoothing
↓
more stable evidence
```

This advantage may be used for:

- chord smoothing
- tonal-center smoothing
- structure segmentation
- phrase segmentation
- song-generated track planning

Runtime Musical Evidence remains synchronized through AudioClock.

---

## 44. HPSS boundary

Future harmony and percussion work may use harmonic-percussive source
separation as analysis preprocessing.

Conceptually:

```text
STFT magnitude
↓
time-axis / frequency-axis median filtering
↓
harmonic mask + percussive mask
```

Use:

```text
harmonic component
→ chroma / harmony
```

```text
percussive component
→ onset / percussion classification
```

This is analysis preprocessing.

It is not yet source-separated playback.

HPSS must not become a second independent audio truth.

---

## 45. Performance / Intervention Layer

Future user interaction may influence audible playback.

This must remain separate from source Musical Evidence.

Do not implement:

```text
PhysicsWorld
→ rewrite AudioWorld source truth
```

Instead:

```text
Source Audio
↓
Playback
↓
Performance / Intervention Layer
↓
Audible Output
```

while:

```text
Source Audio
↓
Analysis
↓
AudioMap
↓
AudioWorld
```

remains the source-score truth.

Example future interaction:

```text
BumperCars real collision
→ Performance FX transient
```

or:

```text
FerrisWheel physical drag
→ resonator / filter modulation
```

The source Musical Evidence remains unchanged unless a future explicit musical
transformation layer also transforms evidence.

---

## 46. Physical-only vs performance vs transformation

Future interaction should distinguish three levels.

### Level 1 — Physical only

```text
user interaction
→ PhysicsWorld
→ visual physical consequence
```

Audio remains unchanged.

### Level 2 — Performance FX

```text
PhysicsWorld result
→ audio effect
→ modified audible output
```

Source Musical Evidence remains unchanged.

### Level 3 — Musical transformation

Examples:

- transpose
- tempo shift
- mute chord tone
- restructure
- scrub / reverse

These change musical content.

They require a corresponding evidence-transformation model.

Do not treat Level 3 as ordinary FX.

---

## 47. MotionWorld relationship

MotionWorld and AudioWorld are sibling domains.

```text
MotionWorld
→ page / scroll choreography

AudioWorld
→ musical time / musical truth
```

The Music Box does not require scroll to drive music.

Do not make song time depend on page scroll by default.

MotionWorld remains optional for page choreography.

---

## 48. Current development workbench

The vertically stacked Workbench exists for:

- actor isolation
- manual QA
- DebugConsole visibility
- regression inspection
- integration testing

It is not the final experience.

Do not optimize the architecture around:

```text
actor card
↓
scroll
↓
actor card
```

The Park Map remains the primary shared-world experience.

---

## 49. Current Park Map

The current Park Map contains:

- Carousel
- FerrisWheel
- PirateShip
- BumperCars
- DropTower
- RollerCoaster
- Free Bodies
- Park Train
- Gate
- Anchored Content

Park Train is Experience Composition infrastructure.

It is not a musical actor.

RollerCoaster is not the Park Train.

Do not merge their semantic roles.

---

## 50. Visual comprehension

The audience should not need prior music-theory knowledge.

Prefer:

```text
behavior first
terminology second
```

A visitor may understand:

- one Carousel carrier follows melodic position
- several FerrisWheel cabins form a chord
- the whole FerrisWheel shifts slowly with tonal center
- PirateShip embodies groove
- BumperCars embody percussion
- DropTower anticipates structural release
- RollerCoaster geometry belongs to the song
- Free Bodies embody sonic texture

without reading a theory textbook.

---

## 51. Rendering boundary

Renderers visualize state.

They do not own state truth.

Potential renderers include:

- DOM
- SVG
- Canvas
- Three.js
- WebGL
- shaders

Changing renderer technology must not require redesigning:

- AudioWorld
- Musical Evidence
- actor simulation
- PhysicsWorld

---

## 52. Doodle visual language boundary

The current visual direction is:

```text
technical doodle
+
mechanical sketch
+
annotated spatial score
```

Doodle treatment affects renderer output only.

It must not affect:

- canonical geometry
- collision geometry
- PhysicsWorld positions
- Musical Evidence
- actor state
- Focus bounds
- AudioWorld truth

Use:

```text
canonical geometry
↓
renderer-level deterministic hand-drawn treatment
↓
visible doodle
```

The visual principle is:

> The park is drawn by hand; the music is not.

Exact Musical Evidence should remain visually more precise than surrounding
doodle structure.

Doodle randomness, where used, must be deterministic.

The same geometry and seed must produce the same visible mark.

Do not introduce frame-to-frame visual shimmer as fake hand-drawn animation.

---

## 53. ControlSurface

ControlSurface is audience-facing.

Current responsibilities include:

- choose local audio
- prepare / analyze
- play
- pause
- seek
- restart
- switch to authored fixture
- replace song

Future Gate / Ticket metaphors remain presentation decisions.

ControlSurface requests actions.

It does not own AudioClock or AudioWorld state.

---

## 54. DebugConsole

DebugConsole is developer-facing.

It may expose:

### Transport

- current time
- duration
- play state
- source identity

### Analysis

- capabilities
- confidence
- analysis metadata
- analysis version

### Musical Evidence

- exact melody note
- melody source
- scale degree when available
- chord
- pitch classes
- tonal center
- beat / phase
- groove
- swing
- structure
- build
- tension
- phrase
- spectrum
- percussion class
- event history

### Actor State

- simulation mode
- position
- velocity
- acceleration
- angular state
- route state
- track identity
- settling state

### PhysicsWorld

- sources
- receivers
- impacts
- wakes
- force vectors
- response offsets

### Determinism

- seeds
- deterministic initial state
- song-derived TrackMap identity

Observability is more important than presentation.

---

## 55. Determinism

Emergent behavior does not mean untestable randomness.

Where stochastic behavior exists:

- use explicit seeded randomness
- expose relevant seeds where useful
- avoid uncontrolled random calls in simulation loops
- preserve reproducibility

Given:

```text
same AudioMap
same initial state
same parameters
same seed
```

the system should be reproducible enough to investigate.

Song-generated geometry must also be deterministic.

Doodle path perturbation must also be deterministic.

---

## 56. Performance and lifecycle

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
- bounded offline analysis algorithms
- reusable analysis results
- no duplicate decoding

Avoid:

- duplicate audio analysis
- duplicate global listeners
- independent clocks per actor
- uncontrolled randomness
- renderer state becoming simulation truth
- giant world components
- unnecessary global rerenders

Runtime and analysis performance must be measured.

---

## 57. Reduced motion

Reduced-motion behavior should preserve semantic identity.

Examples:

```text
Carousel
→ preserve exact note / degree identity
```

```text
FerrisWheel
→ preserve exact harmonic cabins and tonal-center identity
```

```text
PirateShip
→ preserve rhythmic-phase identity
```

```text
DropTower
→ preserve build / hold / release semantics
```

```text
RollerCoaster
→ preserve song-specific track morphology
```

Do not replace actor meaning with unrelated blinking.

---

## 58. Subjective QA boundary

Automated tests and Codex may verify objective facts.

Examples:

- tests pass
- typecheck passes
- build passes
- actor mounted
- event delivery correct
- carrier identity correct
- chord cabins equal pitch classes
- values bounded
- PhysicsWorld source registered
- receiver response spatially correct
- no NaN / Infinity
- deterministic output
- no duplicate actor simulation
- AudioClock synchronization
- capability flags
- track-generation provenance

Codex must not self-approve subjective qualities such as:

- visual quality
- mechanical feel
- musical feel
- tension
- pacing
- map readability
- aesthetic correctness
- transcription quality

The user performs final subjective QA.

---

## 59. Current validated state

The project currently validates real-audio foundations for:

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

Current real-analysis milestones:

```text
9A Spectrum foundation      ✅
9B Rhythm foundation        ✅
9C Melody foundation        ✅
9D Harmony foundation       ✅
```

Validated current behavior includes:

```text
real audio
→ decode
→ offline analysis
→ AudioMap
→ AudioWorld
→ existing actor adapters
```

and:

```text
BumperCars actual collision
→ PhysicsWorld impact
→ Anchored Content
```

and:

```text
RollerCoaster actual movement
→ PhysicsWorld wake
→ Anchored Content
```

Do not regress these contracts.

---

## 60. Current known transitional representations

Some current implementations are deliberately transitional.

### Carousel

Current:

```text
8 mechanical carriers
+
modulo allocation
+
exact noteName / MIDI label
```

Final target:

```text
scale degrees 1–7
+
octave tonic
```

with absolute MIDI truth preserved.

### FerrisWheel

Current:

```text
12 pitch-class cabins
+
chromatic display order
```

Final target:

```text
12 pitch-class cabins
+
circle-of-fifths display order
+
tonal-center-driven wheel orientation
```

### RollerCoaster

Current:

```text
fixed segmented track implementation
```

Final target:

```text
canonical track grammar
+
song-generated TrackMap
```

Do not mistake transitional implementation for final semantic contract.

---

## 61. Near-term sequence

Recommended next sequence:

### 8B.2 — Doodle Visual Language

Presentation only.

No musical-semantic changes.

### 9D.1 — Tonal Center / Key Foundation

```text
long-window harmonic chroma
→ tonal center
→ confidence
→ modulation timeline
```

### 9D.2 — Circle-of-Fifths FerrisWheel

```text
circle-of-fifths cabin display
+
chord → exact cabins
+
tonal center → wheel angle
+
tonic → bottom boarding position
```

### 9E — Structure Analysis Foundation

```text
beat-synchronous features
→ self-similarity
→ novelty / repetition
→ section timeline
```

### 9E.1 — Structural Attention

```text
AudioWorld.structure
→ Attention Resolver
```

### 9F — Song-Generated RollerCoaster

```text
energy
+
structure
+
phrase
→ TrackMap
```

### 9G — Percussion Classification / BumperCars

```text
HPSS percussive
→ onset
→ descriptors
→ percussion roles
→ 6 cars
```

### 9H — Carousel Scale-Degree Representation

```text
absolute melody
+
tonal center
→ scale degree
→ carriers 1–7 + octave tonic
```

Future:

### Performance / Intervention Layer

```text
World
→ playable audio intervention
```

without corrupting source Musical Evidence.

---

## 62. Architecture invariant

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

Does the user alter only the performance output,
or the musical source truth itself?
→ Performance / Transformation boundary
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
→ precise local Musical Evidence
→ song-specific machines
→ shared physical consequences
→ a spatial score that can be watched and explored
```

Future extension:

```text
Music
→ World
→ user touches World
→ World can disturb audible performance
```

without destroying the source score.

---

## 63. Milestone 9E.2 analysis robustness

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

## 64. Milestone 9H.1 park liveness

Shared rhythmic liveness follows one causal route:

```text
AudioWorld rhythm snapshot
→ ParkPulse interpretation
→ PhysicsWorld pulse source
→ registered receivers
```

`ParkPulse` does not assign ride animation and actors do not subscribe to it.
The initial receivers are Anchored Content and Free Bodies. The source is broad,
low-energy, bounded, and separately observable from collision impacts and the
RollerCoaster wake. Pause stops new rhythmic pulse generation. Seek resolves the
current phase without replaying beat history.

Musical truth remains immediate. Carousel may smooth only secondary presentation
presence with a 150 ms attack and 450 ms release. Missing melody keeps Carousel
musically resting while neutral mechanical idle may continue. Missing harmony,
tonal center, percussion, structure, or phrase evidence never fabricates those
domains. Free Bodies retain canonical physics and use a lower renderer-only
visual ceiling in the Park overview.

---

## 65. Milestone 9I real structure to DropTower

Real analyzed structure reaches DropTower through an actor-owned interpretation
layer:

```text
AudioWorld.structure
→ DropTower structural interpretation
→ DropTowerDrive
→ actor-local IDLE / LIFTING / HOLDING / DROPPING / REBOUND / SETTLING
```

`section-change ≠ Drop`. A drop requires at least 1.5 seconds of sustained
preparation, sufficient accumulated build and tension, a strong boundary,
release score, confidence, and an expired six-second cooldown. The interpretation
may request lift, hold, or release, but only the existing simulation changes
physical state. Structure evidence never writes carriage position and never
creates a PhysicsWorld impact directly.

```text
AudioWorld.structure
├─→ StructuralAttentionPolicy
└─→ DropTower interpretation
```

These are sibling consumers. Attention does not control DropTower, and
DropTower does not change attention. ParkPulse remains a separate rhythm-driven
PhysicsWorld source. `Musically Resting ≠ Physically Inactive`: a tower without
current structural intent may still finish an already authorized fall, rebound,
or settling motion.
