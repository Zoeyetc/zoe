import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  DrumClassifierEvidence, DrumEvidence, DrumEvidenceAttempt,
} from '@zoeyetc/computational-listening-engine';
import { selectDrumPresentation } from '../src/instrument-ui/signal-console/drumPresentation.ts';

const classifier: DrumClassifierEvidence = {
  calibration: 'UNCALIBRATED',
  hypotheses: [
    { kind: 'kick', comparativeScore: .74, rank: 1 },
    { kind: 'tom', comparativeScore: .58, rank: 2 },
    { kind: 'snare', comparativeScore: .34, rank: 3 },
    { kind: 'closed-hat', comparativeScore: .2, rank: 4 },
    { kind: 'open-hat', comparativeScore: .12, rank: 5 },
  ],
  topComparativeScore: .74,
  secondComparativeScore: .58,
  comparativeMargin: .16,
  transientQuality: .81,
  consistency: .69,
  uncalibratedConfidence: .63,
};

const acoustic = { normalizedRms: .4, normalizedOnsetStrength: .8,
  localOnsetBaseline: .1, appliedOnsetThreshold: .3 };
const base = { version: 1 as const, experimental: true as const, calibration: 'UNCALIBRATED' as const,
  analyzedWindow: { start: 0, end: 4 }, trackCapability: 'AVAILABLE' as const };
const observed = (...attempts: DrumEvidenceAttempt[]): DrumEvidence => ({
  ...base, status: 'OBSERVED', attemptCount: attempts.length,
  attempts: attempts as [DrumEvidenceAttempt, ...DrumEvidenceAttempt[]],
});
const attempt = (id: string, time: number, decision: DrumEvidenceAttempt['decision']): DrumEvidenceAttempt => ({
  id, time, sourceFrame: Math.round(time * 100), acoustic, decision,
});

test('selected Drum presentation keeps named selection, all five scores, calibration and physical strength distinct', () => {
  const evidence = observed(attempt('a', 1, { state: 'SELECTED', reason: 'NAMED_CLASS_ACCEPTED',
    selectedClass: 'kick', classifierEvidence: classifier, physicalEventStrength: .91, percussionEventId: 'p1' }));
  const view = selectDrumPresentation(evidence, 1);
  assert.equal(view.state, 'SELECTED');
  assert.equal(view.selectedClass, 'kick');
  assert.equal(view.hypotheses.length, 5);
  assert.deepEqual(view.hypotheses, classifier.hypotheses);
  assert.equal(view.classifierEvidence?.calibration, 'UNCALIBRATED');
  assert.equal(view.physicalEventStrength, .91);
  assert.notEqual(view.physicalEventStrength, view.classifierEvidence?.topComparativeScore);
});

test('ambiguous abstention preserves competition without inventing an other hypothesis', () => {
  const evidence = observed(attempt('a', 1, { state: 'ABSTAINED', reason: 'AMBIGUOUS_CLASS_EVIDENCE',
    ambiguityFallback: 'other-percussion', ambiguityReasons: ['LOW_CLASS_MARGIN'],
    classifierEvidence: classifier, physicalEventStrength: .7, percussionEventId: 'p1' }));
  const view = selectDrumPresentation(evidence, 1);
  assert.equal(view.state, 'ABSTAINED');
  assert.deepEqual(view.ambiguityReasons, ['LOW_CLASS_MARGIN']);
  assert.equal(view.hypotheses.length, 5);
  assert.equal(view.hypotheses.some(item => String(item.kind) === 'other-percussion'), false);
});

test('insufficient evidence abstains without fabricating selection or physical strength', () => {
  const view = selectDrumPresentation(observed(attempt('a', 1, { state: 'ABSTAINED',
    reason: 'INSUFFICIENT_EVIDENCE', classifierEvidence: classifier })), 1);
  assert.equal(view.state, 'ABSTAINED');
  assert.equal(view.selectedClass, null);
  assert.equal(view.physicalEventStrength, null);
  assert.equal(view.hypotheses.length, 5);
});

test('pre-classification rejection exposes acoustics but no classifier placeholders', () => {
  for (const reason of ['NON_PERCUSSIVE_SUSTAINED', 'INCOMPLETE_RIGHT_EDGE'] as const) {
    const view = selectDrumPresentation(observed(attempt(reason, 1, { state: 'REJECTED', reason })), 1);
    assert.equal(view.state, 'REJECTED');
    assert.equal(view.reason, reason);
    assert.equal(view.classifierEvidence, null);
    assert.deepEqual(view.hypotheses, []);
    assert.equal(view.attempt?.acoustic, acoustic);
  }
});

test('temporal dedup rejection retains classifier evidence supplied by the Engine contract', () => {
  const view = selectDrumPresentation(observed(attempt('a', 1, { state: 'REJECTED',
    reason: 'TEMPORAL_DEDUPLICATION', classifierEvidence: classifier })), 1);
  assert.equal(view.state, 'REJECTED');
  assert.equal(view.hypotheses.length, 5);
});

test('NO_EVENT and UNAVAILABLE remain distinct quiet states', () => {
  const noEvent = selectDrumPresentation({ ...base, status: 'NO_EVENT', reason: 'NO_PERCUSSIVE_OPPORTUNITY',
    trackCapability: 'UNAVAILABLE', attemptCount: 0, attempts: [] }, 1);
  const unavailable = selectDrumPresentation(undefined, 1);
  assert.equal(noEvent.state, 'NO_EVENT');
  assert.equal(noEvent.reason, 'NO_PERCUSSIVE_OPPORTUNITY');
  assert.equal(unavailable.state, 'UNAVAILABLE');
  assert.equal(unavailable.reason, 'ANALYSIS_NOT_RUN');
});

test('transport selection is causal, stable, and does not mutate Engine evidence', () => {
  const first = attempt('first', 1, { state: 'REJECTED', reason: 'NON_PERCUSSIVE_SUSTAINED' });
  const second = attempt('second', 2, { state: 'SELECTED', reason: 'NAMED_CLASS_ACCEPTED',
    selectedClass: 'tom', classifierEvidence: classifier, physicalEventStrength: .8, percussionEventId: 'p2' });
  const evidence = observed(first, second);
  const before = structuredClone(evidence);
  assert.equal(selectDrumPresentation(evidence, .9).state, 'NO_CURRENT_ATTEMPT');
  assert.equal(selectDrumPresentation(evidence, 1.9).attempt?.id, 'first');
  assert.equal(selectDrumPresentation(evidence, 2).attempt?.id, 'second');
  assert.equal(selectDrumPresentation(evidence, 0, true).attempt?.id, 'second');
  assert.deepEqual(evidence, before);
});

test('Drum inspection is isolated to ORIGINAL SignalConsole and does not enter Glyph Field or mode policy', async () => {
  const fs = await import('node:fs/promises');
  const consoleSource = await fs.readFile('src/instrument-ui/signal-console/SignalConsole.tsx', 'utf8');
  const glyphSource = await fs.readFile('src/instrument-ui/representations/GlyphFieldRenderer.tsx', 'utf8');
  const modeSource = await fs.readFile('src/instrument-ui/signal-player/MotionMode.ts', 'utf8').catch(() => '');
  assert.match(consoleSource, /DRUM \/ INSPECT/);
  assert.doesNotMatch(glyphSource, /drumPresentation|DRUM \/ INSPECT/);
  assert.doesNotMatch(modeSource, /drumPresentation|DrumEvidence/);
});
