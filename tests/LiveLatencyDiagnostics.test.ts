import assert from 'node:assert/strict';
import test from 'node:test';
import type { RollingAnalysisDiagnosticRecord } from '@zoeyetc/computational-listening-engine';
import { LiveLatencyDiagnostics } from '../src/audio-source-browser/live/liveLatencyDiagnostics.ts';

const record = (runId: number, analyzer: RollingAnalysisDiagnosticRecord['analyzer'] = 'built-in-production'):
  RollingAnalysisDiagnosticRecord => ({
    version: 1, sessionId: 1, runId, requestId: runId, publicationId: runId,
    analyzer, trigger: 'cadence', eligibility: 'immediate', coalescedRequestCount: 2,
    wallClockMilliseconds: { requested: 100, eligible: 103, analysisStarted: 105,
      analysisCompleted: 112, updatePrepared: 115, updatePublished: 120 },
    audioTimeSeconds: { sessionAtAnalysisStart: 1, sessionAtPublication: 1.1,
      historyDuration: 1, newestIncludedInput: 1 },
  });

test('passive LIVE diagnostics accept only built-in production records and retain bounded summaries', () => {
  let wallMs = 120;
  const probe = new LiveLatencyDiagnostics('test', () => wallMs);
  probe.applicationStarted();
  probe.bassStarted();
  wallMs = 122; const bassRuntime = probe.bassComplete();
  wallMs = 124; probe.published(bassRuntime);
  probe.diagnostic(record(1, 'custom-override'));
  assert.equal(probe.runs.length, 0);
  probe.diagnostic(record(1));
  wallMs = 130; probe.observed();
  assert.deepEqual({ ...probe.runs[0], record: undefined }, {
    record: undefined, scheduleWaitMs: 3, analysisRuntimeMs: 7,
    updatePreparationMs: 3, publicationOverheadMs: 5, requestToPublicationMs: 20,
    historyDurationMs: 1000, coalescedRequestCount: 2, bassRuntimeMs: 2,
    applicationOverheadMs: 4, uiObservationWaitMs: 10,
  });
  assert.equal('newestBlockAgeMs' in probe.runs[0], false);
  for (let index = 2; index <= 131; index += 1) probe.diagnostic(record(index));
  assert.equal(probe.runs.length, 128);
  assert.equal(probe.summary().analysisRuntimeMs?.count, 128);
});
