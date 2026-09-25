import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeDualPathListening, analyzePcmListeningAsync, lookupBassSnapshot,
} from '@zoeyetc/computational-listening-engine';

const sampleRate = 8000;
const tone = new Float32Array(sampleRate * 2);
for (let index = 0; index < tone.length; index += 1) {
  tone[index] = .45 * Math.sin(2 * Math.PI * 110 * index / sampleRate);
}
const pcm = { sampleRate, channels: [tone] };

test('published dual-path analysis preserves the existing Melody map and returns independent Bass evidence', async () => {
  const previous = await analyzePcmListeningAsync(pcm);
  const dual = analyzeDualPathListening(pcm);

  assert.deepEqual(dual.listeningMap, previous);
  assert.ok(dual.bassEvidence.frames.length > 0);
  assert.equal(dual.bassEvidence.path.selectedCandidateIndexes.length, dual.bassEvidence.frames.length);
  const bass = lookupBassSnapshot(dual.bassEvidence, 1);
  assert.equal(bass.available, true);
  assert.ok(bass.pitchHz !== null && Math.abs(bass.pitchHz - 110) < 2);
  assert.equal(bass.reason, 'SELECTED');
  assert.equal(lookupBassSnapshot(dual.bassEvidence, -1).available, false);
});
