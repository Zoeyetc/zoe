import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreviewAudioClock } from '../src/audio/AudioClock.ts';

test('AudioClock owns deterministic play, pause, seek, restart, and end state', () => {
  let now = 0;
  const clock = createPreviewAudioClock(12, () => now);

  clock.play();
  now = 2.25;
  assert.deepEqual(clock.read(), { time: 2.25, duration: 12, playing: true });

  clock.pause();
  now = 7;
  assert.deepEqual(clock.read(), { time: 2.25, duration: 12, playing: false });

  clock.seek(8);
  clock.play();
  now = 8;
  assert.deepEqual(clock.read(), { time: 9, duration: 12, playing: true });

  clock.restart();
  assert.deepEqual(clock.read(), { time: 0, duration: 12, playing: true });

  now = 25;
  assert.deepEqual(clock.read(), { time: 12, duration: 12, playing: false });
});
