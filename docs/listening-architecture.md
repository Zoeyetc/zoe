# Computational Listening workspace boundary

The current root application remains the production entry during extraction.
The workspace directories establish future ownership without copying or moving
the existing implementation.

## Ownership

- **Listening Engine** owns audio evidence, musical interpretation, retained
  analysis data, and generic listening events.
- **Audio Source Browser** owns `File`, `AudioBuffer`, Web Audio playback,
  `MediaStream`, capture worklets, device authorization, and source lifecycle.
- **Instrument UI** owns SignalConsole, ListeningField, SignalPlayer, and their
  presentation dependencies.
- **Instrument App** owns the standalone Computational Listening composition
  root.
- **Z.land** owns rides, PhysicsWorld integration, choreography, and authored
  structure overlays.

The shared listening engine must never import application UI, Z.land rides,
physics, SignalConsole, SignalPlayer, or experience composition.

## Gradual migration

Later phases will expose moved modules through workspace package exports. When
an old source path must remain temporarily valid, that path may contain a small
compatibility re-export. Implementations must not be duplicated. Phase 1 moves
no production source and therefore needs no compatibility re-exports.

## Listening result ownership

`ListeningMap` is the immutable engine-owned analysis result. It contains
generic musical evidence, analysis capabilities, retained analysis timelines,
and source-independent analysis metadata.

The root `AudioMap` type is temporary migration composition only:

```text
ListeningMap
+ AudioMapHostMetadata
+ ZlandAuthoredOverlay
= legacy AudioMap
```

Browser/file/device identity belongs to `audio-source-browser`. Authored build,
tension, phrase, and drop annotations belong to Z.land. The legacy `AudioMap`
composition must be deleted in the final cleanup batch after its consumers move
to the explicit contracts.

## Batch A temporary analysis compatibility paths

The pure analysis implementation now belongs to `@computational-listening/engine`.
These root paths are compatibility-only and must be deleted after remaining root
consumers import the engine and diagnostics package boundaries directly:

- `src/audio/ScaleDegree.ts`
- `src/audio/analysis/AudioAnalysis.ts` (retain only legacy `AudioMap` composition until its consumers migrate)
- `src/audio/analysis/MelodyAnalysis.ts`
- `src/audio/analysis/HarmonyAnalysis.ts`
- `src/audio/analysis/RhythmAnalysis.ts`
- `src/audio/analysis/PercussionAnalysis.ts`
- `src/audio/analysis/TonalCenterAnalysis.ts`
- `src/audio/analysis/StructureAnalysis.ts`
- `src/audio/melody-evidence/compactTimeline.ts`
- `src/audio/melody-evidence/selectMelodyEvidence.ts`
- `src/audio/melody-evidence/dpDiagnostics.ts`

Browser `AudioBuffer` conversion belongs to
`@computational-listening/audio-source-browser`. Legacy host identity and Z.land
authored overlays remain outside the engine.

## Batch B temporal boundary

`@computational-listening/engine` owns `ListeningTimeline`, `ListeningSnapshot`,
and generic analyzed `ListeningEvent` crossing. It receives host/session map
identity explicitly and owns no clock or transport mechanism.

Z.land authored structure, build, tension, phrase progress, structural drops,
host map identity, and seek notification remain behind
`src/audio/zland/ZlandListeningAdapter.ts`. `src/audio/AudioWorld.ts` is a
temporary legacy facade over these two boundaries and is scheduled for deletion
or reduction after Z.land consumers migrate. The standalone Instrument must
consume the engine timeline contract directly rather than importing AudioWorld.

## Batch C browser source boundary

`@computational-listening/audio-source-browser` owns finite-file decoding and
Web Audio playback, browser transport clocks, live capture authorization,
device enumeration and replacement, AudioWorklet capture, browser latency, and
source/session metadata. It delivers PCM and generic `ListeningMap` updates; it
does not own musical interpretation.

The engine-owned `RollingListeningSession` owns the source-independent 12-second
PCM window, repeated analysis cadence, one-running-plus-one-newest backpressure,
retained generic events, and bounded diagnostics. It has no MediaStream,
AudioContext, device, permission, or browser dependency.

Temporary root compatibility paths scheduled for Batch E deletion:

- `src/audio/AudioPlaybackTransport.ts`
- `src/audio/AudioSourceLoader.ts`
- `src/audio/live/LiveAudioClock.ts`
- `src/audio/live/LiveAudioInputController.ts`
- `src/audio/live/LiveRollingAnalyzer.ts`
- `src/audio/live/RollingPcmBuffer.ts`
- `src/audio/live/livePcmWorklet.ts`
- `src/audio/live/types.ts`

`AudioPreparationController` remains host orchestration during migration. It
combines browser decoding with engine analysis and legacy host map composition.
