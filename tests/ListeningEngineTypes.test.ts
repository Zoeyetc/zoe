import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  MelodyNote,
  MelodySource,
  ScaleDegree,
  ScaleDegreeEvidence,
  TonalCenterSegment,
  TonalMode,
} from '@computational-listening/engine';

test('engine public API exposes the minimal generic listening contract closure', () => {
  const source: MelodySource = 'predominant-analysis';
  const degree: ScaleDegree = 3;
  const mode: TonalMode = 'major';
  const note: MelodyNote = {
    id: 'note-c4', start: 0, end: 1, midi: 60, pitchHz: 261.6255653005986,
    noteName: 'C4', intensity: 0.8, confidence: 0.9, source,
  };
  const segment: TonalCenterSegment = {
    id: 'tonal-c', start: 0, end: 8, rootPitchClass: 0, mode, label: 'C major',
    confidence: 0.9, circleOfFifthsIndex: 0, distanceFromPrevious: null,
  };
  const evidence: ScaleDegreeEvidence = {
    available: true, inScale: true, degree, displayDegree: '3', tonicPitchClass: 0,
    mode, absoluteMidi: 64, absoluteNoteName: 'E4', relativeSemitones: 4,
    referenceTonicMidi: 60, octaveRelation: 0, chromaticOffset: null, confidence: 0.9,
  };

  assert.deepEqual(
    { source: note.source, degree: evidence.degree, mode: segment.mode },
    { source: 'predominant-analysis', degree: 3, mode: 'major' },
  );
});
