import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const player = read('../src/instrument-ui/signal-player/SignalPlayer.tsx');
const playback = read('../src/instrument-ui/signal-player/SignalPlayback.tsx');
const playerStyles = read('../src/instrument-ui/signal-player/signalPlayer.css');
const consoleComponent = read('../src/instrument-ui/signal-console/SignalConsole.tsx');
const consoleStyles = read('../src/instrument-ui/signal-console/signalConsole.css');
const app = read('../src/ZoeApp.tsx');

test('SignalPlayer composes playback and telemetry without URL routing', () => {
  assert.doesNotMatch(player, /window\.location|URLSearchParams/);
  assert.match(player, /<SignalPlayback/);
  assert.match(player, /<SignalConsole/);
});

test('standalone props use neutral audio, control, and signal boundaries', () => {
  assert.match(player, /type SignalPlayerProps = Readonly<\{/);
  assert.match(player, /SignalConsoleObservation/);
  assert.match(player, /AudioPreparationState/);
  assert.match(player, /InstrumentActions/);
});

test('SignalConsole and SignalPlayer load their own styles', () => {
  assert.match(consoleComponent, /import '\.\/signalConsole\.css'/);
  assert.match(player, /import '\.\/signalPlayer\.css'/);
  assert.ok(consoleStyles.length > 0 && playerStyles.length > 0);
});

test('validated DARK and PROPORTIONAL baseline has no study controls', () => {
  assert.doesNotMatch(player + consoleComponent, /VisualMode|NumericMode|FieldMode|Development visual mode|Development numeric mode|Development field mode/);
  assert.doesNotMatch(player, /data-signal-visual-mode|data-signal-field|SignalField/);
  assert.equal((player.match(/<SignalPlayback/g) ?? []).length, 1);
  assert.equal((player.match(/<SignalConsole/g) ?? []).length, 1);
  const baseline = playerStyles.match(/\.signal-player \{([^}]*)\}/)?.[1] ?? '';
  assert.match(baseline, /--signal-player-background: rgba\(13, 16, 14, \.95\)/);
  assert.match(baseline, /--signal-theme-console-signal: #a8cbb1/);
  assert.match(consoleStyles, /data-signal-role='signal'[^}]*proportional-nums/);
  assert.match(consoleStyles, /data-signal-role='anchor'[^}]*tabular-nums/);
  assert.match(consoleStyles, /data-typography='code'[^}]*font-family: var\(--signal-font-mono\)/s);
  assert.match(consoleStyles, /data-typography='musical'[^}]*font-family: var\(--signal-font-sans\)/s);
  assert.doesNotMatch(playerStyles + consoleStyles, /@keyframes|transition\s*:|animation\s*:|linear-gradient|radial-gradient|filter\s*:|backdrop-filter|text-shadow|box-shadow/);
});

test('rejected visual experiments are absent from the standalone product path', () => {
  const standalone = player + playerStyles + consoleComponent + consoleStyles;
  assert.doesNotMatch(standalone, /signal-field|signalField|WebGL|webgl|shader|luminance|evidence-opacity|<canvas/);
  assert.doesNotMatch(standalone, /signal-visual-mode|signal-number-mode|value=["']light|value=["']tabular|Development (?:visual|numeric) mode/i);
});

test('SignalPlayback keeps one injected transport path and neutral presentation', () => {
  assert.match(playback, /actions\.play/);
  assert.match(playback, /actions\.pause/);
  assert.match(playback, /actions\.restart/);
  assert.match(playback, /actions\.seek/);
  assert.doesNotMatch(playback, /createPreviewAudioClock|createAudioBufferPlaybackTransport|setInterval|requestAnimationFrame/);
});

test('performance playback keeps semantic controls inside one compact command surface', () => {
  assert.match(player, /compact=\{composition === 'performance'\}/);
  assert.match(playback, /signal-playback--compact/);
  assert.match(playback, /audio\.load\(/);
  assert.match(playback, /type="file"/);
  assert.match(playback, /aria-label=\{`Load audio file; current source/);
  for (const action of ['\[PLAY\]', '\[PAUSE\]', '\[RESTART\]']) assert.match(playback, new RegExp(action));
  assert.match(playback, /aria-label="Playback controls"/);
  assert.match(playback, /signal-sr-only.*role="status"/s);
});

test('performance progress derives from injected transport and preserves native keyboard seeking', () => {
  assert.match(playback, /transport\.time \/ transport\.duration/);
  assert.match(playback, /inlineSize: `\$\{progress \* 100\}%`/);
  assert.match(playback, /insetInlineStart: `\$\{progress \* 100\}%`/);
  assert.match(playback, /type="range"/);
  assert.match(playback, /onChange=\{event => actions\.seek\(Number\(event\.target\.value\)\)\}/);
  assert.doesNotMatch(playback, /setInterval|requestAnimationFrame|waveform/i);
});

test('performance transport states and structural focus cues use the shared fluorescent family', () => {
  for (const state of ['playing', 'paused', 'ended']) assert.match(playerStyles, new RegExp(`data-transport-state='${state}'`));
  assert.match(playerStyles, /--performance-active: #62f296/);
  assert.match(playerStyles, /--performance-active-strong: #91ffb8/);
  assert.match(playerStyles, /:focus-visible/);
  assert.match(playerStyles, /text-decoration: underline/);
  assert.match(playerStyles, /outline: 1px solid var\(--performance-active\)/);
  assert.doesNotMatch(playerStyles, /transition\s*:|animation\s*:|@keyframes/);
});

test('Zoë owns the standalone SignalPlayer composition without unrelated runtime imports', () => {
  assert.match(app, /<SignalPlayer/);
  assert.match(app, /createListeningTimeline/);
  assert.match(app, /createLiveAudioInputController/);
  assert.match(app, /analyzePcmListeningAsync/);
});
