# Z.land Music Box — Story Map v0.1

## 1. Experience premise

Z.land Music Box is an interactive computational amusement park that performs
music through physical machines.

The visitor does not simply play a song while watching an audio visualizer.

A song enters the park.

Different musical dimensions are interpreted by different physical actors.

Those actors then inhabit the same PhysicsWorld and can physically affect
one another and surrounding content.

The core experience should communicate:

> The park is not dancing to the music.
>
> The music is operating the park.

---

## 2. Experience arc

The initial experience follows this arc:

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
MELODY
↓
HARMONY
↓
GROOVE
↓
PERCUSSION
↓
BUILD
↓
TENSION
↓
DROP
↓
FULL PARK
↓
CROSS-ACTOR PHYSICS
↓
RECOVERY
↓
SILENCE
```

The experience begins and ends with the same physical world in different
states of energy.

The park should exist before the music starts.

The park should continue physically settling after musical input stops.

---

## 3. Arrival

The visitor arrives outside Z.land.

The final visual treatment is not locked.

The current working metaphor is:

```text
Z.LAND

GATE
+
TICKET BOOTH
```

The entrance should communicate that the visitor is about to bring something
into a world, rather than merely open a media player.

The park may be partially visible beyond the entrance.

It should initially feel quiet, dormant, or mechanically at rest.

Do not require the final entrance design during early engineering prototypes.

---

## 4. Ticket — Bring a Song

The visitor provides a song.

Working interaction language:

```text
BRING A SONG
```

or:

```text
ADMIT ONE SONG
```

The song may conceptually receive a ticket.

Example conceptual ticket:

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
│ ENERGY      ✓              │
│                            │
│        ADMIT ONE SONG      │
└────────────────────────────┘
```

This ticket is not merely decorative.

In a future version it may present a human-readable summary of the AudioMap.

The exact fields and visual design are not locked.

For early prototypes, authored AudioMap data may replace real song analysis.

---

## 5. Gate — Start the experience

The gate is the current metaphor for transport start.

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
Park begins responding
```

Opening the gate may eventually correspond to the user gesture that resumes
or starts the browser AudioContext.

The gate is an experience metaphor.

It does not own AudioWorld state or transport logic.

---

## 6. Closed Park — Establish the world before performance

Before the musical performance becomes obvious, the user should briefly
experience Z.land as a world that already exists.

The park is not an empty loading screen.

Possible idle state:

- Carousel is still or moving almost imperceptibly.
- FerrisWheel may retain extremely slow mechanical presence.
- PirateShip rests near equilibrium.
- BumperCars are settled.
- DropTower is at its resting position.
- RollerCoaster is at or near the station.
- Free Bodies / Orb / Balloon may retain subtle atmospheric motion.

The important contrast is:

```text
No musical input
≠
No world
```

PhysicsWorld exists independently of musical performance.

This moment establishes a baseline so that the user can perceive what changes
when the song begins.

---

## 7. Melody enters — Carousel wakes first

The first clearly legible musical dimension is melody.

Conceptually:

```text
Melody
↓
Carousel
```

The Carousel is responsible for:

- melodic pitch
- note events
- note duration
- melodic expression

The Carousel should not simply rotate faster whenever a note occurs.

Its musical response has at least two conceptual timescales.

### Phrase / transport motion

The Carousel as a whole may maintain continuous orbit or phrase-level movement.

### Individual note expression

Individual riders/items respond to note information.

Possible relationships:

- pitch → vertical position or vertical target
- note onset → rider activation
- note duration → expression duration
- note intensity → response amplitude
- melodic phrase → overall rotational development

The exact visual mapping is not locked yet.

The story requirement is only:

> The user should be able to perceive that melodic information belongs to the
> Carousel.

Other rides remain comparatively quiet.

This is the first moment where the user understands:

> The music is not merely background audio.

---

## 8. Harmony enters — FerrisWheel opens the musical space

Harmony enters underneath or around the melody.

Conceptually:

```text
Harmony
↓
FerrisWheel
```

The FerrisWheel represents:

- chords
- sustained harmonic relationships
- harmonic persistence
- slower structural change

Carousel and FerrisWheel must remain distinct.

Carousel:

```text
individual melodic movement
```

FerrisWheel:

```text
simultaneous / sustained harmonic relationship
```

Example:

```text
Melody:
G4 → A4 → G4 → E4

Harmony:
C major → F major
```

The FerrisWheel should feel slower and more persistent than note-level
Carousel activity.

This stage tests whether AudioWorld can expose multiple musical dimensions
simultaneously without collapsing them into one generic audio intensity.

---

## 9. Groove enters — PirateShip begins to swing

The next layer introduces groove.

Conceptually:

```text
Groove / Swing
↓
PirateShip
```

PirateShip represents:

- continuous rhythmic phase
- groove
- swing
- oscillatory weight transfer

PirateShip is NOT a percussion trigger display.

It should not behave like:

```text
BEAT
↓
swing once

BEAT
↓
swing once
```

Instead, the musical phase influences an ongoing pendulum system.

Conceptually:

```text
musical phase
↓
pendulum relationship
↓
continuous oscillation
```

Two songs at the same BPM may therefore produce different PirateShip behavior
if their groove or swing differs.

This distinction must remain visible in the experience.

---

## 10. Percussion enters — BumperCars receive impulses

Percussion introduces discrete physical impulses.

Conceptually:

```text
Percussion
↓
BumperCars
```

Possible semantic relationships:

- kick → strong linear impulse
- snare → lateral or angular impulse
- hi-hat → smaller perturbation
- accent strength → impulse strength

These mappings are provisional and may be refined later.

The important story rule is:

> Audio creates the initial cause.
>
> Physics determines the consequence.

Example:

```text
Kick
↓
Car A receives impulse
↓
Car A collides with Car B
↓
Car B changes trajectory
↓
Car B may collide with another object
```

Secondary collisions are not authored musical animations.

They emerge from the physical world.

This is the first major transition from:

```text
music visualization
```

to:

```text
music-driven physical causality
```

---

## 11. Build begins — Large-scale actors wake

The music begins accumulating energy and tension.

Two large-scale actors become important.

### RollerCoaster

Primary musical responsibility:

- phrase energy
- long-form musical development
- tension
- release

### DropTower

Primary musical responsibility:

- build
- anticipation
- major drop
- large accent / bass impact

They may become active during the same musical passage, but they do not consume
the same meaning.

Conceptually:

```text
phraseEnergy
↓
RollerCoaster
```

```text
buildState
↓
DropTower
```

RollerCoaster may leave the station and enter a rising or accelerating part of
its route.

DropTower begins lifting.

The user should begin to feel that the park anticipates an upcoming musical
event.

---

## 12. Tension / Hold — The world anticipates

Immediately before a major release, the music may reduce, suspend, or narrow.

This is a deliberate tension state.

Possible world behavior:

- DropTower reaches HOLD.
- RollerCoaster approaches a crest or tension point.
- PirateShip amplitude may reduce.
- BumperCars receive fewer impulses.
- Carousel may sustain a note or simplify its expression.
- FerrisWheel may continue carrying the harmony.
- Free Bodies / Orb / Balloon motion may become quieter.

The world is not frozen.

It is waiting.

This distinction matters:

```text
silence
≠
reset
```

Low musical activity may still contain significant physical and narrative
tension.

---

## 13. Drop — One musical moment produces multiple meanings

A major drop occurs.

AudioWorld may describe several simultaneous musical facts:

- drop event
- strong bass energy
- strong onset
- phrase release
- percussion events
- melody continuation or change
- harmony change

These facts are distributed semantically.

Example:

```text
drop event
↓
DropTower releases
```

```text
phrase release
↓
RollerCoaster enters a high-energy route state
```

```text
kick / snare
↓
BumperCars receive impulses
```

```text
groove
↓
PirateShip changes oscillatory behavior
```

```text
melody
↓
Carousel continues melodic interpretation
```

```text
harmony
↓
FerrisWheel continues harmonic interpretation
```

The system must NOT implement this as one global:

```text
BOOM()
```

that directly animates every object.

One musical moment may contain multiple musical meanings.

Each actor responds only to the meanings it owns.

---

## 14. Full Park — The song becomes a world

After the major release, multiple musical layers are active simultaneously.

Conceptually:

```text
                         AudioWorld
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
       melody             harmony            groove
          │                  │                  │
      Carousel          FerrisWheel        PirateShip

       percussion          build/drop          phrase
          │                  │                  │
     BumperCars          DropTower        RollerCoaster

                         texture
                            │
                  Free Bodies / Orb
```

At this point, the park should feel like one instrument rather than several
independent demos.

This is a critical experience requirement.

The user should NOT perceive:

```text
several widgets reacting to one song
```

The user should perceive:

```text
one physical world interpreting one song through different mechanical languages
```

---

## 15. Cross-actor physics — Musical causality becomes spatial causality

The Full Park section introduces an essential second layer.

AudioWorld drives actors.

Actors then affect other participants through PhysicsWorld.

Conceptually:

```text
AudioWorld
↓
Actor A
↓
Actor A simulation
↓
spatial movement / force
↓
PhysicsWorld
↓
Actor B or Content
↓
secondary physical response
```

Example:

```text
phrase energy increases
↓
RollerCoaster accelerates
↓
RollerCoaster becomes a stronger moving PhysicsSource
↓
airflow field passes through nearby space
↓
Orb trajectory changes
↓
nearby physical content may respond
```

The Orb must not receive a separate hard-coded "chorus animation" merely
because the RollerCoaster is also active during the chorus.

The Orb response should occur because a physical source actually entered its
influence region.

This is the central distinction between Z.land and a conventional synchronized
audio visualizer.

---

## 16. Content may participate in the same world

Rides are the most expressive actors, but they are not the only physical
participants.

Other content may include:

- Text
- Image
- CMS content
- Button
- Navigation
- Logo
- Icon
- Shader object
- 3D object
- Free Bodies / Orb / particle bodies

Possible interactions:

```text
RollerCoaster passes nearby
↓
Title receives airflow displacement
↓
spring recovery
```

```text
RollerCoaster crosses an Image region
↓
Image receives an authored material response
↓
temporary split / distortion
↓
recovery
```

```text
Orb passes through a project grid
↓
nearby images tilt slightly
```

```text
BumperCar collides near navigation
↓
navigation receives a small impulse
```

```text
Orb approaches a Project Card
↓
card exclusion collider alters Orb trajectory
```

These responses must remain subordinate to readability and experience clarity.

The entire interface should not constantly behave like loose debris.

---

## 17. Recovery — Musical layers leave in reverse complexity

After the peak, musical layers begin disappearing.

Example sequence:

```text
Percussion leaves
↓
BumperCars stop receiving new musical impulses
```

```text
Energy falls
↓
RollerCoaster approaches a calmer state or station
```

```text
Groove disappears
↓
PirateShip settles toward equilibrium
```

```text
Harmony resolves
↓
FerrisWheel slows or stabilizes
```

```text
Final melody phrase
↓
Carousel remains one of the final expressive actors
```

```text
Silence
↓
Audio input ends
```

PhysicsWorld may continue briefly after musical input stops.

Examples:

- BumperCars finish existing motion.
- displaced content springs back.
- Free Bodies / Orb turbulence settles.
- suspended bodies recover.
- residual velocity damps naturally.

The physical world therefore resolves rather than being abruptly reset.

---

## 18. Return to Closed Park

After recovery, Z.land returns to a recognizable resting state.

Conceptually:

```text
ORDER
↓
MUSIC ENTERS
↓
MELODY
↓
HARMONY
↓
GROOVE
↓
PERCUSSION
↓
BUILD
↓
TENSION
↓
DROP
↓
FULL PARK
↓
PHYSICAL INTERACTION
↓
RECOVERY
↓
ORDER
```

The ending should visually relate to the beginning.

The park has performed the song and returned to rest.

---

## 19. Replay / another song

After the performance, the user may:

- replay the current song
- seek within it
- load another song
- return to the entrance
- remain in the resting park

Loading another song should not require reconstructing the entire application.

The world remains.

The musical interpretation changes.

Conceptually:

```text
same park
+
different song
=
different performance
```

This is an important identity of the project.

Z.land is not a fixed animation authored to one soundtrack.

The world defines rules.

The song provides musical conditions.

The performance emerges from both.

---

## 20. ControlSurface story role

The audience-facing ControlSurface exists within the experience story.

Current working metaphor:

```text
Z.land entrance gate + ticket booth
```

This metaphor is NOT visually locked.

Its narrative responsibilities are:

1. Let the visitor arrive.
2. Let the visitor bring a song.
3. Represent successful song preparation.
4. Give the visitor permission to enter/start.
5. Provide access to necessary transport controls after entry.
6. Allow replay, seek, restart, song replacement, or exit.

The ControlSurface should not expose engineering terminology such as:

- AudioMap
- pitchConfidence
- AudioSnapshot
- PhysicsSource
- event queue

Those belong to development instrumentation.

---

## 21. DebugConsole story role

DebugConsole is not part of the fictional amusement-park interface.

It exists beside the experience for development.

It should make invisible system truth observable.

Examples:

### Transport

- time
- playing
- duration

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
- confidence
- note progress

### Harmony

- chord
- root

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

- note-on
- note-off
- beat
- kick
- snare
- drop
- seek

### World

- actor states
- registered PhysicsSources
- active collisions
- physical energy / settling state

DebugConsole may remain visually utilitarian.

---

## 22. Reference prototype timeline

The following 42-second timeline is a development reference composition.

It is NOT the required final song structure.

Its purpose is to expose architecture requirements in a controlled order.

### 00–04s — Closed Park

Music:

- silence or faint ambience

World:

- rides resting
- subtle world presence
- no obvious musical choreography

Architecture question:

> Can the physical world exist without active musical input?

---

### 04–09s — Melody

Music:

- simple melodic phrase

World:

- Carousel becomes the primary musical actor

Architecture question:

> Can AudioWorld expose melody without affecting unrelated actors?

---

### 09–14s — Harmony

Music:

- melody continues
- harmony enters

World:

- Carousel continues
- FerrisWheel enters

Architecture question:

> Can melody and harmony coexist as independent semantic domains?

---

### 14–18s — Groove

Music:

- rhythmic groove enters
- percussion remains light or absent

World:

- PirateShip begins meaningful oscillation

Architecture question:

> Can continuous rhythmic phase drive an actor independently of discrete beat
> events?

---

### 18–22s — Percussion

Music:

- kick / snare / hi-hat enter

World:

- BumperCars receive impulses
- collisions begin

Architecture question:

> Can discrete musical events produce physical impulses whose secondary effects
> are simulated rather than authored?

---

### 22–27s — Build

Music:

- phrase energy rises
- tension rises

World:

- RollerCoaster begins large-scale movement
- DropTower lifts

Architecture question:

> Can multiple long-timescale signals control different actors without sharing
> one generic intensity value?

---

### 27–29s — Hold

Music:

- reduced arrangement
- near-silence or suspended tension

World:

- DropTower holds
- RollerCoaster approaches tension point
- other systems reduce activity without resetting

Architecture question:

> Can the world preserve tension and physical state during low musical activity?

---

### 29s — Drop

Music:

- major drop
- strong onset
- bass impact
- phrase release
- percussion impact

World:

- DropTower releases
- RollerCoaster transitions into release/high-energy movement
- BumperCars receive new impulses
- PirateShip responds to groove
- Carousel continues melody
- FerrisWheel continues harmony

Architecture question:

> Can one musical moment produce several semantic events without becoming one
> global animation trigger?

---

### 29–36s — Full Park

Music:

- full arrangement

World:

- all relevant musical actors active
- cross-actor PhysicsWorld interactions become visible

Suggested first major cross-actor event:

```text
RollerCoaster passes near a Free Body / Orb or another registered participant.
```

Architecture question:

> Can musical causality become real spatial causality?

---

### 36–42s — Recovery

Music:

- layers leave progressively
- final melodic/harmonic resolution
- silence

World:

- actors settle according to their own physical models
- PhysicsWorld resolves residual motion
- park returns to resting state

Architecture question:

> Can the system recover naturally without a global visual reset?

---

## 23. Timescale hierarchy

Not every actor should react at the same temporal frequency.

This is required to avoid visual noise.

Approximate hierarchy:

### Fast / event scale

BumperCars:

- percussion
- transient impulses
- collisions

### Note scale

Carousel:

- melodic notes
- note duration
- note expression

### Beat / groove scale

PirateShip:

- rhythmic phase
- swing
- oscillation

### Harmonic scale

FerrisWheel:

- chord duration
- harmonic change
- sustained relationships

### Phrase scale

RollerCoaster:

- energy trajectory
- tension
- release

### Structural event scale

DropTower:

- build
- hold
- major drop

### Atmospheric scale

Free Bodies / Orb / Balloon:

- texture
- brightness
- turbulence
- physical environmental response

The park should therefore contain multiple temporal layers.

Do not make every actor visibly react to every beat.

---

## 24. Experience hierarchy

At any moment, not every actor needs equal visual importance.

The park should have a perceptual hierarchy even when multiple actors are
musically active.

Use four conceptual levels.

### Primary

The actor currently carrying the most important musical or narrative event.

Examples:

- Carousel during the first melody reveal
- DropTower during a major build and drop
- RollerCoaster during a large phrase release

Only one actor should usually dominate at a time.

### Secondary

Actors that remain musically active but support the primary event.

Their motion should remain legible without competing for attention.

Examples:

- FerrisWheel sustaining harmony while Carousel carries melody
- PirateShip continuing groove during a DropTower build

### Ambient

Actors that preserve world continuity without demanding attention.

Examples:

- Free Bodies / Orb / Balloon
- subtle FerrisWheel motion
- low-energy environmental physics

### Resting

Actors that remain physically present but are not currently musically expressive.

Resting does not mean removed.

The user should still perceive one continuous park.

Visual intensity should therefore not be derived only from musical intensity.

A loud song does not imply that every actor becomes visually dominant.

Conceptually:

```text
Musical activity
↓
Actor interpretation
↓
Experience hierarchy
↓
Visual emphasis
```

Hierarchy is an experience-layer concern.

It must not rewrite actor physics merely to make the composition cleaner.

Prefer controlling:

- framing
- lighting
- opacity where appropriate
- visual detail
- camera attention
- renderer emphasis

before changing the underlying simulation.

The park should feel coordinated, not uniformly loud.

---

## 25. Song preparation

A submitted song may require preparation before it can enter the park.

Preparation may eventually include:

- audio decoding
- AudioMap lookup
- beat analysis
- melody analysis
- harmony analysis
- structure analysis
- source separation or transcription when required

The visitor-facing experience should not expose these as engineering tasks.

The current narrative metaphor may treat preparation as:

- ticket printing
- song inspection
- park admission processing

The final visual metaphor is not locked.

The important story requirement is:

> The visitor must understand that the song is being prepared, not that the
> application has frozen.

Early prototypes using authored AudioMap data may complete this state instantly.

---

## 26. Partial musical understanding

A song does not need to produce every musical domain successfully.

Examples:

```text
melody available
harmony uncertain
rhythm available
energy available
```

or:

```text
no reliable predominant melody
strong rhythmic information
clear structural energy
```

The park must degrade gracefully.

If a musical domain is unavailable:

- its actor may remain resting
- it may use a reduced fallback mode where musically defensible
- the system must not fabricate confident musical meaning
- unrelated actors must continue functioning normally

The audience-facing ticket may eventually communicate which musical dimensions
are available without exposing raw technical confidence metrics.

A smaller valid performance is preferable to a false complete performance.

---

## 27. Visitor interruption

The visitor may interrupt the performance through:

- pause
- seek
- restart
- song replacement
- exit

These actions are part of the experience, not exceptional error states.

### Pause

Pausing stops musical transport.

It does not necessarily erase physical energy already present in PhysicsWorld.

A moving BumperCar may continue settling.

A displaced object may continue spring recovery.

A Free Body may continue damping.

### Seek

Seeking should feel like repositioning the musical performance,
not rapidly replaying everything skipped.

After seek:

- musical interpretation synchronizes to the new position
- continuous actor state is reconciled to the new musical state
- historical musical events are not replayed
- existing physical energy may be reconciled according to actor-specific rules

### Restart

Restart returns musical transport to the beginning.

The park may require an authored transition back toward its initial performance
state rather than an unexplained instantaneous world reset.

### Replace song

The park remains.

The musical conditions change.

The exact transition between songs is not visually locked.

The experience should avoid violent unexplained discontinuities where possible.

---

## 28. Viewpoint and camera

The visitor observes one shared park.

Camera and framing are experience tools, not musical actors.

The camera may guide attention toward the current primary event, but it must
not create false physical causality.

Possible future behaviors:

- wide park overview
- actor-focused encounter
- gradual reframing between musical layers
- spatial emphasis during Full Park
- return to a wider view during Recovery

The final camera language is not locked.

The camera should help the visitor understand relationships between actors.

It should not turn the experience into a sequence of disconnected ride demos.

The camera should reveal one world from changing viewpoints, not imply that
each ride exists on an isolated stage.

---

## 29. Park spatial continuity

Z.land is one spatial world.

Actor placement must support believable cross-actor interaction.

Examples:

- RollerCoaster may pass near Free Body / Orb fields.
- BumperCars may occupy a shared ground region.
- Carousel and FerrisWheel may remain visible from common viewpoints.
- DropTower may form a strong vertical landmark.
- PirateShip may occupy a region where its oscillation can be spatially read
  against surrounding actors.

Spatial relationships should not be authored only for visual composition.

They should also create meaningful opportunities for PhysicsWorld interaction.

For example:

```text
Coaster route near Orb field
→ possible airflow event
```

```text
Project object near Balloon path
→ possible exclusion response
```

```text
BumperCar region near physical content
→ possible impulse propagation
```

The park layout may evolve.

Actors must not behave as if they occupy unrelated isolated stages.

---

## 30. First-time comprehension

The first performance must teach the visitor how to read the park.

The system should reveal musical domains progressively.

Preferred teaching order:

1. one musical domain
2. one clear actor response
3. a second musical domain
4. a second distinct actor response
5. progressively layered performance
6. cross-actor physical interaction
7. Full Park

Do not begin with Full Park.

If every actor is active immediately, the visitor cannot infer which musical
meaning belongs to which mechanical language.

The first performance is therefore also an onboarding sequence.

The user should gradually understand:

```text
Carousel
= melody

FerrisWheel
= harmony

PirateShip
= groove

BumperCars
= percussion

DropTower
= build / major drop

RollerCoaster
= phrase / energy

Free Bodies
= texture / atmosphere / world response
```

This understanding should emerge primarily through behavior.

Do not rely on a large explanatory legend as the only way to understand the
system.

---

## 31. Story invariant

When evaluating a new experience idea, ask:

> Does this help the visitor understand music operating one shared physical
> world?

Prefer:

```text
Music
→ Meaning
→ Actor
→ Physics
→ World
```

Avoid:

```text
Music
→ unrelated visual effect
```

The rides are not decorative metaphors placed on top of an audio visualizer.

They are physical interpreters with different musical responsibilities.

The park is the instrument.

The song is the operating condition.

The resulting performance emerges from both.