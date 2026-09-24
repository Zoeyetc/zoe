# Computational Listening workspace boundary

This repository contains two independent applications and three explicitly
owned shared packages. The repository root is a workspace orchestrator; it has
no production application entry or `src/` tree.

## Products

### Zoë

`apps/zoe` owns the standalone computational listening instrument, file and
live source selection, session orchestration, product metadata, and UI mounting.
It consumes only:

- `@computational-listening/engine`
- `@computational-listening/audio-source-browser`
- `@computational-listening/instrument-ui`

Zoë consumes `ListeningTimeline` directly. It has no Z.land, ride, physics,
authored-overlay, `AudioWorld`, or `createExperience` dependency.

### Z.land

`apps/zland` owns its complete product runtime: application bootstrap, rides,
physics, free bodies, controls, debugging, Park presentation, annotations,
authored musical overlays, and experience composition.

Z.land's `AudioWorld` is an application-local facade over the engine-owned
`ListeningTimeline` and the Z.land-owned `ZlandListeningAdapter`. The facade is
kept because it provides one useful ride-facing snapshot/event boundary; it is
not shared with Zoë or any package.

`ZlandAudioMap` is the explicit product composition:

```text
ListeningMap
+ AudioMapHostMetadata
+ ZlandAuthoredOverlay
= ZlandAudioMap
```

Generic analysis truth remains unchanged inside `ListeningMap`. Authored build,
tension, phrase progress, and drops exist only under `apps/zland`.

## Shared packages

- **Listening Engine** owns PCM analysis, retained evidence, generic musical
  contracts, `ListeningMap`, `ListeningTimeline`, snapshots, events, streaming
  analysis, and explicit diagnostics APIs. It has no browser or product code.
- **Audio Source Browser** owns browser decoding and playback, Web Audio clocks,
  live capture, permission and device lifecycle, AudioWorklet capture, and
  browser source metadata. It may consume the engine but no UI or application.
- **Instrument UI** owns SignalConsole, ListeningField, SignalPlayer,
  SignalPlayback, Temporal Cognition, performance composition, and their styles.
  It consumes generic engine/source contracts and has no product dependency.

## Dependency direction

```text
listening-engine
       ↑
       ├── audio-source-browser
       │          ↑
       │          └── Zoë
       ├── instrument-ui ──┘
       └── Z.land
```

Products never import one another. Shared packages never import applications.
All production implementations have a single owner; no migration re-export or
legacy root application path remains.
