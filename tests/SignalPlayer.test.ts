import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const player = read('../src/signal-player/SignalPlayer.tsx');
const playback = read('../src/signal-player/SignalPlayback.tsx');
const playerStyles = read('../src/signal-player/signalPlayer.css');
const consoleComponent = read('../src/signal-console/SignalConsole.tsx');
const consoleTelemetry = read('../src/signal-console/signalTelemetry.ts');
const consoleTypes = read('../src/signal-console/types.ts');
const consoleStyles = read('../src/signal-console/signalConsole.css');
const experienceStyles = read('../src/experience/styles.css');
const app = read('../src/experience/App.tsx');

test('SignalPlayer is importable without Experience, navigation, actors, or shared physics', () => {
  const standalone = player + playback + consoleComponent + consoleTelemetry + consoleTypes;
  assert.doesNotMatch(standalone, /\.\.\/experience|ParkMap|Development Workbench|experience-header|Attention|\.\.\/rides|PhysicsWorld|\.\.\/physics/);
  assert.doesNotMatch(player, /window\.location|URLSearchParams|resolveExperienceMode|Z\.land Music Box/);
  assert.match(player, /<SignalPlayback/);
  assert.match(player, /<SignalConsole/);
});

test('standalone props use neutral audio, control, and signal boundaries', () => {
  assert.match(player, /type SignalPlayerProps = Readonly<\{/);
  assert.match(player, /SignalConsoleObservation/);
  assert.match(player, /AudioPreparationState/);
  assert.match(player, /ControlActions/);
  assert.doesNotMatch(player, /ExperienceState|ReturnType<.*createExperience|from ['"].*experience/);
});

test('SignalConsole and SignalPlayer own their styles without Experience CSS', () => {
  assert.match(consoleComponent, /import '\.\/signalConsole\.css'/);
  assert.match(player, /import '\.\/signalPlayer\.css'/);
  assert.ok(consoleStyles.length > 0 && playerStyles.length > 0);
  assert.doesNotMatch(consoleStyles + playerStyles, /experience\/styles|--z-/);
  assert.doesNotMatch(experienceStyles, /\.signal-console|\.signal-stream|\.signal-telemetry|\.signal-phrase|\.signal-token|\.signal-capabilities|\.signal-player|\.signal-playback/);
});

test('SignalPlayback keeps one injected transport path and neutral presentation', () => {
  assert.match(playback, /actions\.play/);
  assert.match(playback, /actions\.pause/);
  assert.match(playback, /actions\.restart/);
  assert.match(playback, /actions\.seek/);
  assert.doesNotMatch(playback, /createPreviewAudioClock|createAudioBufferPlaybackTransport|createAudioWorld|setInterval|requestAnimationFrame/);
  assert.doesNotMatch(playback, /Carousel|FerrisWheel|PirateShip|BumperCars|DropTower|RollerCoaster|Park/);
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

test('Experience host routes SignalConsole mode directly to standalone SignalPlayer', () => {
  const branch = app.indexOf("if (mode === 'signal-console') return <SignalPlayer");
  const shell = app.indexOf('<header className="experience-header">');
  assert.ok(branch >= 0 && branch < shell);
  assert.match(app, /observe=\{experience\.observeSignalConsole\}/);
  assert.match(app, /onChooseAudio=\{chooseAudio\}/);
  assert.match(app, /onUseFixture=\{useFixture\}/);
  assert.match(app, /signalCompositionQuery === 'performance'/);
  assert.equal((app.match(/<ControlSurface/g) ?? []).length, 1);
});
