# Z.land Music Box — Visual Language v0.1

## 1. Purpose

This document defines the visual language for Z.land Music Box after the core
musical, physical, Park Map, and Attention / Focus systems have been validated.

It does NOT redefine:

- AudioWorld
- Musical Evidence
- actor musical responsibilities
- actor simulation
- PhysicsWorld
- Park Map spatial topology
- AttentionState
- Focus behavior

It owns:

- visual hierarchy
- stroke hierarchy
- evidence accent
- typography
- district treatment
- infrastructure treatment
- map readability
- actor visual weight
- restrained color logic
- overview / focus visual consistency

The objective is:

> Make Z.land feel like a spatial mechanical score, not a dashboard, theme-park
> illustration, or generic futuristic interface.

---

## 2. Visual identity

Preferred qualities:

```text
mechanical
schematic
editorial
precise
playful through behavior
restrained in styling
low-chroma
high physicality
```

The world should feel designed through:

```text
structure
motion
causality
musical evidence
```

rather than decorative styling.

### Milestone 8B.2 — technical doodle lock

The Park Map rendering language is now:

```text
technical doodle
+ mechanical sketch
+ restrained annotation
+ precise Musical Evidence
```

Canonical geometry remains exact. Deterministic renderer-level perturbation may
make structure, infrastructure, district contours, and annotations look drawn
by hand, but it must never change musical lookup, simulation state, collision
geometry, PhysicsWorld coordinates, focus bounds, or route geometry.

The precision hierarchy is:

```text
Musical Evidence → cleanest
actor mechanics → lightly hand-drawn
Park Train infrastructure → slightly looser
district contours → visibly sketched
annotations → loosest
```

The same input geometry and semantic seed must always create the same visible
mark. Render-time randomness and frame-to-frame line boil are prohibited.
Typography for transport, evidence, controls, and diagnostics remains the
restrained sans-serif system. Annotation character comes from sparse leader
lines, underlines, brackets, slight label rotation, and spacing rather than a
global handwriting font.

Doodle affects rendering, never physical or musical truth. The result must read
as an annotated mechanical drawing, not a cartoon park, coloring book,
scrapbook, sticker interface, or generic hand-drawn SaaS page.

---

## 3. Avoid generic AI / futuristic visual language

Do not default to:

- black background + neon green
- cyberpunk gradients
- glowing glass cards
- holographic HUD rings
- generic waveform decoration
- particle-glow overload
- chrome / metallic sci-fi surfaces
- dashboard tiles
- equal rounded cards
- decorative grids
- artificial depth created only through blur and glow

Z.land should not look like a generic AI-product landing page.

---

## 4. Avoid children's amusement-park illustration

Do not default to:

- cartoon grass
- castles
- mascots
- smiling characters
- horses
- clown imagery
- pirate flags
- balloons with strings
- colorful tents
- rainbow ride colors
- crowd illustrations
- decorative amusement-park scenery

Ride identity should come from mechanics.

Playfulness should come from behavior.

---

## 5. Core palette principle

Start from a restrained palette.

Preferred base:

```text
background:
warm white / neutral off-white

primary structure:
near-black / dark neutral

secondary structure:
mid gray

quiet infrastructure:
light gray

musical evidence accent:
one restrained accent family
```

Do not assign one permanent color to each musical domain.

Avoid:

```text
melody = blue
harmony = purple
rhythm = orange
structure = red
```

as the main comprehension system.

Musical meaning should come from position, behavior, timing, and exact carrier
activation.

---

## 6. Accent color role

Accent color should primarily indicate:

```text
precise musical evidence
```

or:

```text
direct user interaction / selection
```

Examples:

- active Carousel note carrier
- active FerrisWheel chord-tone cabins
- current selected actor in Focus
- meaningful event marker
- transport selection

Accent should not cover entire districts merely because a domain is active.

A region may receive a very subtle tint, but local evidence remains primary.

---

## 7. Evidence color rule

If color appears to indicate musical truth, it must correspond to actual
Musical Evidence.

Correct:

```text
FerrisWheel:
C / E / G active
→ only those carriers receive evidence accent
```

Wrong:

```text
C major active
→ randomly highlight five cabins because composition looks better
```

Correct:

```text
Carousel:
active note carrier
→ evidence accent
```

Wrong:

```text
melody exists
→ whole Carousel turns accent color
```

---

## 8. Stroke hierarchy

Use line weight to establish structural hierarchy.

Suggested conceptual order:

```text
1. musical actor mechanics
2. precise musical evidence
3. actor district boundary
4. Park Train infrastructure
5. secondary map paths
6. tertiary labels / guides
```

Actor mechanics should be clearer than infrastructure.

Park Train should organize the map without visually dominating it.

---

## 9. Actor stroke treatment

Musical actors should use the strongest persistent structural lines.

Examples:

- FerrisWheel main wheel
- Carousel central mast / rings
- DropTower guide
- RollerCoaster rail
- PirateShip support
- BumperCars body outline

Exact Musical Evidence may use:

- accent stroke
- accent fill
- local weight increase
- small controlled pulse

Do not thicken the whole actor because one element is active.

---

## 10. District boundaries

District boundaries are geography.

They are not cards.

Preferred:

- thin
- low contrast
- irregular
- partially open
- map-like
- spacious

Avoid:

- strong rounded rectangles
- card shadows
- equal boxes
- thick borders
- filled dashboard panels

District boundaries should disappear visually before actor mechanics do.

---

## 11. Park Train visual treatment

Park Train is Experience Composition infrastructure.

It should be visually quieter than musical actors.

Use:

- fine rails
- subtle ties
- low contrast
- restrained station marks

Do not give it musical accent color by default.

Do not make it look like another active musical ride.

---

## 12. RollerCoaster visual treatment

RollerCoaster is a musical actor.

It should look physically distinct from Park Train.

RollerCoaster may use:

- stronger rails
- clearer support rhythm
- visible Lift / Crest / Drop / Loop / Runout geometry
- rider / Orb clearly attached to route

Park Train:

```text
quiet circulation infrastructure
```

RollerCoaster:

```text
active phrase mechanism
```

This distinction must be visually obvious.

---

## 13. Carousel visual treatment

Carousel should remain:

```text
mechanical
media-neutral
precise
```

Keep:

- central mast
- rotating platform / ring
- poles
- abstract carriers

Do not reintroduce horses or fairground decoration.

Active note carrier should be locally clear.

The whole machine should not visually flash on every note.

---

## 14. FerrisWheel visual treatment

FerrisWheel should remain one of the clearest musical-evidence actors.

Keep:

- large wheel
- radial structure
- 12 readable cabins
- gravity-oriented cabins

Active chord-tone cabins should be immediately distinguishable.

Avoid turning the wheel itself into a large glow ring.

The harmonic pattern should read through carrier membership.

---

## 15. PirateShip visual treatment

PirateShip should read as:

```text
pivot
+
pendulum support
+
abstract suspended body
```

Avoid literal pirate imagery.

Swing motion itself carries the identity.

The structure should remain readable at Overview scale.

---

## 16. BumperCars visual treatment

BumperCars should remain compact and local.

Use simple abstract vehicle bodies.

Collision clarity is more important than decorative detail.

Avoid:

- themed cars
- headlights / cartoon faces
- excessive arena styling

The arena should remain a physical field, not a UI card.

---

## 17. DropTower visual treatment

DropTower should read through vertical mechanics.

Important:

- bottom
- guide
- carriage
- hold region
- travel
- rebound

Avoid over-decorating the tower.

The vertical motion itself should create tension.

If the actor is visually weak in Overview, prefer stronger carriage / guide
contrast before adding decorative mass.

---

## 18. Free Bodies visual treatment

Free Bodies / Orb should remain abstract.

Preferred:

- simple circles
- soft outlined bodies
- restrained fill
- subtle variation

Avoid:

- literal balloons
- strings
- cartoon bubbles
- excessive glow

Their meaning comes from trajectory and shared-world response.

---

## 19. Anchored Content visual treatment

Ordinary content should still look like content.

Do not style it as another amusement ride.

Examples:

- text
- label
- small content block
- image
- logo

Physical response should remain visible without destroying readability.

---

## 20. Typography

Typography should feel:

```text
editorial
technical
quiet
```

Prefer:

- clear grotesk / sans-serif
- compact labels
- restrained uppercase for dev/map labels
- readable body type
- limited type hierarchy

Avoid:

- arcade fonts
- carnival fonts
- retro circus typography
- generic sci-fi display fonts

The experience should not rely on typography to explain every musical role.

---

## 21. Labels

Actor names may remain visible where useful.

Examples:

```text
Carousel
FerrisWheel
DropTower
```

Music-theory domain names should be optional.

Avoid large permanent labels such as:

```text
MELODY
HARMONY
GROOVE
PHRASE
```

unless an info / learning mode explicitly enables them.

---

## 22. Overview visual hierarchy

At Overview:

- Park topology must remain clear
- actors remain identifiable
- precise musical evidence remains visible where possible
- infrastructure becomes quiet
- districts remain subtle
- Free Bodies remain atmospheric
- labels do not compete with mechanics

Do not try to expose every debug detail at Overview.

---

## 23. Focus visual hierarchy

At Focus:

- selected actor gains more local visual resolution
- exact Musical Evidence becomes easier to inspect
- surrounding park remains recognizable
- infrastructure may quiet down
- unrelated Free Bodies may reduce visual prominence locally

Do not completely restyle an actor between Overview and Focus.

Focus should feel like:

```text
closer inspection of the same object
```

not:

```text
switching to a different UI component
```

---

## 24. Primary / Secondary / Ambient / Resting styling

These roles affect presentation only.

Possible treatment:

### Primary

- full actor contrast
- strongest local readability
- slightly stronger evidence accent
- district boundary clearer

### Secondary

- normal actor contrast

### Ambient

- reduced structural contrast
- exact Musical Evidence still visible

### Resting

- lowest persistent structural contrast
- no fake evidence

Do not hide actual Musical Evidence in Ambient.

---

## 25. Automatic attention should remain restrained

Do not make every Primary transition visually dramatic.

Avoid:

- whole-map flashing
- hard color changes
- strong region fills
- actor scaling every few seconds

Prefer subtle changes:

- contrast
- local line weight
- district clarity
- slight luminance
- restrained camera emphasis

---

## 26. Empty space

Whitespace is part of the visual system.

Do not fill empty regions with decoration merely because they look empty.

Empty space provides:

- breathing room
- musical silence
- actor separation
- trajectory visibility
- Focus clarity

---

## 27. Map background

Keep background simple.

Preferred:

- warm white
- neutral paper-like tone
- flat low-noise surface

Avoid:

- gradient skies
- illustrated landscapes
- large decorative textures
- noisy grid backgrounds

If texture is used, it should be extremely subtle.

---

## 28. Depth

Depth should come primarily from:

- overlap
- relative scale
- line hierarchy
- motion
- physical occlusion where truthful

Avoid relying on:

- drop shadows everywhere
- heavy blur
- glass effects
- floating cards

Z.land should feel like one spatial drawing, not stacked UI panels.

---

## 29. Motion trails

Motion trails may be used sparingly when they reveal mechanics.

Possible:

- RollerCoaster trajectory
- BumperCars collision trace
- Free Body wake response

Trails must reflect real motion.

Do not add decorative trails unrelated to simulation truth.

---

## 30. Physics debug is separate

Physics debug overlays are not part of final visual language.

Keep:

```text
?hide-physics-debug
```

or equivalent.

Do not use debug force vectors, source radii, or coordinate markers as final
design elements unless a later explicit design decision reinterprets them.

---

## 31. Color and musical truth

Color may eventually support Musical Evidence.

It must never become a substitute for precise spatial evidence.

Example:

FerrisWheel chord tones may use accent color.

But:

```text
chord identity
≠
whole district color
```

Likewise:

```text
note identity
≠
whole Carousel color
```

---

## 32. No permanent domain rainbow

Do not use a permanent six-color legend for:

- melody
- harmony
- groove
- percussion
- structure
- phrase

unless a later educational mode explicitly needs it.

The main experience should remain visually unified as one world.

---

## 33. Park Map line ecology

The Park Map should feel like one coherent drawing.

Different systems may have distinct visual weight, but they should share:

- line grammar
- corner treatment
- stroke caps
- labeling logic
- spacing rhythm

Do not make every ride look like it came from a different illustration style.

---

## 34. Evidence accent consistency

Exact Musical Evidence should use a coherent accent language.

Examples may include:

- accent outline
- accent fill
- accent underline
- small pulse

Choose a small consistent set.

Do not invent a different activation effect for every actor unless the actor's
mechanics require it.

---

## 35. Mechanical identity over decoration

If a ride is hard to identify, first improve:

- mechanical structure
- proportions
- motion readability
- semantic scale

before adding decorative theme elements.

Examples:

DropTower:
improve carriage / travel readability

PirateShip:
improve pivot / arc

RollerCoaster:
improve route / track structure

Do not solve mechanical ambiguity with decorative icons.

---

## 36. Responsive visual principle

Responsive adaptation may later simplify:

- labels
- secondary infrastructure
- district detail
- map ornament

It must preserve:

- actor identity
- exact Musical Evidence where possible
- shared-world topology
- Focus accessibility

Do not solve mobile by converting the world back into six vertical cards.

---

## 37. Development vs production visual modes

Development mode may retain:

- actor labels
- debug labels
- segment names
- diagnostics
- explicit bounds

Production experience may remove many of these.

Do not prematurely delete development labels until the visual system is stable.

---

## 38. Milestone 8B.1 scope

The first Visual Language pass should unify:

- stroke hierarchy
- district treatment
- Park Train hierarchy
- musical-evidence accent
- typography
- map background
- actor/infrastructure contrast
- Overview / Focus visual consistency

It should not:

- finalize brand identity
- choose complex multi-color palette
- add illustration
- rebuild actor geometry
- add new interaction
- change musical mappings
- change simulation
- change PhysicsWorld

---

## 39. Success criteria

The visual language succeeds if the experience reads as:

```text
one coherent mechanical spatial score
```

rather than:

```text
debug SVG
```

or:

```text
dashboard
```

or:

```text
children's amusement park
```

or:

```text
generic futuristic AI interface
```

while precise Musical Evidence remains easy to distinguish.

---

## 40. Visual invariant

When making a styling decision, ask:

1. Does it improve actor/mechanical readability?
2. Does it preserve Musical Evidence accuracy?
3. Does it preserve the feeling of one shared world?
4. Is it attention guidance or false musical signaling?
5. Does it reduce or increase dashboard behavior?
6. Does it add useful hierarchy or merely decoration?
7. Could the same result be achieved through structure/motion instead of extra
   visual ornament?

Preferred principle:

```text
quiet structure
+
precise evidence
+
expressive motion
```

The world should be restrained when nothing is happening.

The music should make the world become legible through behavior.
