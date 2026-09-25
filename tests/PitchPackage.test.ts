import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hzToMidi as packageHzToMidi,
  midiToNoteName as packageMidiToNoteName,
} from '../src/listening-engine/index.ts';
test('engine pitch API preserves exact representative frequency, MIDI, and note-name behavior', () => {
  assert.equal(packageHzToMidi(440), 69);
  assert.equal(packageHzToMidi(261.6255653005986), 60);
  assert.equal(packageMidiToNoteName(69), 'A4');
  assert.equal(packageMidiToNoteName(60), 'C4');
  assert.equal(packageMidiToNoteName(-1), 'B-2');
});

test('engine pitch API remains deterministic across its supported range', () => {
  for (const frequency of [55, 261.6255653005986, 440, 880]) {
    assert.equal(packageHzToMidi(frequency), 69 + 12 * Math.log2(frequency / 440));
  }

  assert.deepEqual([-1, 0, 60, 61, 69, 127].map(packageMidiToNoteName),
    ['B-2', 'C-1', 'C4', 'C#4', 'A4', 'G9']);
});
