import type { RollingAnalysisDiagnosticRecord } from '@zoeyetc/computational-listening-engine';

/** Development-only wall-clock observations from the Engine's passive rolling seam. */
export type LiveLatencyRun = {
  record: RollingAnalysisDiagnosticRecord;
  scheduleWaitMs: number;
  analysisRuntimeMs: number;
  updatePreparationMs: number;
  publicationOverheadMs: number;
  requestToPublicationMs: number;
  historyDurationMs: number;
  coalescedRequestCount: number;
  bassRuntimeMs: number | null;
  applicationOverheadMs: number | null;
  uiObservationWaitMs: number | null;
};

type Metric = Exclude<keyof LiveLatencyRun, 'record'>;
const metrics: readonly Metric[] = ['scheduleWaitMs', 'analysisRuntimeMs', 'updatePreparationMs',
  'publicationOverheadMs', 'requestToPublicationMs', 'historyDurationMs',
  'coalescedRequestCount', 'bassRuntimeMs', 'applicationOverheadMs', 'uiObservationWaitMs'];
const limit = 128;

export class LiveLatencyDiagnostics {
  readonly runs: LiveLatencyRun[] = [];
  readonly sessionId: string;
  private readonly now: () => number;
  private readonly pendingApplication: { bassRuntimeMs: number; applicationOverheadMs: number }[] = [];
  private bassStartedMs = 0;
  private applicationStartedMs = 0;
  private awaitingUi: LiveLatencyRun | null = null;

  constructor(sessionId: string, now: () => number = () => performance.now()) {
    this.sessionId = sessionId;
    this.now = now;
  }

  diagnostic(record: RollingAnalysisDiagnosticRecord) {
    if (record.analyzer !== 'built-in-production') return;
    const application = this.pendingApplication.shift() ?? null;
    const wall = record.wallClockMilliseconds;
    const run: LiveLatencyRun = {
      record,
      scheduleWaitMs: wall.eligible - wall.requested,
      analysisRuntimeMs: wall.analysisCompleted - wall.analysisStarted,
      updatePreparationMs: wall.updatePrepared - wall.analysisCompleted,
      publicationOverheadMs: wall.updatePublished - wall.updatePrepared,
      requestToPublicationMs: wall.updatePublished - wall.requested,
      historyDurationMs: record.audioTimeSeconds.historyDuration * 1000,
      coalescedRequestCount: record.coalescedRequestCount,
      bassRuntimeMs: application?.bassRuntimeMs ?? null,
      applicationOverheadMs: application?.applicationOverheadMs ?? null,
      uiObservationWaitMs: null,
    };
    this.runs.push(run);
    if (this.runs.length > limit) this.runs.shift();
    this.awaitingUi = run;
  }

  applicationStarted() { this.applicationStartedMs = this.now(); }
  bassStarted() { this.bassStartedMs = this.now(); }
  bassComplete() { return this.now() - this.bassStartedMs; }

  published(bassRuntimeMs: number) {
    this.pendingApplication.push({ bassRuntimeMs,
      applicationOverheadMs: this.now() - this.applicationStartedMs });
    if (this.pendingApplication.length > limit) this.pendingApplication.shift();
  }

  observed() {
    const run = this.awaitingUi;
    if (!run) return;
    run.uiObservationWaitMs = this.now() - run.record.wallClockMilliseconds.updatePublished;
    this.awaitingUi = null;
  }

  summary() {
    const byMetric = Object.fromEntries(metrics.map(metric => {
      const values = this.runs.flatMap(run => run[metric] === null ? [] : [run[metric] as number]);
      const sorted = [...values].sort((a, b) => a - b);
      return [metric, values.length ? { latest: values.at(-1), median: sorted[Math.floor((sorted.length - 1) * .5)],
        p95: sorted[Math.ceil(sorted.length * .95) - 1], max: sorted.at(-1), count: values.length } : null];
    }));
    const early = this.runs.filter(run => run.historyDurationMs < 6000).slice(0, 12).map(run => run.analysisRuntimeMs);
    const full = this.runs.filter(run => run.historyDurationMs >= 11500).map(run => run.analysisRuntimeMs);
    const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)];
    return { ...byMetric, historyGrowth: early.length && full.length
      ? { earlyMedianMs: median(early), fullMedianMs: median(full), earlyRuns: early.length, fullRuns: full.length }
      : null };
  }
}

let active: LiveLatencyDiagnostics | null = null;
export function setLiveLatencyDiagnostics(probe: LiveLatencyDiagnostics | null) {
  active = probe;
  if (probe && typeof window !== 'undefined') {
    (window as Window & { __ZOE_LIVE_LATENCY__?: LiveLatencyDiagnostics }).__ZOE_LIVE_LATENCY__ = probe;
  }
}
export function markLiveUiObservation() { active?.observed(); }
export function readLiveLatencyDiagnostics() { return active; }
