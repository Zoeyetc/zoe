/** Development-only wall-clock observations. Audio/session time is never used as latency. */
export type LiveLatencyRun = {
  run: number;
  audioBlockArrivalMs: number;
  analysisRequestMs: number;
  analysisStartMs: number;
  analysisCompleteMs: number;
  rollingUpdateMs: number;
  bassCompleteMs: number;
  applicationPublicationMs: number | null;
  uiObservationMs: number | null;
  historyDurationMs: number;
  newestBlockAgeMs: number;
  scheduleWaitMs: number;
  analysisRuntimeMs: number;
  bassRuntimeMs: number;
  publishOverheadMs: number | null;
  uiObservationWaitMs: number | null;
};

type Metric = 'newestBlockAgeMs' | 'scheduleWaitMs' | 'analysisRuntimeMs' | 'bassRuntimeMs'
  | 'publishOverheadMs' | 'uiObservationWaitMs' | 'historyDurationMs';
const metrics: readonly Metric[] = ['newestBlockAgeMs', 'scheduleWaitMs', 'analysisRuntimeMs',
  'bassRuntimeMs', 'publishOverheadMs', 'uiObservationWaitMs', 'historyDurationMs'];
const limit = 128;

export class LiveLatencyDiagnostics {
  readonly runs: LiveLatencyRun[] = [];
  private readonly earlyRuntimes: number[] = [];
  readonly sessionId: string;
  private readonly sampleRate: number;
  private readonly now: () => number;
  private totalSamples = 0;
  private lastScheduledAt = Number.NEGATIVE_INFINITY;
  private latestBlockMs = 0;
  private requestMs = 0;
  private current: Partial<LiveLatencyRun> | null = null;
  private awaitingUi: LiveLatencyRun | null = null;

  constructor(sessionId: string, sampleRate: number, now: () => number = () => performance.now()) {
    this.sessionId = sessionId;
    this.sampleRate = sampleRate;
    this.now = now;
  }

  block(channels: readonly Float32Array[]) {
    const arrived = this.now();
    this.latestBlockMs = arrived;
    const samples = channels.length ? Math.min(...channels.map(channel => channel.length)) : 0;
    this.totalSamples += samples;
    const duration = this.totalSamples / this.sampleRate;
    // Observe the public cadence externally; this does not schedule an Engine run.
    if (samples && duration - this.lastScheduledAt >= 0.5) {
      this.lastScheduledAt = duration;
      this.requestMs = arrived;
    }
  }

  analysisStart(historyDurationMs: number) {
    const started = this.now();
    this.current = { run: (this.runs.at(-1)?.run ?? 0) + 1,
      audioBlockArrivalMs: this.latestBlockMs, analysisRequestMs: this.requestMs || started,
      analysisStartMs: started, historyDurationMs };
  }

  analysisComplete() {
    if (this.current) this.current.analysisCompleteMs = this.now();
  }

  rollingUpdate() {
    if (this.current) this.current.rollingUpdateMs = this.now();
  }

  bassComplete() {
    if (!this.current?.analysisCompleteMs || !this.current.rollingUpdateMs) return;
    const completed = this.now();
    const run: LiveLatencyRun = {
      ...this.current as LiveLatencyRun,
      bassCompleteMs: completed, applicationPublicationMs: null, uiObservationMs: null,
      newestBlockAgeMs: Math.max(0, this.current.analysisCompleteMs - this.current.audioBlockArrivalMs!),
      scheduleWaitMs: Math.max(0, this.current.analysisStartMs! - this.current.analysisRequestMs!),
      analysisRuntimeMs: this.current.analysisCompleteMs - this.current.analysisStartMs!,
      bassRuntimeMs: completed - this.current.rollingUpdateMs,
      publishOverheadMs: null, uiObservationWaitMs: null,
    };
    this.runs.push(run);
    if (run.historyDurationMs < 6000 && this.earlyRuntimes.length < 12)
      this.earlyRuntimes.push(run.analysisRuntimeMs);
    if (this.runs.length > limit) this.runs.shift();
    this.current = null;
    this.awaitingUi = run;
  }

  published() {
    const run = this.awaitingUi;
    if (!run) return;
    run.applicationPublicationMs = this.now();
    run.publishOverheadMs = run.applicationPublicationMs - run.bassCompleteMs;
    console.debug('[Zoë LIVE latency]', {
      run: run.run, snapshotAgeMs: run.newestBlockAgeMs, scheduleWaitMs: run.scheduleWaitMs,
      analysisRuntimeMs: run.analysisRuntimeMs, bassRuntimeMs: run.bassRuntimeMs,
      publishOverheadMs: run.publishOverheadMs, historyDurationMs: run.historyDurationMs,
    });
  }

  observed() {
    const run = this.awaitingUi;
    if (!run || run.applicationPublicationMs === null) return;
    run.uiObservationMs = this.now();
    run.uiObservationWaitMs = run.uiObservationMs - run.applicationPublicationMs;
    this.awaitingUi = null;
  }

  summary() {
    const byMetric = Object.fromEntries(metrics.map(metric => {
      const values = this.runs.flatMap(run => run[metric] === null ? [] : [run[metric] as number]);
      const sorted = [...values].sort((a, b) => a - b);
      return [metric, values.length ? { latest: values.at(-1), median: sorted[Math.floor((sorted.length - 1) * .5)],
        p95: sorted[Math.ceil(sorted.length * .95) - 1], max: sorted.at(-1), count: values.length } : null];
    }));
    const early = this.earlyRuntimes;
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
  if (typeof window !== 'undefined') {
    (window as Window & { __ZOE_LIVE_LATENCY__?: LiveLatencyDiagnostics | null }).__ZOE_LIVE_LATENCY__ = probe;
  }
}
export function markLiveUiObservation() { active?.observed(); }
export function readLiveLatencyDiagnostics() { return active; }
