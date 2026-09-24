import assert from 'node:assert/strict';
import test from 'node:test';
import type { ListeningMap } from '@computational-listening/engine';
import {
  analyzePcmAudio,
  analyzePcmListening,
  type PcmAudio,
} from '../src/audio/analysis/AudioAnalysis.ts';
import { composeLegacyAudioMap } from '../src/audio/composeLegacyAudioMap.ts';
import type { ZlandAuthoredOverlay } from '../src/audio/types.ts';

const pcm: PcmAudio = {
  sampleRate: 12_000,
  channels: [Float32Array.from({ length: 12_000 }, (_, index) =>
    0.18 * Math.sin(2 * Math.PI * 220 * index / 12_000))],
};
const source = { id: 'contract', filename: 'contract.wav', mimeType: 'audio/wav' };

test('ListeningMap contains analyzed truth without host, source, or Z.land authored fields', () => {
  const listening: ListeningMap = analyzePcmListening(pcm);

  for (const excluded of ['id', 'source', 'structure', 'drops', 'deviceId', 'deviceLabel']) {
    assert.equal(excluded in listening, false, `${excluded} must stay outside ListeningMap`);
  }
  assert.equal(listening.duration, 1);
  assert.equal(listening.analysis?.sampleRate, 12_000);
  assert.equal(typeof listening.capabilities.melody, 'boolean');
  assert.equal('permission' in listening.capabilities, false);
  assert.equal('warmup' in listening.capabilities, false);

  for (const segment of listening.structureAnalysis?.segments ?? []) {
    assert.equal('tension' in segment, false);
    assert.equal('build' in segment, false);
    assert.equal('phraseProgress' in segment, false);
  }
});

test('legacy AudioMap is composition over one ListeningMap without copied analysis values', () => {
  const listening = analyzePcmListening(pcm);
  const authored: ZlandAuthoredOverlay = { structure: null, drops: null };
  const composed = composeLegacyAudioMap(listening, {
    id: 'real-audio-contract',
    source: { kind: 'real-audio', filename: source.filename, mimeType: source.mimeType },
  }, authored);
  const compatibility = analyzePcmAudio(pcm, source);

  assert.deepEqual(composed, compatibility);
  assert.equal(composed.melody, listening.melody);
  assert.equal(composed.melodyAnalysis, listening.melodyAnalysis);
  assert.equal(composed.structureAnalysis, listening.structureAnalysis);
  assert.equal(composed.spectrum, listening.spectrum);
  assert.equal(composed.structure, authored.structure);
  assert.equal(composed.drops, authored.drops);
});

test('Z.land authored structure remains an explicit overlay outside ListeningMap', () => {
  const listening = analyzePcmListening(pcm);
  const authored: ZlandAuthoredOverlay = {
    structure: [{ id: 'build', start: 0, end: 1, section: 'build', energy: [0, 1],
      tension: [0, 1], build: [0, 1], phraseProgress: [0, 1] }],
    drops: [{ id: 'drop', time: 0.8, strength: 1 }],
  };
  const composed = composeLegacyAudioMap(listening, { id: 'authored-contract' }, authored);

  assert.equal('structure' in listening, false);
  assert.equal(composed.structure, authored.structure);
  assert.equal(composed.drops, authored.drops);
  assert.equal(composed.structure?.[0]?.tension[1], 1);
});
