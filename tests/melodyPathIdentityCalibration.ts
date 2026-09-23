import type { MelodyEvidenceObservation, MelodyEvidenceTimeline } from '../src/audio/melody-evidence/types.ts';
import { selectMelodyEvidence } from '../src/audio/melody-evidence/selectMelodyEvidence.ts';
import { MELODY_ANALYSIS } from '../src/audio/analysis/MelodyAnalysis.ts';

export const CALIBRATION_SAMPLE_RATE = 12_000;
export const MELODY_AMPLITUDE = 0.42;
export const BASS_AMPLITUDE = 0.36;
export const BASS_AMPLITUDE_MATRIX = Object.freeze([0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.36, 0.42] as const);
export const TRANSITION_MARGIN_SECONDS = 0.20;
export const IDENTITY_TOLERANCE_CENTS = 50;

export type GroundTruthMelodySegment = Readonly<{
  startSec: number;
  endSec: number;
  frequencyHz: number;
  midi: number;
  label: string;
}>;

export type GroundTruthBassSegment = Readonly<{
  startSec: number;
  endSec: number;
  frequencyHz: number;
  label: string;
}>;

export const GROUND_TRUTH_MELODY: readonly GroundTruthMelodySegment[] = Object.freeze([
  { startSec: 0, endSec: 2, frequencyHz: 440, midi: 69, label: 'A4' },
  { startSec: 2, endSec: 4, frequencyHz: 523.25, midi: 72, label: 'C5' },
  { startSec: 4, endSec: 6, frequencyHz: 659.25, midi: 76, label: 'E5' },
  { startSec: 6, endSec: 8, frequencyHz: 587.33, midi: 74, label: 'D5' },
  { startSec: 8, endSec: 10, frequencyHz: 440, midi: 69, label: 'A4' },
]);

export const GROUND_TRUTH_BASS: readonly GroundTruthBassSegment[] = Object.freeze([
  { startSec: 0, endSec: 2.5, frequencyHz: 110, label: 'A2' },
  { startSec: 2.5, endSec: 5, frequencyHz: 87.31, label: 'F2' },
  { startSec: 5, endSec: 7.5, frequencyHz: 130.81, label: 'C3' },
  { startSec: 7.5, endSec: 10, frequencyHz: 98, label: 'G2' },
]);

/** Original bass shifted upward by approximately 70 cents, rounded to 0.01 Hz before measurement. */
export const NON_OCTAVE_CONTROL_BASS: readonly GroundTruthBassSegment[] = Object.freeze([
  { startSec: 0, endSec: 2.5, frequencyHz: 114.54, label: 'A2+70c' },
  { startSec: 2.5, endSec: 5, frequencyHz: 90.91, label: 'F2+70c' },
  { startSec: 5, endSec: 7.5, frequencyHz: 136.20, label: 'C3+70c' },
  { startSec: 7.5, endSec: 10, frequencyHz: 102.04, label: 'G2+70c' },
]);

export type CalibrationCondition = 'MELODY_ONLY' | 'MELODY_PLUS_BASS';

export type MelodyBassRelationship = Readonly<{
  startSec: number;
  endSec: number;
  melodyLabel: string;
  melodyHz: number;
  bassLabel: string;
  bassHz: number;
  ratio: number;
}>;

export function melodyBassRelationships(bassTimeline: readonly GroundTruthBassSegment[]) {
  return Object.freeze(GROUND_TRUTH_MELODY.flatMap(melody => bassTimeline.flatMap(bass => {
    const startSec = Math.max(melody.startSec, bass.startSec);
    const endSec = Math.min(melody.endSec, bass.endSec);
    return endSec > startSec ? [Object.freeze({
      startSec,
      endSec,
      melodyLabel: melody.label,
      melodyHz: melody.frequencyHz,
      bassLabel: bass.label,
      bassHz: bass.frequencyHz,
      ratio: melody.frequencyHz / bass.frequencyHz,
    })] : [];
  }))) satisfies readonly MelodyBassRelationship[];
}

const edgeEnvelope = (timeInSegment: number, duration: number) => {
  const attackReleaseSeconds = 0.02;
  return Math.min(1, timeInSegment / attackReleaseSeconds,
    (duration - timeInSegment) / attackReleaseSeconds);
};

function toneAt(time: number, segment: Readonly<{ startSec: number; endSec: number; frequencyHz: number }>,
  amplitude: number) {
  if (time < segment.startSec || time >= segment.endSec) return 0;
  const localTime = time - segment.startSec;
  const envelope = edgeEnvelope(localTime, segment.endSec - segment.startSec);
  return amplitude * envelope * Math.sin(2 * Math.PI * segment.frequencyHz * localTime);
}

/** Pure deterministic synthesis; no analyzer output participates in the fixture. */
export function createMelodyPathCalibrationStimulus(condition: CalibrationCondition) {
  return createMelodyCompetitionStimulus(condition === 'MELODY_ONLY' ? 0 : BASS_AMPLITUDE,
    GROUND_TRUTH_BASS);
}

export function createMelodyCompetitionStimulus(bassAmplitude: number,
  bassTimeline: readonly GroundTruthBassSegment[] = GROUND_TRUTH_BASS) {
  const duration = GROUND_TRUTH_MELODY.at(-1)!.endSec;
  return Float32Array.from({ length: duration * CALIBRATION_SAMPLE_RATE }, (_, index) => {
    const time = index / CALIBRATION_SAMPLE_RATE;
    const melody = GROUND_TRUTH_MELODY.reduce((sum, segment) =>
      sum + toneAt(time, segment, MELODY_AMPLITUDE), 0);
    return melody + bassTimeline.reduce((sum, segment) =>
      sum + toneAt(time, segment, bassAmplitude), 0);
  });
}

/** Exact bass timeline and synthesis used by the competition fixture, without the melody source. */
export function createBassOnlyCompetitionStimulus(bassAmplitude: number,
  bassTimeline: readonly GroundTruthBassSegment[] = GROUND_TRUTH_BASS) {
  const duration = GROUND_TRUTH_MELODY.at(-1)!.endSec;
  return Float32Array.from({ length: duration * CALIBRATION_SAMPLE_RATE }, (_, index) => {
    const time = index / CALIBRATION_SAMPLE_RATE;
    return bassTimeline.reduce((sum, segment) => sum + toneAt(time, segment, bassAmplitude), 0);
  });
}

export const centsDistance = (actualHz: number, expectedHz: number) =>
  1200 * Math.log2(actualHz / expectedHz);

export const matchesPitchIdentity = (actualHz: number | null, expectedHz: number) => actualHz !== null
  && Number.isFinite(actualHz)
  && Math.abs(centsDistance(actualHz, expectedHz)) <= IDENTITY_TOLERANCE_CENTS;

export type WrongPathClass = 'MELODY_OCTAVE_DOWN' | 'MELODY_OCTAVE_UP' | 'BASS_MATCH' | 'OTHER_PITCH';

export function classifyWrongPath(selectedHz: number, melodyHz: number, bassHz: number | null): WrongPathClass {
  // Precedence is fixed before measurement: melody octave relation, contemporaneous bass, then other.
  for (let octave = 1; octave <= 3; octave += 1) {
    if (matchesPitchIdentity(selectedHz, melodyHz / 2 ** octave)) return 'MELODY_OCTAVE_DOWN';
    if (matchesPitchIdentity(selectedHz, melodyHz * 2 ** octave)) return 'MELODY_OCTAVE_UP';
  }
  if (bassHz !== null && matchesPitchIdentity(selectedHz, bassHz)) return 'BASS_MATCH';
  return 'OTHER_PITCH';
}

type MutableMetrics = {
  frames: number;
  candidateMatches: number;
  pathMatches: number;
  correctPathAccepted: number;
  nullPaths: number;
  wrongSelectedPaths: number;
  wrongPathWithMelodyCandidate: number;
  wrongPaths: Record<WrongPathClass, number>;
};

export type CalibrationMetrics = Readonly<MutableMetrics & {
  candidateRecall: number;
  pathIdentityAccuracy: number;
  conditionalPathIdentity: number | null;
  melodyMatchAcceptedRate: number | null;
}>;

export type SegmentCalibrationResult = Readonly<{
  segmentIndex: number;
  label: string;
  startSec: number;
  endSec: number;
  metrics: CalibrationMetrics;
}>;

export type MelodyPathCharacterization = Readonly<{
  condition: string;
  metrics: CalibrationMetrics;
  segments: readonly SegmentCalibrationResult[];
}>;

const emptyMetrics = (): MutableMetrics => ({
  frames: 0,
  candidateMatches: 0,
  pathMatches: 0,
  correctPathAccepted: 0,
  nullPaths: 0,
  wrongSelectedPaths: 0,
  wrongPathWithMelodyCandidate: 0,
  wrongPaths: { MELODY_OCTAVE_DOWN: 0, MELODY_OCTAVE_UP: 0, BASS_MATCH: 0, OTHER_PITCH: 0 },
});

const divide = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : null;
const divideRequired = (numerator: number, denominator: number) => denominator > 0 ? numerator / denominator : 0;

const finalizeMetrics = (metrics: MutableMetrics): CalibrationMetrics => Object.freeze({
  ...metrics,
  wrongPaths: Object.freeze({ ...metrics.wrongPaths }),
  candidateRecall: divideRequired(metrics.candidateMatches, metrics.frames),
  pathIdentityAccuracy: divideRequired(metrics.pathMatches, metrics.frames),
  conditionalPathIdentity: divide(metrics.pathMatches, metrics.candidateMatches),
  melodyMatchAcceptedRate: divide(metrics.correctPathAccepted, metrics.pathMatches),
});

function bassAt(time: number, bassTimeline: readonly GroundTruthBassSegment[]) {
  return bassTimeline.find(segment => time >= segment.startSec && time < segment.endSec) ?? null;
}

function record(metrics: MutableMetrics, observation: MelodyEvidenceObservation,
  melody: GroundTruthMelodySegment, bassTimeline: readonly GroundTruthBassSegment[]) {
  metrics.frames += 1;
  const candidateMatch = observation.candidates.some(candidate =>
    matchesPitchIdentity(candidate.pitchHz, melody.frequencyHz));
  if (candidateMatch) metrics.candidateMatches += 1;
  if (matchesPitchIdentity(observation.selectedPitchHz, melody.frequencyHz)) {
    metrics.pathMatches += 1;
    if (observation.voiced) metrics.correctPathAccepted += 1;
    return;
  }
  if (observation.selectedPitchHz === null) {
    metrics.nullPaths += 1;
    return;
  }
  metrics.wrongSelectedPaths += 1;
  if (candidateMatch) metrics.wrongPathWithMelodyCandidate += 1;
  const bass = bassAt(observation.time, bassTimeline);
  metrics.wrongPaths[classifyWrongPath(observation.selectedPitchHz, melody.frequencyHz,
    bass?.frequencyHz ?? null)] += 1;
}

/** Evaluates only stable interiors: both ends of every segment exclude the fixed transition margin. */
export function characterizeMelodyPath(condition: string, timeline: MelodyEvidenceTimeline,
  bassTimeline: readonly GroundTruthBassSegment[] = GROUND_TRUTH_BASS) {
  const aggregate = emptyMetrics();
  const segmentMetrics = GROUND_TRUTH_MELODY.map(() => emptyMetrics());
  const hopSeconds = MELODY_ANALYSIS.hopSize / MELODY_ANALYSIS.analysisSampleRate;
  const frameCenterOffset = MELODY_ANALYSIS.frameSize / 2 / MELODY_ANALYSIS.analysisSampleRate;

  for (let frameIndex = 0; frameIndex < timeline.frameCount; frameIndex += 1) {
    const requestedTime = frameIndex * hopSeconds + frameCenterOffset + hopSeconds / 4;
    const observation = selectMelodyEvidence(timeline, requestedTime);
    if (!observation) continue;
    const segmentIndex = GROUND_TRUTH_MELODY.findIndex(segment =>
      observation.time >= segment.startSec + TRANSITION_MARGIN_SECONDS
      && observation.time <= segment.endSec - TRANSITION_MARGIN_SECONDS);
    if (segmentIndex < 0) continue;
    const melody = GROUND_TRUTH_MELODY[segmentIndex];
    record(aggregate, observation, melody, bassTimeline);
    record(segmentMetrics[segmentIndex], observation, melody, bassTimeline);
  }

  return Object.freeze({
    condition,
    metrics: finalizeMetrics(aggregate),
    segments: Object.freeze(GROUND_TRUTH_MELODY.map((segment, segmentIndex) => Object.freeze({
      segmentIndex,
      label: segment.label,
      startSec: segment.startSec,
      endSec: segment.endSec,
      metrics: finalizeMetrics(segmentMetrics[segmentIndex]),
    }))),
  }) satisfies MelodyPathCharacterization;
}

export function formatMelodyPathCharacterization(result: MelodyPathCharacterization) {
  const percent = (value: number | null) => value === null ? 'N/A' : `${(value * 100).toFixed(1)}%`;
  const metricLines = (metrics: CalibrationMetrics) => [
    `frames                     ${metrics.frames}`,
    `candidate recall           ${percent(metrics.candidateRecall)}`,
    `path identity              ${percent(metrics.pathIdentityAccuracy)}`,
    `path | candidate exists    ${percent(metrics.conditionalPathIdentity)}`,
    `correct path accepted      ${percent(metrics.melodyMatchAcceptedRate)}`,
    `wrong path, melody present ${metrics.wrongPathWithMelodyCandidate}`,
    `null path                  ${metrics.nullPaths}`,
  ];
  const wrongDenominator = result.metrics.wrongSelectedPaths;
  const wrongPercent = (value: number) => percent(divide(value, wrongDenominator));
  return [result.condition.replaceAll('_', ' '), '', ...metricLines(result.metrics), '',
    'wrong selected paths:',
    `octave down                ${wrongPercent(result.metrics.wrongPaths.MELODY_OCTAVE_DOWN)}`,
    `octave up                  ${wrongPercent(result.metrics.wrongPaths.MELODY_OCTAVE_UP)}`,
    `bass                       ${wrongPercent(result.metrics.wrongPaths.BASS_MATCH)}`,
    `other                      ${wrongPercent(result.metrics.wrongPaths.OTHER_PITCH)}`,
    '', 'per segment:',
    ...result.segments.flatMap(segment => [
      `${segment.label} ${segment.startSec.toFixed(1)}-${segment.endSec.toFixed(1)}s`,
      ...metricLines(segment.metrics).slice(0, 5).map(line => `  ${line}`),
    ]),
  ].join('\n');
}
