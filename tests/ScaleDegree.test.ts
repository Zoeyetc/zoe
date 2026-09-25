import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveScaleDegreeEvidence, selectReferenceTonicMidi, TONAL_CONFIDENCE_THRESHOLD } from '../src/listening-engine/index.ts';
import type { MelodyNote, TonalCenterAnalysis, TonalCenterSegment, TonalMode } from '../src/listening-engine/index.ts';

const note = (midi: number, confidence = 0.9): MelodyNote => ({ id: `n-${midi}`, start: 0, end: 8, midi, intensity: 0.8, confidence });
const tonal = (rootPitchClass: number, mode: TonalMode, confidence = 0.9) => ({ rootPitchClass, mode, confidence });
const derive = (midi: number, root: number, mode: TonalMode, reference: number, confidence = 0.9) =>
  deriveScaleDegreeEvidence({ note: note(midi, confidence), noteName: `m${midi}`, melodyConfidence: confidence,
    tonalCenter: tonal(root, mode, confidence), referenceTonicMidi: reference });

for (const [label, root, reference, cases] of [
  ['C major', 0, 60, [[60, 1], [62, 2], [64, 3], [65, 4], [67, 5], [69, 6], [71, 7], [72, 8]]],
  ['G major', 7, 67, [[67, 1], [71, 3], [74, 5], [79, 8]]],
  ['F major', 5, 65, [[65, 1], [69, 3], [72, 5], [77, 8]]],
] as const) {
  test(`${label} maps absolute notes to stable degree carriers`, () => {
    for (const [midi, degree] of cases) assert.equal(derive(midi, root, 'major', reference).degree, degree);
  });
}

test('natural minor preserves flat-degree display semantics', () => {
  const aMinor = [[69, 1, '1'], [71, 2, '2'], [72, 3, '♭3'], [74, 4, '4'], [76, 5, '5'], [77, 6, '♭6'], [79, 7, '♭7'], [81, 8, '8']] as const;
  for (const [midi, degree, display] of aMinor) {
    const evidence = derive(midi, 9, 'minor', 69);
    assert.equal(evidence.degree, degree); assert.equal(evidence.displayDegree, display);
  }
  assert.equal(derive(64, 4, 'minor', 64).degree, 1);
  assert.equal(derive(67, 4, 'minor', 64).displayDegree, '♭3');
  assert.equal(derive(71, 4, 'minor', 64).degree, 5);
  assert.equal(derive(76, 4, 'minor', 64).degree, 8);
});

test('chromatic notes preserve absolute truth without nearest-degree fabrication', () => {
  for (const [midi, root, mode, reference] of [[66, 0, 'major', 60], [70, 0, 'major', 60], [78, 9, 'minor', 69]] as const) {
    const evidence = derive(midi, root, mode, reference);
    assert.equal(evidence.inScale, false); assert.equal(evidence.degree, null);
    assert.equal(evidence.available, false); assert.equal(evidence.absoluteMidi, midi);
    assert.ok(evidence.chromaticOffset !== null && evidence.chromaticOffset > 0);
  }
});

test('reference tonic is stable and resolves carrier 1 versus octave tonic deterministically', () => {
  const notes = [60, 62, 64, 67, 71, 72].map(note);
  assert.equal(selectReferenceTonicMidi(notes, 0), 60);
  assert.equal(derive(48, 0, 'major', 60).degree, null);
  assert.equal(derive(60, 0, 'major', 60).degree, 1);
  assert.equal(derive(72, 0, 'major', 60).degree, 8);
  assert.equal(derive(84, 0, 'major', 60).degree, null);
  assert.deepEqual([48, 60, 72, 84].map(midi => derive(midi, 0, 'major', 60).octaveRelation), [-1, 0, 1, 2]);
});

test('degree confidence is gated and cannot exceed either source', () => {
  const lowTonal = deriveScaleDegreeEvidence({ note: note(64, 0.95), noteName: 'E4', melodyConfidence: 0.95,
    tonalCenter: tonal(0, 'major', TONAL_CONFIDENCE_THRESHOLD - 0.01), referenceTonicMidi: 60 });
  assert.equal(lowTonal.available, false); assert.equal(lowTonal.degree, null);
  assert.equal(lowTonal.confidence, TONAL_CONFIDENCE_THRESHOLD - 0.01);
  const valid = deriveScaleDegreeEvidence({ note: note(64, 0.7), noteName: 'E4', melodyConfidence: 0.7,
    tonalCenter: tonal(0, 'major', 0.9), referenceTonicMidi: 60 });
  assert.equal(valid.available, true); assert.equal(valid.confidence, 0.7);
});
