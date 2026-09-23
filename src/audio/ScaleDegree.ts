import type { MelodyNote, ScaleDegree, ScaleDegreeEvidence, TonalCenterSegment, TonalMode } from './types';

export const TONAL_CONFIDENCE_THRESHOLD = 0.55;
const MELODY_CONFIDENCE_THRESHOLD = 0.45;
const SCALE_INTERVALS: Readonly<Record<TonalMode, readonly number[]>> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};
const DEGREE_LABELS: Readonly<Record<TonalMode, readonly string[]>> = {
  major: ['1', '2', '3', '4', '5', '6', '7'],
  minor: ['1', '2', '♭3', '4', '5', '♭6', '♭7'],
};
const mod = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;

/** Stable per-song/segment lower-quartile tonic; never recomputed from the current note alone. */
export function selectReferenceTonicMidi(
  notes: readonly MelodyNote[], tonicPitchClass: number, segment?: Pick<TonalCenterSegment, 'start' | 'end'>,
): number | null {
  const reliable = notes.filter(note => (note.confidence ?? 1) >= MELODY_CONFIDENCE_THRESHOLD
    && (!segment || (note.end > segment.start && note.start < segment.end)))
    .map(note => note.midi).sort((a, b) => a - b);
  if (!reliable.length) return null;
  const lowerQuartile = reliable[Math.floor((reliable.length - 1) * 0.25)];
  return lowerQuartile - mod(lowerQuartile - tonicPitchClass, 12);
}

export function emptyScaleDegree(note: MelodyNote | null = null, noteName: string | null = null): ScaleDegreeEvidence {
  return { available: false, inScale: false, degree: null, displayDegree: null,
    tonicPitchClass: null, mode: null, absoluteMidi: note?.midi ?? null,
    absoluteNoteName: noteName ?? note?.noteName ?? null, relativeSemitones: null,
    referenceTonicMidi: null, octaveRelation: null, chromaticOffset: null, confidence: 0 };
}

export function deriveScaleDegreeEvidence(args: Readonly<{
  note: MelodyNote | null;
  noteName: string | null;
  melodyConfidence: number;
  tonalCenter: Pick<TonalCenterSegment, 'rootPitchClass' | 'mode' | 'confidence'> | null;
  referenceTonicMidi: number | null;
}>): ScaleDegreeEvidence {
  const { note, noteName, tonalCenter, referenceTonicMidi } = args;
  const base = emptyScaleDegree(note, noteName);
  if (!note || !tonalCenter || referenceTonicMidi === null) return base;
  const confidence = Math.min(1, Math.max(0, Math.min(args.melodyConfidence, tonalCenter.confidence)));
  const intervals = SCALE_INTERVALS[tonalCenter.mode];
  const relativeSemitones = note.midi - referenceTonicMidi;
  const pitchClassInterval = mod(note.midi - tonalCenter.rootPitchClass, 12);
  const intervalIndex = intervals.indexOf(pitchClassInterval);
  const inScale = intervalIndex >= 0;
  const octaveRelation = Math.floor(relativeSemitones / 12);
  const withinRepresentedOctave = relativeSemitones >= 0 && relativeSemitones <= 12;
  let degree: ScaleDegree | null = null;
  if (inScale && withinRepresentedOctave) {
    degree = relativeSemitones === 12 ? 8 : (intervalIndex + 1) as ScaleDegree;
  }
  let chromaticOffset: number | null = null;
  if (!inScale) {
    const lower = [...intervals].reverse().find(interval => interval < pitchClassInterval) ?? 0;
    chromaticOffset = pitchClassInterval - lower;
  }
  const confident = confidence >= TONAL_CONFIDENCE_THRESHOLD;
  return { available: confident && degree !== null, inScale, degree: confident ? degree : null,
    displayDegree: confident && degree !== null
      ? degree === 8 ? '8' : DEGREE_LABELS[tonalCenter.mode][degree - 1]
      : null,
    tonicPitchClass: tonalCenter.rootPitchClass, mode: tonalCenter.mode,
    absoluteMidi: note.midi, absoluteNoteName: noteName, relativeSemitones,
    referenceTonicMidi, octaveRelation, chromaticOffset, confidence };
}
