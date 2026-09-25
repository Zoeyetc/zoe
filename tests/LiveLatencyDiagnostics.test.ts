import assert from 'node:assert/strict';
import test from 'node:test';
import { LiveLatencyDiagnostics } from '../src/audio-source-browser/live/liveLatencyDiagnostics.ts';

test('LIVE latency measurements use bounded wall-clock runs and distinguish all external boundaries', () => {
  let wallMs = 100;
  const probe = new LiveLatencyDiagnostics('test', 10, () => wallMs);
  const previousDebug = console.debug;
  console.debug = () => undefined;
  try {
    probe.block([new Float32Array(1)]);
    wallMs = 103; probe.analysisStart(100);
    wallMs = 110; probe.analysisComplete();
    wallMs = 112; probe.rollingUpdate();
    wallMs = 115; probe.bassComplete();
    wallMs = 118; probe.published();
    wallMs = 130; probe.observed();
    assert.deepEqual(probe.runs[0], {
      run: 1, audioBlockArrivalMs: 100, analysisRequestMs: 100,
      analysisStartMs: 103, analysisCompleteMs: 110, rollingUpdateMs: 112,
      bassCompleteMs: 115, applicationPublicationMs: 118, uiObservationMs: 130,
      historyDurationMs: 100, newestBlockAgeMs: 10, scheduleWaitMs: 3,
      analysisRuntimeMs: 7, bassRuntimeMs: 3, publishOverheadMs: 3, uiObservationWaitMs: 12,
    });
    assert.equal(probe.summary().historyGrowth, null);
    for (let index = 0; index < 130; index += 1) {
      wallMs += 100;
      probe.block([new Float32Array(5)]);
      probe.analysisStart(12_000);
      probe.analysisComplete(); probe.rollingUpdate(); probe.bassComplete(); probe.published(); probe.observed();
    }
    assert.equal(probe.runs.length, 128);
    assert.equal(probe.summary().analysisRuntimeMs?.count, 128);
  } finally {
    console.debug = previousDebug;
  }
});
