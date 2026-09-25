# Zoë

Computational Listening Instrument

Zoë listens to local audio files or a browser-authorized live input and presents
retained listening evidence, accepted interpretation, and events in a single
performance surface. Analysis and the browser's audio source remain separate:
the source owns capture and playback; the listening engine derives evidence; the
instrument UI displays it. The browser transport is the authoritative clock.

## Features

- Local file loading with play, pause, seek, restart, and end-state handling.
- Authorized live input with device selection, rolling analysis, and explicit
  source states.
- Observed pitch, melody, harmony, rhythm, percussion, tonal center, structure,
  diagnostics, and recent events, with capability gates kept distinct from
  pre-gate evidence.
- Single-viewport performance layout and native fullscreen control.

## Architecture

- `src/ZoeApp.tsx`: product composition and source switching.
- `@zoeyetc/computational-listening-engine`: independently versioned analysis, retained
  listening results, generic timelines, and diagnostics.
- `src/audio-source-browser/`: file decoding, playback, live capture, browser
  clocks, and bounded rolling input.
- `src/instrument-ui/`: SignalPlayer and SignalConsole presentation.

## Development

Requires Node.js 22.12+ and npm.

```sh
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run preview
```

## Deployment

Vercel can import this repository as a Vite project using the repository root
(`/`), `npm run build`, and `dist`. No root-directory override is needed.
The browser requests microphone access only when the user starts live input;
hosting must use HTTPS for live capture.

Run `npm install` to install Zoë's dependencies, including the published `@zoeyetc/computational-listening-engine` package from npm. No adjacent Engine checkout is required.
