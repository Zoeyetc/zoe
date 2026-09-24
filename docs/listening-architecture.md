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
