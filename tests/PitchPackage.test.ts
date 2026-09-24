import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hzToMidi as packageHzToMidi,
  midiToNoteName as packageMidiToNoteName,
} from '@computational-listening/engine';
import {
  hzToMidi as compatibilityHzToMidi,
  midiToNoteName as compatibilityMidiToNoteName,
} from '../src/audio/pitch.ts';

test('engine pitch API preserves exact representative frequency, MIDI, and note-name behavior', () => {
  assert.equal(packageHzToMidi(440), 69);
  assert.equal(packageHzToMidi(261.6255653005986), 60);
  assert.equal(packageMidiToNoteName(69), 'A4');
  assert.equal(packageMidiToNoteName(60), 'C4');
  assert.equal(packageMidiToNoteName(-1), 'B-2');
});

test('legacy pitch path is an exact compatibility re-export of the engine API', () => {
  for (const frequency of [55, 261.6255653005986, 440, 880]) {
    assert.equal(compatibilityHzToMidi(frequency), packageHzToMidi(frequency));
  }

  for (const midi of [-1, 0, 60, 61, 69, 127]) {
    assert.equal(compatibilityMidiToNoteName(midi), packageMidiToNoteName(midi));
  }
});
