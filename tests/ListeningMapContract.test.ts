import assert from 'node:assert/strict';
import test from 'node:test';
import type { ListeningMap } from '../src/listening-engine/index.ts';
import {
  analyzePcmListening,
  type PcmAudio,
} from '../src/listening-engine/index.ts';

const pcm: PcmAudio = {
  sampleRate: 12_000,
  channels: [Float32Array.from({ length: 12_000 }, (_, index) =>
    0.18 * Math.sin(2 * Math.PI * 220 * index / 12_000))],
};
const source = { id: 'contract', filename: 'contract.wav', mimeType: 'audio/wav' };
