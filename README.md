# Zoë + Z.land

Two independent Vite + React + TypeScript products sharing explicitly owned
computational-listening packages.

## Run

Node.js 22.12+ (Node 24 recommended), npm:

```sh
npm install
npm run dev:zoe
npm run dev:zland
```

```sh
npm run typecheck
npm run build
```

`npm run build` builds both products and no legacy root application. Vite
prints each product's local URL.

The Z.land route renders the shared Park Map. Add `?mode=workbench` to retain
the vertical actor-by-actor development view. `?hide-physics-debug` works with
either mode and may be combined as `?mode=workbench&hide-physics-debug`.

## Ownership

- `apps/zoe`: standalone file/live computational-listening instrument.
- `apps/zland`: complete Z.land runtime, including rides, physics, controls,
  authored overlays, Park presentation, and app-local `AudioWorld` facade.
- `packages/listening-engine`: browser-independent analysis and timelines.
- `packages/audio-source-browser`: browser file/playback/live source ownership.
- `packages/listening-instrument-ui`: SignalPlayer and SignalConsole presentation.
- repository root: workspace scripts, tests, docs, and boundary enforcement only.

## Placeholder behavior

Play/pause/seek/restart control either the authored fixture or a decoded local audio file. Restart returns actors to deterministic initial states and clears shared transient physics. Seek skips historical musical and physical events. Melody drives Carousel expression; percussion drives BumperCars impulses; rhythm drives PirateShip's actor-local pendulum. Meaningful BumperCars body collisions publish normalized world-space impacts through PhysicsWorld. An anchored Test Receiver responds only to nearby physical impacts, then returns through spring and damping. Pause removes new musical input while actor and shared physical consequences may continue. Selecting a replacement file invalidates stale preparation results and replaces the active source only after preparation succeeds.

The Milestone 3A.1 debug overlay projects the latest actual PhysicsWorld impact, radius, normal, receiver force path, received impulse, and receiver displacement into the BumperCars arena. Add `?hide-physics-debug` to the local URL to remove the overlay. The DebugConsole reports the same underlying event and receiver state.

Milestone 3B replaces the generic receiver view with a normal-layout content card. A DOM spatial adapter measures its authored bounds on mount, resize, ResizeObserver notification, or the explicit `zland:physics-layout-invalidate` event; simulation reads do not measure layout. The existing AnchoredReceiver supplies only the nested temporary response transform. Layout anchor changes do not create physics velocity, and restart clears response energy without replacing the measured layout.

Milestone 4A adds authored harmony to the prepared ZlandAudioMap and routes the continuous harmony snapshot plus chord-change/seek events through a dedicated FerrisWheel adapter. The actor retains its own slow wheel inertia and acceleration-driven suspended-cabin springs. Twelve abstract carriers represent simultaneous pitch classes; active chord tones are sustained together. FerrisWheel remains actor-local and has no PhysicsWorld role in this milestone.

Milestone 5A adds an authored structural fixture with rest, build, tension, hold, explicit major drop, release, and settling regions. AudioWorld exposes continuous structure state and a timeline-crossed `drop` event. DropTower interprets these through its own lift, hold, gravity drop, rebound, and settling state machine; seek reconciles directly without replaying a skipped drop. DropTower remains actor-local and has no PhysicsWorld role in this milestone.

Milestone 6A adds a separate 24-second phrase contour for RollerCoaster. The extracted open segmented route uses Station, Lift, Drop, Loop, Runout, and return Station geometry. Phrase progress, energy, tension, and release alter actor-local drive and braking conditions without directly assigning route distance or velocity. The neutral Orb rider remains a renderer concern.

Milestone 6B registers RollerCoaster as a continuous PhysicsWorld wake source. An explicit spatial adapter maps current route pose and forward direction into normalized world coordinates; wake strength derives only from physical speed and bounded acceleration. The directional trailing field and BumperCars impacts both feed the same anchored content receiver state.

Milestone 9F replaces the permanent fixed-route assumption with a deterministic two-stage generator. A serializable TrackPlan converts whole-song structure, smoothed macro energy, pulse context, recurrence, and an explicitly non-formal phrase proxy into evidence-backed Station, Lift, Crest, Drop, Run, Loop, and Runout features. A separate geometry generator composes and globally normalizes one TrackMap inside the existing RollerCoaster district. The map is generated once per adopted ZlandAudioMap; playback, seek, restart, focus, and attention do not regenerate it. The rider still advances by actor-local route physics, and PhysicsWorld wake still derives only from its actual pose, velocity, and acceleration. Weak inputs use a deterministic gentle fallback grammar.

Milestone 7A adds eight deterministic Free Bodies / Orbs in canonical PhysicsWorld space. Authored spectrum evidence changes bounded buoyancy and seeded continuous turbulence, while the same bodies receive real RollerCoaster wake and BumperCars collision effects through PhysicsWorld. All forces compose into one actor-local trajectory with soft containment, deterministic restart, and a restrained reduced-motion mode.

Milestone 8A.1 composes the existing live actors into one Park Map without
creating duplicate simulations. Explicit actor anchors use canonical normalized
PhysicsWorld coordinates: `(0, 0)` is the map's top-left and `(1, 1)` is its
bottom-right. The `1000 × 640` SVG viewBox is only a rendering projection.
RollerCoaster route samples pass through its existing spatial adapter;
BumperCars use the same arena-to-world mapping as their PhysicsWorld adapter;
Free Bodies already occupy canonical world space. The abstract Gate is a
non-interactive landmark, and the anchored content participant keeps its live
DOM-to-PhysicsWorld registration.

Milestone 8A.1b adds explicit irregular actor districts and increases the
semantic map scale of Carousel and FerrisWheel. BumperCars now maps its
unchanged local simulation arena into a bounded lower-right Park district;
rendered cars and published PhysicsWorld impacts use the same spatial adapter.
The current song-specific RollerCoaster TrackMap remains park-wide and gains renderer-only
rail bed, rail, tie, direction, and segment treatments. Free Bodies retain
their canonical positions while the overview renders smaller markers and only
the selected body's velocity, reducing map-level diagnostic density.

Milestone 8A.1c separates musical actors from experience infrastructure. A
static Park Train railway now carries outer circulation without AudioWorld or
PhysicsWorld participation. RollerCoaster retains its canonical phrase
simulation inside a dedicated district; its renderer and PhysicsWorld wake use
the same explicit district transform. Semantic scale makes FerrisWheel's twelve
harmonic carriers substantially larger and gives DropTower a taller structural
travel axis while preserving Carousel, PirateShip, and the bounded BumperCars
arena. Free Body positions remain canonical; renderer-only quiet zones reduce
their weight over dense musical evidence.

Milestone 8A.1d removes the obsolete heavy land contour so the quiet Park
Train railway is the sole composition perimeter. The configured railway loop
expands toward all four map edges while the ride districts remain inside it.
Park Map passes a district-only renderer fit to DropTower, mapping its unchanged
local `560 × 450` mechanics across the tall district so the guide and carriage
travel use the available vertical range. Workbench rendering keeps the original
aspect-preserving DropTower mapping.

Milestone 8A.1e rebalances three semantic actors without changing their live
state. DropTower keeps its district-height mapping in a shorter `0.54`-high
landmark. RollerCoaster moves left into a `0.47`-wide phrase district, with the
same expanded bounds supplied to both route rendering and PhysicsWorld wake.
PirateShip keeps its existing district and receives a Park-only height fit,
increasing pivot-to-carrier screen travel while Workbench retains the original
aspect-preserving renderer.

Existing `AGENTS.md` and `.agents/skills/zland-music-box/` remain authoritative
and unchanged.

Milestone 8A.2 adds a presentation-only attention controller for stable Overview roles and manual actor Focus. Six explicit focus bounds drive one composition-level viewport transform while the same live actor, AudioWorld, and PhysicsWorld state continues underneath. Click or keyboard-activate an actor to focus it; use Back to Overview, Escape, or empty Park space to return.

Milestone 9E.1 extends that controller with a transparent Structure-driven Experience Composition policy. Candidate scores combine truthful domain availability and activity with bounded section energy, contrast, importance, boundary anticipation, and continuity. A three-second hold plus a 0.08 switch margin prevents rapid Primary changes. These values affect presentation roles only: they never enter AudioWorld, actor adapters, simulations, or PhysicsWorld. When structure is unavailable, the previous automatic policy remains the fallback.

Milestone 8A.2 adds a presentation-only attention controller for stable Overview roles and manual actor Focus. Six explicit focus bounds drive one composition-level viewport transform while the same live actor, AudioWorld, and PhysicsWorld state continues underneath. Click or keyboard-activate an actor to focus it; use Back to Overview, Escape, or empty Park space to return.

Milestone 8B.1 establishes a shared monochrome visual token system across the Park Map and development workbench. A single restrained accent family marks precise musical evidence and direct interaction, while actor mechanics, districts, map guides, and Park Train infrastructure use an explicit neutral stroke hierarchy. This pass changes presentation only; musical evidence, actor simulations, PhysicsWorld, topology, and Focus framing remain unchanged.

Milestone 8B.2 adds a deterministic technical-doodle renderer to the Park Map.
Shared seeded path, line, and circle utilities give districts, infrastructure,
and selected mechanical structure restrained pen irregularity while exact note,
MIDI, chord-tone, transport, and debug evidence stays clean. Stable semantic
seeds prevent frame-to-frame shimmer. Sparse mechanical annotations reuse the
existing sans typography, and Workbench diagnostics retain their technical
presentation. Doodle geometry is renderer-only and never feeds AudioWorld,
actor simulation, PhysicsWorld, topology, or focus bounds.

Milestone 9A adds a browser-local real-audio foundation. File selection decodes
through Web Audio, then a chunked offline pass downmixes channels by arithmetic
mean and analyzes `2048`-sample Hann-windowed frames with a `1024`-sample hop.
The fixed bands are 20–250 Hz, 250–4000 Hz, and 4000 Hz–Nyquist. Brightness is
the magnitude-weighted spectral centroid divided by Nyquist; texture and the
optional generic onset strength use positive spectral flux. RMS, bands, and
texture use stored per-file 95th-percentile references and actor-facing values
are bounded to 0–1. The decoded multichannel buffer remains authoritative for
playback while only prepared serializable regions enter AudioWorld.

The 9A spectrum stage advertises `spectrum`; domains added by later analysis
stages remain independently capability-gated. Free Bodies consume the real spectrum snapshot. Playback creates a fresh one-shot
`AudioBufferSourceNode` for play, resume, seek, and playing restart, stopping and
disconnecting the previous node first. Selecting another file invalidates late
decode or analysis results. Replaced source nodes are disconnected; the active
decoded buffer is retained only by the active preparation/transport and the
AudioContext is closed when the page owner is disposed.

Milestone 9B derives deterministic rhythm evidence from the existing generic
onset envelope without another FFT pass. It searches 60–200 BPM in 0.5 BPM
steps using normalized onset autocorrelation, ranks tempo candidates, resolves
half/double-time candidates through direct recurring-onset support, and snaps a
bounded beat grid to nearby onsets. Rhythm becomes available only for at least
four seconds of material with sufficient onsets, periodicity, grid support, and
the configured confidence threshold (`0.56` after the 9E.2 multi-band pass).

The serialized real ListeningMap stores confidence, tempo candidates, monotonic
beat timestamps, interval, and conservative groove/swing evidence. AudioWorld
derives beat index and phase from adjacent stored timestamps at the current
AudioClock time. It does not run an independent metronome. Meter and downbeat
analysis remain unavailable, so bar fields stay neutral. Swing is emitted only
when at least four stable offbeat onsets support a delayed subdivision; groove
describes measured beat-grid correction and supported swing. Confident rhythm
wakes the existing PirateShip adapter and simulation. Generic beat events remain excluded from the BumperCars adapter.

Milestone 9G reuses that same STFT pass to derive positive spectral-difference
transients and normalized sub, low-mid, mid, high, and air descriptors. A
deterministic rule-score baseline classifies Kick, Snare, Closed Hat, Open Hat /
Cymbal, Tom / Low Percussion, or Other Percussive with explicit confidence and
uncertainty. AudioWorld delivers accepted hits through timeline crossings to
six persistent role cars. Each hit creates only an actor-local impulse; actual
car motion and the existing collision solver remain the sole path to a
PhysicsWorld impact. Musically Resting does not mean Physically Inactive.

Milestone 9C adds a deterministic local predominant-melody baseline. The
arithmetic-mean mono signal already created from the decoded buffer is box
resampled to 12 kHz for bounded analysis. Pitch frames contain 2048 samples
with a 192-sample hop. A Hann-weighted YIN-like difference function searches
80–1400 Hz, retains at most five periodicity minima, and combines periodicity
with bounded Goertzel support at the fundamental and first three harmonics.
A small dynamic-programming path penalizes large semitone jumps, octave jumps,
and unsupported voiced/unvoiced transitions. Isolated one-frame octave glitches
are corrected only when both neighboring frames agree.

The ListeningMap preserves the continuous `pitchHz` / `midiFloat` contour separately
from discrete notes. Segmentation requires a stable pitch change, uses a
confidence-weighted median before MIDI quantization, merges at most 64 ms of
consistent unvoiced interruption, and rejects notes shorter than 80 ms. Melody
becomes available only after at least 0.5 seconds of usable evidence, a minimum
voiced ratio, and track confidence of `0.58`. Silence, noise, brief pitched
fragments, and low-confidence candidates remain unavailable.

Milestone 9H derives scale-degree evidence in AudioWorld from the current
absolute melody note and validated tonal-center segment. The Carousel's eight
media-neutral carriers now have fixed identities: degrees 1–7 plus the next
octave tonic. Major and natural-minor mappings preserve exact note name, MIDI,
pitch, timing, confidence, and source provenance. A stable segment reference
tonic near the melody's lower quartile distinguishes carrier 1 from carrier 8.
Chromatic, low-confidence, out-of-range, and no-key notes never use a nearest
carrier or modulo fallback; they retain absolute identity in a separate precise
marker. FerrisWheel represents the tonal world, while Carousel represents the
melody's position inside it.

Milestone 9H.1 adds one shared `ParkPulse` interpreter. It reads only the
AudioWorld rhythm snapshot, publishes a bounded low-energy `park-pulse` source
through PhysicsWorld, and reaches the existing anchored-content and Free Bodies
receivers there. Pause stops new rhythmic pulse generation; seek resolves the
current beat phase without replaying pulse history. Actors never subscribe to
ParkPulse directly. Carousel retains immediate note and scale-degree truth while
a presentation-only 150 ms attack / 450 ms release changes secondary mechanical
presence. When melody is unavailable its evidence remains resting while the
mechanism may keep a neutral idle rotation. Free Bodies keep the same physics
state and use only a lower Park Map presentation ceiling.

Known foundation limits include dense polyphonic masking, breathy or noisy
vocals, accompaniment with comparable salience, residual octave ambiguity,
fast ornamentation, continuously sliding pitch, melody below 80 Hz, and long
full-mix files that can occupy the main analysis thread. No source separation,
ML model, external service, or MIDI export is included.

Milestone 9D adds a deterministic browser-local harmony baseline over the same
mono decode used by the other analysis domains. It box-resamples to 12 kHz and
uses 4096-sample Hann windows with a 1024-sample hop. Local spectral peaks from
80–5000 Hz are mapped to the nearest chromatic pitch class, weighted by tuning
proximity, log-compressed, reduced by a per-frame chroma floor, raised to a
bounded contrast power, and L1-normalized into a 12-bin `C…B` vector.

The deliberately small vocabulary contains only 12 major and 12 minor triads.
Each template score combines chord-tone energy, root/third/fifth coverage, a
slight root preference, third-quality contrast, and an outside-tone penalty.
Frames become `no-chord` below `0.52` confidence or when energy, third evidence,
or the best-versus-second-best margin is inadequate. A three-frame island pass,
one-frame no-chord bridging, and a 240 ms minimum segment duration suppress
short label chatter without inventing a wider chord vocabulary.

Harmony becomes available only after at least 0.75 seconds of reliable chord
evidence and track confidence of `0.60`. The serialized analysis retains bounded
frame chroma and candidate diagnostics plus monotonic chord segments with exact
root, quality, pitch classes, range, and confidence. AudioWorld exposes those
segments through its existing harmony snapshot and chord-change timeline.
FerrisWheel receives that same snapshot through its existing adapter: its active
cabins are the exact active pitch-class set, so one major or minor triad normally
activates three carriers. Focus and Ambient presentation do not alter this set.

The chord foundation intentionally omits seventh and extended chords,
inversions as labels, slash chords, enharmonic spelling,
source separation, and structure/phrase inference. Ambiguous dyads, silence,
noise, very short fragments, and weak or rapidly changing harmony remain
unavailable or no-chord rather than being assigned a confident label.

Milestone 9D.1 reuses those normalized chroma frames and chord segments to
derive slower tonal-center evidence. It evaluates all 24 major/minor keys with
the explicit Krumhansl–Kessler profiles in deterministic 8-second windows with
a 2-second hop. Cosine profile fit remains primary; bounded tonic recurrence
and diatonic chord compatibility assist major/minor disambiguation. The
analyzer uses full-song, non-causal dynamic programming with a switch penalty
and a 4-second minimum modulation segment.

ListeningMap stores candidate frames, stable tonal-center segments, global fallback,
confidence, fifths metadata, and all analysis parameters. AudioWorld resolves
the active segment from transport time and emits `tonal-center-change` only
when a real boundary is crossed. Seek resolves the destination directly. The
capability remains unavailable for insufficient, chromatic, silent, or upstream
unreliable evidence.

Milestone 9D.2 gives FerrisWheel two separate musical timescales. Current chord
membership still activates the exact canonical pitch-class cabins. Stable tonal
center now chooses a whole-wheel orientation: the twelve physical slots follow
circle-of-fifths order, and the tonic slot targets the bottom boarding position
through a bounded damped rotational spring. The wheel keeps its current physical
angle across tonal changes and seek, then follows the nearest continuous target;
low-confidence evidence retains the last valid target. Suspended cabin swing is
still driven by actual wheel acceleration. No tonal semantics enter PhysicsWorld.

Milestone 9E derives neutral whole-song structural evidence from existing
analysis products. It aggregates a compact chroma, spectral-shape, brightness,
texture, and onset vector per detected beat, with deterministic one-second bins
when rhythm is unavailable. Per-dimension z-score normalization, a bounded
cosine self-similarity matrix, two-scale checkerboard novelty, minimum-separated
peaks, and a four-second minimum section duration produce section boundaries.

Segment summaries are grouped into neutral recurrence families such as A, B,
and A′. Energy, adjacent contrast, confidence, and structural importance remain
separate bounded values. AudioWorld exposes the current segment and emits
`section-change` only for forward timeline crossings; seek resolves directly.
Analyzed sections do not trigger DropTower or directly change Attention; Milestone 9F may consume the completed whole-song structure once to generate RollerCoaster geometry, and no real-audio `drop` is fabricated.

Milestone 9E.2 makes the same pipeline robust to repetitive and texture-driven
material without a genre mode. Rhythm now derives full-band, 20–180 Hz low-band,
2500 Hz–Nyquist high-band, and RMS energy-pulse evidence in the existing FFT
pass. Tempo candidates retain the 60–200 BPM search, group half/double-time
families, prefer low/full primary-grid coverage, and use faster high-band
periodicity only as subdivision support. Candidate score weights are explicit:
full periodicity `0.25`, low periodicity `0.25`, subdivision `0.12`, energy pulse
`0.10`, primary-grid support `0.24`, and expected-range prior `0.04`, followed by
a bounded high-only ambiguity penalty. Confidence records multi-band support,
grid support, family margin, and pulse consistency with a `0.56` availability
threshold; energy pumping cannot create rhythm without onset anchors.

Structure now has two levels. Short-scale brightness, texture, high-band, onset,
and local-energy changes produce analysis-only `ArrangementChange` records.
Medium/long core novelty, persistent chroma/low-mid contrast, energy regime, and
a bounded 8/16/32-beat block bonus produce `StructureBoundary` records. The
ordinary section minimum is eight seconds; only strong multi-domain evidence may
use the four-second floor. Recurrence identity excludes local timbral features,
so repeated material can remain A while its arrangement evolves. Arrangement
changes never emit `section-change` and never switch Structural Attention.

`Arrangement Change ≠ Section Boundary`. Structure operates at multiple temporal
scales. `Musically Resting ≠ Physically Inactive`: a presentation role does not
reset or disable an actor's existing physical simulation.

Milestone 9I connects the existing real `AudioWorld.structure` snapshot to the
existing DropTower state machine through `realStructureAdapter.ts`. The adapter
derives bounded build, tension, lift intent, hold intent, and release from
section-scale evidence. A real analyzed drop requires 1.5 seconds of sustained
preparation, sufficient accumulated build and tension, a strong boundary and
release score, confidence of at least `0.62`, and an expired six-second cooldown.

`section-change ≠ Drop`. A section boundary is only one release cue. Arrangement
changes are ignored, high energy alone is insufficient, and seek reconciles the
destination without replaying historical releases. The adapter requests action;
the actor-local `IDLE → LIFTING → HOLDING → DROPPING → REBOUND → SETTLING`
simulation remains the sole owner of physical state and carriage motion.

`AudioWorld.structure` continues to feed Structural Attention and DropTower as
independent sibling consumers. ParkPulse remains a separate rhythm-driven
PhysicsWorld path, and analyzed structure does not create a direct shared-world
impact. `Musically Resting ≠ Physically Inactive`: an authorized fall, rebound,
or settling trajectory may continue after current structure becomes neutral.

Milestone 8C adds a presentation-only live annotation layer to the integrated
Park. Six reusable actor annotations project existing public Musical Evidence,
actor state, and selected PhysicsWorld diagnostics into compact architectural
callouts with canonical anchors and deterministic leader-line placement.
Overview shows at most a few values per actor; manual Focus expands only the
selected actor. Ambient and Resting attention roles reduce density without
changing the underlying evidence.

Annotations follow the existing 10 Hz UI instrumentation refresh and do not add
a musical clock. They never write AudioWorld, actor simulations, PhysicsWorld,
Attention, TrackMap, or controls. `Annotation observes system truth; annotation
never owns system truth.` Default Park annotation remains distinct from the full
DebugConsole. Facilities may remain mechanically still while live evidence gives
the Park continuous informational activity.
