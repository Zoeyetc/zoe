# Z.land Music Box — Story Map v0.2

## 1. Experience premise

Z.land Music Box is an interactive computational amusement park that performs
music through physical machines.

The visitor does not simply play a song while watching an audio visualizer.

A song enters the park.

The park reveals different kinds of musical evidence through different
mechanical actors.

Those actors then inhabit the same PhysicsWorld and may physically affect one
another and surrounding content.

The experience should communicate:

> The park is not dancing to the music.
>
> The music is operating the park.

But it should also communicate something more precise:

> When a note, chord tone, rhythmic event, or structural event appears,
> the corresponding physical system is responding to something that actually
> exists in the music.

Z.land should therefore feel partly like:

```text
a physical amusement park
```

and partly like:

```text
a spatial score being transcribed in real time
```

---

## 2. Core experience idea

The project has two simultaneous experience goals.

### Physical world

The visitor should perceive:

```text
one shared park
```

rather than:

```text
several independent music-reactive widgets
```

### Musical evidence

The visitor should also be able to perceive:

```text
specific musical facts
```

rather than only:

```text
generic activity / energy
```

Examples:

```text
specific melody note
→ specific Carousel carrier responds
```

```text
C major
→ C / E / G FerrisWheel carriers respond together
```

```text
kick
→ BumperCars receives an actual percussion impulse
```

```text
drop event
→ DropTower releases
```

The experience should preserve the feeling that musical information is being
identified and physically expressed, not merely used as an animation trigger.

---

## 3. Development experience vs final experience

The current development page uses a vertically stacked layout.

That layout exists for:

- actor inspection
- debugging
- manual QA
- regression testing
- development observability

It is not the intended final experience.

The final experience direction is:

```text
one persistent spatial world
+
multiple simultaneous actors
+
precise local musical evidence
+
shared physical interaction
```

A future Park Map / Spatial Score may organize this world.

Do not infer final navigation or information architecture from the current
vertical scroll layout.

---

## 4. Experience arc

The initial audience experience may follow this broad arc:

```text
ARRIVAL
↓
TICKET
↓
SONG PREPARATION
↓
GATE
↓
CLOSED PARK
↓
MUSIC ENTERS
↓
FIRST MUSICAL EVIDENCE
↓
MELODY
↓
HARMONY
↓
GROOVE
↓
PERCUSSION
↓
STRUCTURE / BUILD
↓
PHRASE / ENERGY
↓
TENSION
↓
DROP / RELEASE
↓
FULL PARK
↓
CROSS-ACTOR PHYSICS
↓
RECOVERY
↓
SILENCE
```

This is an onboarding / narrative sequence.

It is not a statement that the final Park Map must reveal actors one at a time.

Once the visitor understands the world, multiple actors may remain visible
simultaneously.

---

## 5. Arrival

The visitor arrives outside Z.land.

The final visual treatment is not locked.

The current working metaphor is:

```text
Z.LAND
GATE
+
TICKET BOOTH
```

The entrance should communicate:

```text
you are bringing a song into a world
```

rather than:

```text
you are opening a media player
```

The park may already be partially visible.

It should feel mechanically present but musically dormant.

---

## 6. Ticket — Bring a Song

The visitor provides a song.

Working interaction language may include:

```text
BRING A SONG
```

or:

```text
ADMIT ONE SONG
```

The song may conceptually receive a ticket.

Example:

```text
┌────────────────────────────┐
│ Z.LAND              № 017  │
│                            │
│ SONG                       │
│ NIGHT DRIVE                │
│                            │
│ 03:42        124 BPM       │
│                            │
│ MELODY      ✓              │
│ RHYTHM      ✓              │
│ HARMONY     ✓              │
│ STRUCTURE   ✓              │
│                            │
│        ADMIT ONE SONG      │
└────────────────────────────┘
```

The ticket is not merely decorative.

It may eventually communicate:

- available musical domains
- duration
- tempo
- analysis readiness
- song identity

It should not expose raw engineering terminology by default.

---

## 7. Song preparation

A submitted song may require preparation.

Preparation may eventually include:

- audio decoding
- beat analysis
- melody extraction
- harmony analysis
- structure analysis
- source separation
- transcription

The visitor-facing experience should not expose these as engineering tasks.

Possible metaphor:

```text
ticket printing
song inspection
park admission processing
```

The important requirement:

> The visitor understands that the song is being prepared, not that the
> application has frozen.

Early deterministic fixtures may complete this state instantly.

---

## 8. Partial musical understanding

A song may not provide every musical domain reliably.

Examples:

```text
melody available
rhythm available
harmony unavailable
structure available
```

or:

```text
melody uncertain
rhythm strong
energy available
```

The park should degrade gracefully.

If a musical domain is unavailable:

- its actor may remain resting
- it may remain mechanically present
- it must not fabricate false musical evidence

The ticket may eventually communicate available dimensions in a human-readable
way.

A smaller truthful performance is preferable to a visually fuller false one.

---

## 9. Gate — Enter the park

The gate is the current metaphor for beginning transport.

Conceptually:

```text
Ticket accepted
↓
Gate opens
↓
Audio transport begins
↓
Song enters Z.land
↓
Park begins interpreting it
```

Opening the gate may eventually correspond to the user gesture required to
resume the browser AudioContext.

The gate is an interface metaphor.

It does not own AudioClock or AudioWorld state.

---

## 10. Closed Park

Before obvious musical behavior begins, the visitor should briefly perceive
Z.land as a world that already exists.

Possible resting state:

- Carousel still or nearly still
- FerrisWheel extremely slow or still
- PirateShip near equilibrium
- BumperCars settled
- DropTower at rest
- RollerCoaster at station
- Free Bodies / Orb drifting subtly
- ordinary content anchored

The important contrast:

```text
no active musical performance
≠
no world
```

PhysicsWorld exists independently of musical input.

---

## 11. First musical evidence

The first musical change should teach the visitor one key rule:

> A local response corresponds to something specific in the music.

Do not begin with Full Park.

The visitor should first observe a clear relationship between:

```text
one musical fact
```

and:

```text
one physical response
```

This is the foundation of the spatial-score reading.

---

## 12. Melody — Carousel as melodic transcription

Carousel is the primary melody actor.

Its most important role is not simply:

```text
move when melody exists
```

but:

```text
show specific melody evidence
```

Conceptually:

```text
G4
→ one identifiable carrier responds

A4
→ another exact pitch position / carrier state responds
```

Possible local mappings:

- note identity → carrier identity
- pitch → bounded vertical target
- note onset → local activation
- note duration → expression lifetime
- note intensity → bounded response amplitude

Whole-carousel rotation is mechanical behavior.

Local note activation is musical evidence.

Do not confuse these.

The visitor should be able to feel:

> these are the notes of the melody

even without reading traditional notation.

---

## 13. Melody evidence must remain exact

Carousel activity must not become decorative blinking.

Do not:

- activate random riders
- light extra riders for balance
- suppress an actual note because the composition feels crowded
- rotate the whole ride to fake note identity

If the system visually claims a particular note is active, that claim must be
supported by AudioWorld.

This is a core experience requirement.

---

## 14. Harmony — FerrisWheel as simultaneous chord transcription

FerrisWheel is the primary harmony actor.

Harmony differs fundamentally from melody because several tones may coexist.

Conceptually:

```text
C major
→ C + E + G active together
```

```text
A minor
→ A + C + E active together
```

The FerrisWheel should make simultaneous harmonic membership visible.

Its wheel and cabin mechanics provide physical continuity.

Its local harmonic carriers provide musical evidence.

The experience should let the visitor notice:

> this musical moment contains several tones at once.

---

## 15. Harmony evidence must remain exact

FerrisWheel should not reduce harmony to:

```text
chord exists
→ whole wheel lights up
```

That may be used as secondary presentation, but it cannot replace the actual
harmonic evidence.

If the current chord representation contains:

```text
C / E / G
```

the corresponding carriers should reflect:

```text
C / E / G
```

not:

```text
C / F / G
```

because the latter creates a more visually balanced pattern.

Musical accuracy takes priority over decorative symmetry.

---

## 16. Groove — PirateShip embodies rhythmic feel

PirateShip represents:

```text
groove
swing
continuous rhythmic phase
```

It should communicate:

> how the music swings

rather than:

> where a drum hit occurred

A groove may remain active continuously.

Possible interpretation:

```text
beat phase
→ pendulum drive phase
```

```text
swing
→ temporal asymmetry
```

```text
groove
→ timing character / drive shape
```

The actor-local pendulum remains physically continuous.

It is not snapped directly to musical phase.

---

## 17. Percussion — BumperCars embody transient events

BumperCars represent:

```text
percussion
transient impact
collision energy
```

Conceptually:

```text
kick
→ strong local impulse

snare
→ lateral / angular impulse

hat
→ small perturbation
```

The important distinction:

```text
audio event
→ initial physical cause
```

then:

```text
simulation
→ actual collisions
→ secondary motion
```

The musical event does not directly author every collision.

---

## 18. Structure — DropTower embodies anticipation and release

DropTower represents:

```text
build
tension
major structural drop
```

Its experience arc may include:

```text
LIFT
↓
HOLD
↓
DROP
↓
REBOUND
↓
SETTLE
```

The explicit `drop` event is meaningful musical evidence.

The tower should not release merely because the scene needs excitement.

Continuous build / tension prepares the actor.

The discrete drop event authorizes release.

---

## 19. Phrase — RollerCoaster embodies long-form development

RollerCoaster represents:

```text
phrase
energy trajectory
tension
release
long-form momentum
```

It should not simply:

```text
go faster when music is louder
```

Instead, phrase state changes its physical conditions:

- drive
- restraint
- braking
- momentum
- route behavior

The route itself remains physical.

Musical phrase progress does not directly scrub route position.

The RollerCoaster should communicate the larger movement of the music across
time.

---

## 20. Phrase and DropTower must remain distinct

DropTower:

```text
one major structural event
→ build / hold / drop
```

RollerCoaster:

```text
long-form phrase development
→ momentum / anticipation / release / continuation
```

They may become active during the same musical passage.

They should not perform identical interpretations.

---

## 21. Full Park

After the visitor understands individual actor relationships, multiple musical
dimensions may coexist.

Conceptually:

```text
                         AudioWorld
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
       melody             harmony            groove
          │                  │                  │
      Carousel          FerrisWheel        PirateShip

       percussion          structure           phrase
          │                  │                  │
     BumperCars          DropTower        RollerCoaster
```

At this point the visitor should perceive:

```text
one song
```

operating:

```text
one shared world
```

through several musical dimensions.

---

## 22. Full Park is not a dashboard

Do not present Full Park as:

```text
MELODY ACTIVE
HARMONY ACTIVE
GROOVE ACTIVE
```

with six separate indicator panels.

Instead:

```text
the actors themselves expose the music
```

Examples:

- Carousel carrier hits exact note
- FerrisWheel cabins expose exact chord tones
- BumperCars receives actual percussion impulses
- PirateShip carries groove phase
- DropTower enters hold
- RollerCoaster moves through phrase release

The park should be readable through behavior.

---

## 23. Spatial Score

The long-term experience direction is a persistent shared spatial composition.

A useful internal concept is:

```text
Spatial Score
```

Traditional score:

```text
time × pitch
```

Z.land may become:

```text
time
×
space
×
mechanical behavior
×
physical causality
```

The visitor watches a song occupy a world.

---

## 24. Park Map direction

The future Park Map may organize:

- Carousel
- FerrisWheel
- PirateShip
- BumperCars
- DropTower
- RollerCoaster route
- Free Bodies
- content
- paths
- shared fields
- Gate / Ticket Booth

The map should not be divided into music-theory panels.

Avoid:

```text
MELODY LAND
HARMONY LAND
RHYTHM LAND
```

unless such labels are deliberately used as optional educational overlays.

Prefer physical actor geography.

---

## 25. RollerCoaster as spatial connector

RollerCoaster should not necessarily live inside one isolated district.

Its route may become one of the major spatial structures that ties the park
together.

Conceptually:

```text
RollerCoaster route
→ crosses multiple park regions
→ creates future wake interactions
→ physically connects distant parts of the world
```

This reinforces its phrase / energy role.

---

## 26. Free Bodies as atmosphere

Free Bodies / Orb should not necessarily occupy one dedicated district.

They may move across:

- actor regions
- paths
- RollerCoaster route zones
- ordinary content

They are intended to respond to:

```text
AudioWorld texture / spectral conditions
+
PhysicsWorld forces
```

They help make the entire park feel physically continuous.

---

## 27. Region emphasis

A park region may receive subtle emphasis when activity matters.

This is an attention tool.

It is not the musical evidence itself.

Possible emphasis:

- line weight
- contrast
- local fill
- density
- subtle illumination
- motion trace
- camera focus

Do not replace precise note / chord / event behavior with whole-region
activation.

---

## 28. Primary / Secondary / Ambient / Resting

At any moment actors may occupy different perceptual roles.

### Primary

Carries the current dominant narrative or musical event.

Examples:

- Carousel during first melody reveal
- DropTower during pre-drop tension
- RollerCoaster during phrase release

### Secondary

Musically active and perceptible, but not dominant.

### Ambient

Maintains continuity without demanding attention.

### Resting

Physically present but musically inactive or settled.

This hierarchy is for presentation.

It must not alter musical evidence.

---

## 29. Evidence survives hierarchy

This is critical.

If FerrisWheel is visually Ambient:

```text
real chord tone
→ still represented
```

If Carousel is Primary:

```text
only real melody notes
→ represented
```

Do not add or remove Musical Evidence because of presentation hierarchy.

Experience emphasis and musical truth are separate layers.

---

## 30. Cross-actor physics

AudioWorld drives actors.

Actors may then affect other participants physically.

Preferred chain:

```text
AudioWorld
↓
Actor A
↓
Actor A simulation
↓
actual physical force / event
↓
PhysicsWorld
↓
Actor B / Content
↓
secondary response
```

This is a central identity of Z.land.

---

## 31. First validated shared causality

The project has already demonstrated:

```text
percussion event
↓
BumperCars impulse
↓
real collision
↓
PhysicsWorld impact
↓
Anchored Content Card
↓
temporary displacement
↓
recovery
```

The Content Card does not listen to percussion.

It responds to the physical world.

This distinction must remain visible in future interactions.

---

## 32. RollerCoaster wake

The next shared-world extension should demonstrate:

```text
phrase / energy
↓
RollerCoaster simulation
↓
actual speed / position / direction
↓
PhysicsWorld directional wake
↓
nearby participant response
```

Wake strength should derive from physical motion.

Not directly from musical energy.

This is an important test of:

```text
Music
→ Actor
→ Physics
```

rather than:

```text
Music
→ everything
```

---

## 33. Ordinary content belongs to the world

Rides are not the only physical participants.

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

Content may remain anchored while receiving temporary physical response.

Conceptually:

```text
authored layout
+
PhysicsWorld response
=
rendered content
```

Do not make ordinary content into loose debris by default.

---

## 34. Recovery

When musical layers disappear, actors and content should resolve according to
their own mechanics.

Examples:

```text
percussion ends
→ BumperCars stop receiving new impulses
→ existing motion settles
```

```text
groove disappears
→ PirateShip drive stops
→ pendulum damps
```

```text
phrase energy falls
→ RollerCoaster returns toward lower-energy route behavior
```

```text
PhysicsWorld disturbance ends
→ anchored content springs back
```

Silence does not require an instantaneous global reset.

---

## 35. Return to Closed Park

After recovery, the park returns to a recognizable resting state.

Conceptually:

```text
ORDER
↓
MUSICAL EVIDENCE
↓
PHYSICAL INTERPRETATION
↓
SHARED WORLD ACTIVITY
↓
RECOVERY
↓
ORDER
```

The ending should visually relate to the beginning.

The park has performed the song and returned to rest.

---

## 36. Replay / another song

After performance, the visitor may:

- replay
- seek
- load another song
- return to entrance
- remain in the resting park

Loading another song should not reconstruct the world.

Conceptually:

```text
same park
+
different musical evidence
=
different physical performance
```

Z.land defines rules.

The song supplies musical conditions.

The performance emerges from both.

---

## 37. Visitor interruption

The visitor may:

- pause
- seek
- restart
- replace song
- exit

These are part of the experience.

### Pause

Stops musical progression.

Does not automatically erase existing physical motion.

### Seek

Synchronizes to the new musical time.

Does not replay historical notes, chord changes, impacts, or ride history.

### Restart

Returns musical transport to the beginning and restores deterministic actor
initial states where required.

### Replace Song

Keeps the world while changing the musical conditions.

---

## 38. Viewpoint and camera

The visitor observes one shared park.

Camera and framing are experience tools.

They are not musical actors.

The camera may:

- reveal the whole park
- guide attention toward Primary activity
- preserve peripheral awareness
- show cross-actor physical relationships
- move between overview and closer observation

It should not turn the experience into disconnected ride clips.

The visitor should retain a sense of:

```text
one continuous world
```

---

## 39. Persistent overview

One reason for the future Park Map direction is that musical dimensions happen
simultaneously.

The final experience should avoid requiring the visitor to scroll between
musical domains while the song continues.

A persistent spatial overview may let the visitor perceive:

```text
melody
+
harmony
+
groove
+
percussion
+
structure
+
phrase
```

at the same musical moment.

The visitor does not need to focus equally on all of them.

They should remain part of one perceptible world.

---

## 40. First-time comprehension

The first performance must teach the visitor how to read Z.land.

Preferred progression:

1. one clear musical fact
2. one clear actor response
3. second musical layer
4. second distinct response
5. several simultaneous layers
6. structural development
7. cross-actor physical interaction
8. Full Park

Do not begin with every actor equally active.

The first experience is also onboarding.

---

## 41. Behavior first, terminology second

The audience should not need prior music-theory knowledge.

Prefer:

```text
see behavior
↓
form intuition
↓
optionally learn terminology
```

For example, a visitor may perceive:

```text
"that thing is following the tune"
```

before knowing:

```text
melody
```

or:

```text
"those three cabins keep lighting together"
```

before knowing:

```text
chord tones
```

Large technical labels are optional.

They should not be required for basic comprehension.

---

## 42. Optional educational layer

Because Musical Evidence is precise, Z.land may eventually support an optional
educational / inspection mode.

Possible information:

- note name
- pitch
- chord label
- active chord tones
- beat
- swing
- build
- phrase state

This is not required for the main experience.

It may enhance the feeling of:

```text
watching a song being transcribed
```

without turning the main interface into music-analysis software.

---

## 43. ControlSurface story role

ControlSurface belongs to the audience experience.

Current working metaphor:

```text
Gate + Ticket Booth
```

Narrative responsibilities:

1. arrive
2. bring a song
3. prepare it
4. receive admission
5. enter
6. play / pause / seek
7. replay / change song / exit

The metaphor remains replaceable.

ControlSurface does not own musical truth.

---

## 44. DebugConsole story role

DebugConsole is not part of the fictional park interface.

It exists beside the experience for development.

It may expose:

- time
- exact notes
- exact chord tones
- events
- rhythm
- structure
- phrase
- actor state
- PhysicsWorld state
- forces
- collisions
- wake
- receiver response

The DebugConsole may remain visually ugly.

Accuracy and observability matter more than presentation.

---

## 45. Reference prototype timeline

The original controlled timeline remains useful as a development reference.

It is not the required final song.

### 00–04s — Closed Park

World present, little musical activity.

Purpose:

```text
prove world existence without active music
```

---

### 04–09s — Melody

Carousel exposes specific melody evidence.

Purpose:

```text
teach note → carrier relationship
```

---

### 09–14s — Harmony

FerrisWheel exposes sustained simultaneous chord-tone evidence.

Purpose:

```text
teach melody and harmony as different dimensions
```

---

### 14–18s — Groove

PirateShip begins continuous phase-driven motion.

Purpose:

```text
teach rhythmic feel without percussion-event confusion
```

---

### 18–22s — Percussion

BumperCars receives discrete impulses.

Purpose:

```text
teach event → physical impulse → collision
```

---

### 22–27s — Build / Phrase development

DropTower and RollerCoaster begin operating on longer timescales.

Purpose:

```text
introduce musical structure and long-form momentum
```

---

### 27–29s — Tension / Hold

DropTower holds.

RollerCoaster enters high-tension behavior.

Purpose:

```text
show that low immediate activity can contain strong anticipation
```

---

### 29s — Drop / Release

DropTower receives explicit drop event.

RollerCoaster enters phrase release through its own continuous structural
interpretation.

Purpose:

```text
show one musical moment containing several different meanings
```

---

### 29–36s — Full Park

Multiple actors active simultaneously.

Purpose:

```text
one song
→ many simultaneous truths
→ one shared world
```

---

### 36–42s — Recovery

Musical layers leave.

Physical systems settle according to their own mechanics.

Purpose:

```text
prove recovery without global reset
```

---

## 46. Timescale hierarchy

Actors intentionally operate at different musical timescales.

### Fast transient scale

BumperCars:

- percussion events
- impulses
- collisions

### Note scale

Carousel:

- note identity
- pitch
- note expression

### Beat / groove scale

PirateShip:

- phase
- swing
- groove

### Harmonic scale

FerrisWheel:

- chord membership
- sustained relationships

### Structural scale

DropTower:

- build
- hold
- explicit drop

### Phrase scale

RollerCoaster:

- energy trajectory
- tension
- release

### Atmospheric scale

Free Bodies:

- spectrum
- texture
- environmental forces

Do not make every actor respond visibly to every beat.

---

## 47. Subjective QA

The development system may objectively verify:

- exact note mapping
- chord-tone mapping
- event timing
- actor state
- bounds
- physical causality
- deterministic behavior

But visual and experiential approval belongs to the user.

Codex should not decide:

- whether the map feels readable
- whether the musical relationship feels intuitive
- whether motion feels elegant
- whether a ride feels mechanically convincing
- whether the experience composition is successful

These require manual QA.

---

## 48. Current experience direction

The current final-experience direction is:

```text
one persistent Z.land
```

containing:

```text
multiple simultaneously visible actors
```

where:

```text
specific musical evidence
→ precise local actor response
```

and:

```text
actual actor motion
→ shared physical consequence
```

The Park Map / Spatial Score should help the visitor see the whole performance
without replacing the precision of local musical evidence.

---

## 49. Story invariant

When evaluating a new experience idea, ask:

> Does this help the visitor perceive real musical evidence operating one
> shared physical world?

Prefer:

```text
Music
→ Evidence
→ Actor
→ Physics
→ World
```

Avoid:

```text
Music
→ arbitrary visual effect
```

The rides are not decorative metaphors placed on top of an audio visualizer.

They are physical interpreters.

The park is not only an instrument.

It is also a spatial score.

The song provides the evidence.

The actors interpret it.

Physics connects the world.

The visitor watches the transcription become physical.