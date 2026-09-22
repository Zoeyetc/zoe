---
name: zland-music-box
description: >
  Work on Z.land Music Box architecture, AudioClock, AudioWorld, PhysicsWorld
  integration, musical ride actors, audio-driven physical behavior, Story Map
  implementation, ControlSurface, DebugConsole, spatial integration, or
  migration/refactoring of existing Z.land and Framer ride simulations.
  Use for Carousel, FerrisWheel, PirateShip, BumperCars, DropTower,
  RollerCoaster, Free Bodies, Orb/Balloon, AudioMap, AudioSnapshot,
  AudioEvent, AudioClock, ControlSurface, or cross-actor physics work in this
  repository. Do not use for unrelated React, Framer, web design, or general
  coding tasks.
---

# Z.land Music Box workflow

Always obey the repository `AGENTS.md`.

Before implementation, determine which kind of task this is.

---

## Architecture or world-boundary task

Read:

- `references/architecture.md`
- `references/ride-map.md`

Read `references/story-map.md` as well when the architectural decision affects
the audience experience.

Check that ownership remains explicit between:

- Analysis Pipeline
- AudioClock
- AudioWorld
- actor simulation
- PhysicsWorld
- spatial adapters
- renderer
- ControlSurface
- DebugConsole

Do not solve an ownership problem by allowing two systems to become
authoritative over the same state.

In particular:

```text
AudioClock
→ authoritative musical time

AudioWorld
→ current musical truth
```

Do not merge these responsibilities casually.

---

## Experience or choreography task

Read:

- `references/story-map.md`
- `references/ride-map.md`

Read `references/architecture.md` when the requested behavior crosses system
boundaries.

Identify the relevant Story Map beat before implementing behavior.

Do not invent a new musical-to-physical mapping merely because it produces an
attractive animation.

Maintain experience hierarchy:

```text
Primary
Secondary
Ambient
Resting
```

without rewriting actor physics for presentation convenience.

---

## Existing ride migration or refactor

Read:

- `references/legacy-reuse.md`
- `references/architecture.md`
- `references/ride-map.md`

Then:

1. Locate the canonical existing implementation.
2. Identify pure geometry.
3. Identify pure simulation.
4. Identify actor-local state.
5. Identify renderer code.
6. Identify Framer-only code.
7. Extract without changing validated behavior.
8. Establish parity.
9. Connect AudioWorld only after extraction is stable.
10. Change presentation only when the current milestone requires it.

Never silently replace a validated simulation with a simpler animation.

Never choose an obsolete legacy version merely because it is easier to copy.

The newer segmented RollerCoaster is the canonical RollerCoaster baseline.

---

## Audio analysis work

Read:

- `references/architecture.md`
- `references/story-map.md`

Preserve the boundary:

```text
Audio Source
→ Analysis Pipeline
→ AudioMap
──────── runtime boundary ────────
→ AudioWorld
```

AudioWorld must not depend on how AudioMap was produced.

Do not add heavy DSP, ML, source separation, or transcription infrastructure
unless the current milestone actually requires it.

AudioMap must support partial musical understanding.

Do not fabricate unavailable musical domains.

---

## AudioWorld work

Maintain four distinct concepts.

### AudioClock

Owns authoritative musical transport time.

Responsible for:

- play
- pause
- seek
- restart
- current time
- duration
- transport state

### AudioMap

Whole-song precomputed or authored musical information.

### AudioSnapshot

Continuous musical truth at a specific transport time.

Prefer state that can be derived from:

```text
AudioMap + transport time
```

without accumulated visual history.

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

Do not represent short discrete events only as transient booleans inside a
render-frame snapshot.

Discrete event delivery must use timeline-crossing logic and must not depend on
render frame rate.

---

## Seek implementation rule

Seek is synchronization, not playback.

On seek:

```text
old time
→ new time
→ recompute AudioSnapshot
→ reset event cursor
→ emit seek semantics
→ actors reconcile
```

Do not replay every skipped musical event.

Do not spin Carousel through skipped notes.

Do not trigger skipped percussion impulses.

Do not trigger a DropTower drop merely because seek crossed a drop timestamp.

---

## Partial-domain handling

Every AudioWorld integration must define behavior when its required musical
domain is unavailable.

Examples:

```text
melody unavailable
→ Carousel may remain resting
```

```text
harmony unavailable
→ FerrisWheel may remain mechanically present but musically inactive
```

Do not generate fake confidence merely to keep the full park moving.

---

## Actor integration checklist

For every AudioWorld → actor integration, explicitly state:

1. What musical domain does the actor own?
2. Which AudioSnapshot fields does it read?
3. Which AudioEvents does it consume?
4. Is each input continuous or discrete?
5. What actor-local interpretation is applied?
6. What actor-local simulation state is affected?
7. What existing validated behavior must remain unchanged?
8. What resulting physical state is produced?
9. Which PhysicsWorld roles does the actor register?
10. Which spatial coordinate adapter is required, if any?
11. What does the renderer display?
12. What happens on pause?
13. What happens on seek?
14. What happens on restart?
15. What happens on song replacement?
16. What happens if the musical domain is unavailable?
17. What happens under reduced motion?
18. What must remain deterministic for debugging?
19. What must be manually verified in runtime?

If these cannot be stated clearly, do not implement the integration yet.

---

## Cross-actor interaction rule

Cross-actor effects must preserve causality.

Preferred:

```text
AudioWorld
→ Actor A
→ Actor A physical movement
→ PhysicsWorld
→ Actor B response
```

Avoid:

```text
AudioWorld
→ Actor A visual animation

AudioWorld
→ separate hard-coded Actor B visual animation
```

The second form only imitates physics.

If a design claims Actor A physically affected Actor B, the consequence must
pass through PhysicsWorld.

---

## Spatial integration rule

Read `references/architecture.md` before connecting:

- DOM participants
- SVG participants
- Canvas actors
- Three.js actors
- camera-relative objects
- scroll-relative objects

Do not implicitly mix coordinate systems.

Prefer explicit spatial adapters.

Camera or host movement must not automatically become fictitious physical
velocity.

Do not hide coordinate conversion inside unrelated actor simulation code.

---

## Determinism rule

Emergent simulation must remain debuggable.

When randomness affects:

- BumperCars
- Free Bodies
- particle distribution
- other physical initial conditions

use explicit seeded randomness during development where practical.

Do not scatter uncontrolled random calls through simulation loops.

If debugging depends on a seed, expose it through DebugConsole.

---

## Performance rules

Keep high-frequency simulation local to the actor where practical.

Do not push particle/body positions through shared React state every frame.

Do not create one `requestAnimationFrame` loop per trivial visual effect
without checking whether the actor already owns a simulation loop.

Do not perform avoidable layout reads inside hot frame loops.

Use bounded `dt`.

Pause or suspend unnecessary work when:

- offscreen, when appropriate
- document is hidden
- reduced motion requires a static response
- the simulation has settled

Do not claim runtime performance is validated unless it was actually measured
in a runtime environment.

---

## ControlSurface work

ControlSurface is audience-facing.

Read:

- `references/story-map.md`
- `references/architecture.md`

Potential responsibilities include:

- bring/load a song
- song preparation
- ticket presentation
- enter/start
- play/pause
- seek
- restart
- change song
- exit/reset

Current Gate / Ticket Booth treatment is a working metaphor, not a locked
visual design.

ControlSurface must call world APIs.

It must not own AudioClock or AudioWorld truth.

Do not expose development terminology to the visitor unless deliberately part
of the final design.

---

## DebugConsole work

DebugConsole is developer-facing.

It may expose:

- transport time
- AudioMap identity
- musical-domain availability
- rhythm
- melody
- harmony
- structure
- spectrum
- emitted events
- actor states
- PhysicsWorld registrations
- active force interactions
- settling state
- random seed

Debug observability has priority over visual polish.

Do not hide useful state merely to keep the development screen clean.

---

## Working style

Make the smallest architectural change that satisfies the current milestone.

Before editing, summarize:

- files that will change
- ownership boundary affected
- behavior that must remain unchanged
- current Story Map requirement
- acceptance condition

After editing, report:

- what changed
- what was deliberately not changed
- tests/checks actually run
- runtime behavior actually observed
- anything requiring manual runtime verification

Never report an unobserved browser behavior as passed.

Never claim parity without comparing against the relevant legacy behavior.

---

## Current milestone

The first implementation milestone is:

```text
Authored test AudioMap
→ authoritative AudioClock
→ AudioWorld Snapshot + Events
→ Carousel melody response
```

Milestone 1 must prove:

- play
- pause
- seek
- restart
- deterministic snapshot lookup
- note-on delivery
- note-off delivery
- correct synchronization after seek
- no replay of historical events after seek
- partial-domain handling
- DebugConsole visibility

The first UI is intentionally utilitarian.

Keep a developer DebugConsole.

Reserve an audience-facing ControlSurface API.

Do not commit to final Gate / Ticket Booth visuals yet.

Do not migrate all rides during this milestone.

After milestone 1 is stable, choose a second actor using a substantially
different musical signal type, such as:

```text
BumperCars
→ discrete percussion events
```

or:

```text
PirateShip
→ continuous groove / rhythmic phase
```

The second milestone should prove AudioWorld is a general musical semantic
layer rather than a Carousel-specific melody system.