import { analyzePcmListeningAsync, type PcmAudio } from '../analysis/AudioAnalysis.ts';
import { createCompactMelodyEvidenceTimeline, readCompactMelodyEvidenceStorage } from '../melody-evidence/compactTimeline.ts';
import { selectMelodyEvidence } from '../melody-evidence/selectMelodyEvidence.ts';
import type { MelodyEvidenceBuildFrame, MelodyEvidenceTimeline } from '../melody-evidence/types.ts';
import { collectListeningEvents } from '../ListeningTimeline.ts';
import type { ListeningEvent } from '../listeningTimelineTypes.ts';
import type { ListeningMap } from '../types.ts';
import { RollingPcmBuffer } from './RollingPcmBuffer.ts';

export const ROLLING_LISTENING_WINDOW_SECONDS = 12;
export const ROLLING_LISTENING_CADENCE_SECONDS = 0.5;
export const ROLLING_LISTENING_EVENT_CAP = 64;

export type RollingListeningDiagnostics = Readonly<{
  rollingPcmBytes: number; retainedEvidenceBytes: number; retainedEventCount: number;
  analysisCadence: number; droppedAnalysisRequests: number; lastAnalysisLatency: number;
}>;
export type RollingListeningUpdate = Readonly<{
  map: ListeningMap; time: number; events: readonly ListeningEvent[]; diagnostics: RollingListeningDiagnostics;
}>;
type AnalyzePcm = (pcm: PcmAudio) => Promise<ListeningMap>;
export type RollingListeningSessionOptions = Readonly<{
  sampleRate: number; readTime(): number; onUpdate(update: RollingListeningUpdate): void;
  analyze?: AnalyzePcm; now?: () => number;
}>;
const shiftInterval = <T extends { start: number; end: number }>(item: T, offset: number): T =>
  ({ ...item, start: item.start + offset, end: item.end + offset });

function shiftEvidence(timeline: MelodyEvidenceTimeline | null | undefined, offset: number) {
  if (!timeline) return null;
  const storage = readCompactMelodyEvidenceStorage(timeline);
  const frames: MelodyEvidenceBuildFrame[] = [];
  for (let index = 0; index < timeline.frameCount; index += 1) {
    const evidence = selectMelodyEvidence(timeline, storage.frameTimes[index]);
    if (!evidence) continue;
    frames.push({
      time: evidence.time + offset, rms: evidence.rms,
      candidates: evidence.candidates.map(candidate => ({ pitchHz: candidate.pitchHz,
        periodicity: candidate.periodicity, salience: candidate.salience, score: candidate.score })),
      generation: evidence.generation, outOfRangeCandidateCount: evidence.outOfRangeCandidateCount,
      rejectedCandidates: evidence.rejectedCandidates.map(candidate => ({ frequencyHz: candidate.frequencyHz,
        periodicity: candidate.periodicity, salience: candidate.salience, score: candidate.score,
        reason: candidate.reason })),
      selectedCandidateIndex: evidence.selectedCandidateIndex, finalPitchHz: evidence.finalPitchHz,
      finalConfidence: evidence.finalConfidence, finalSalience: evidence.finalSalience,
      voiced: evidence.voiced, reason: evidence.reason,
    });
  }
  return createCompactMelodyEvidenceTimeline(frames, timeline.thresholds, timeline.track);
}

function toRollingMap(map: ListeningMap, offset: number, sessionTime: number): ListeningMap {
  const elapsed = sessionTime;
  const melodyReady = elapsed >= 2;
  const rhythmReady = elapsed >= 4;
  const percussionReady = elapsed >= 0.3;
  const harmonyReady = elapsed >= 2;
  const tonalReady = elapsed >= 8;
  const melodyAnalysis = map.melodyAnalysis ? { ...map.melodyAnalysis,
    contour: map.melodyAnalysis.contour.map(frame => ({ ...frame, time: frame.time + offset })),
    notes: map.melodyAnalysis.notes.map(note => shiftInterval(note, offset)) } : null;
  const percussionAnalysis = map.percussionAnalysis ? { ...map.percussionAnalysis,
    events: map.percussionAnalysis.events.map(hit => ({ ...hit, time: hit.time + offset })) } : null;
  const rhythmAnalysis = map.rhythmAnalysis ? { ...map.rhythmAnalysis,
    beats: map.rhythmAnalysis.beats.map(beat => ({ ...beat, time: beat.time + offset })) } : null;
  const harmonyAnalysis = map.harmonyAnalysis ? { ...map.harmonyAnalysis,
    frames: map.harmonyAnalysis.frames.map(frame => ({ ...frame, time: frame.time + offset })),
    segments: map.harmonyAnalysis.segments.map(segment => shiftInterval(segment, offset)) } : null;
  const tonalCenterAnalysis = map.tonalCenterAnalysis ? { ...map.tonalCenterAnalysis,
    frames: map.tonalCenterAnalysis.frames.map(frame => ({ ...frame, time: frame.time + offset })),
    segments: map.tonalCenterAnalysis.segments.map(segment => shiftInterval(segment, offset)) } : null;
  const capabilities = {
    spectrum: true,
    melody: melodyReady && Boolean(melodyAnalysis?.available),
    rhythm: rhythmReady && Boolean(rhythmAnalysis?.available),
    percussion: percussionReady && Boolean(percussionAnalysis?.available),
    harmony: harmonyReady && Boolean(harmonyAnalysis?.available),
    tonalCenter: tonalReady && Boolean(tonalCenterAnalysis?.available),
    structure: false,
  } as const;
  return {
    ...map,
    // ListeningMap remains a lookup carrier here, not a claim about external-track duration.
    // A fixed rolling horizon prevents a slow analysis pass from looking ENDED.
    duration: Math.max(1, sessionTime + ROLLING_LISTENING_WINDOW_SECONDS),
    capabilities,
    amplitude: map.amplitude?.map(item => shiftInterval(item, offset)) ?? [],
    spectrum: map.spectrum?.map(item => shiftInterval(item, offset)) ?? [],
    melody: capabilities.melody ? melodyAnalysis?.notes ?? [] : null,
    melodyAnalysis,
    melodyEvidence: shiftEvidence(map.melodyEvidence, offset),
    percussion: capabilities.percussion ? percussionAnalysis?.events ?? [] : null,
    percussionAnalysis,
    rhythm: capabilities.rhythm ? map.rhythm?.map(item => shiftInterval(item, offset)) ?? [] : null,
    rhythmAnalysis,
    harmony: capabilities.harmony ? harmonyAnalysis?.segments ?? [] : null,
    harmonyAnalysis,
    tonalCenterAnalysis,
    structureAnalysis: null,
  };
}

function eventKey(event: ListeningEvent) {
  const identity = event.type === 'note-on' || event.type === 'note-off' ? event.note.midi
    : event.type === 'chord-change' ? event.harmony?.chord ?? 'none'
    : event.type === 'tonal-center-change' ? event.tonalCenter.label
    : 'id' in event ? event.id : '';
  return `${event.type}:${event.time.toFixed(4)}:${identity}`;
}

const eventsFrom = (map: ListeningMap): ListeningEvent[] => collectListeningEvents(map, {
  includeInitialTonalCenter: true, includeHarmonyEnds: false, percussionDefaultConfidence: 0,
  noteOffFirstAtSameTime: false,
});

export function createRollingListeningSession(options: RollingListeningSessionOptions) {
  const analyze = options.analyze ?? analyzePcmListeningAsync;
  const now = options.now ?? (() => performance.now() / 1000);
  const buffer = new RollingPcmBuffer(options.sampleRate, ROLLING_LISTENING_WINDOW_SECONDS);
  const seenEvents = new Map<string, number>();
  let retainedEvents: ListeningEvent[] = [];
  let running = false;
  let rerunLatest = false;
  let stopped = false;
  let lastScheduledAt = Number.NEGATIVE_INFINITY;
  let droppedAnalysisRequests = 0;

  const run = async () => {
    if (stopped || !buffer.length) return;
    if (running) { rerunLatest = true; droppedAnalysisRequests += 1; return; }
    running = true;
    const pcm = buffer.snapshot();
    const observationTime = options.readTime();
    const windowDuration = pcm.length / options.sampleRate;
    const offset = Math.max(0, observationTime - windowDuration);
    const analysisStarted = now();
    try {
      const analyzed = await analyze({ sampleRate: options.sampleRate, channels: [pcm] });
      if (stopped) return;
      const latestTime = options.readTime();
      const map = toRollingMap(analyzed, offset, latestTime);
      const cutoff = Math.max(0, latestTime - ROLLING_LISTENING_WINDOW_SECONDS);
      for (const [key, time] of seenEvents) if (time < cutoff) seenEvents.delete(key);
      const fresh = eventsFrom(map).filter(event => {
        const key = eventKey(event);
        if (event.time < cutoff || event.time > latestTime || seenEvents.has(key)) return false;
        seenEvents.set(key, event.time); return true;
      });
      retainedEvents = [...retainedEvents, ...fresh].slice(-ROLLING_LISTENING_EVENT_CAP);
      const evidenceBytes = (map.melodyEvidence?.byteLength ?? 0)
        + (map.amplitude?.length ?? 0) * 64 + (map.spectrum?.length ?? 0) * 80
        + (map.harmonyAnalysis?.frames.length ?? 0) * 160 + (map.tonalCenterAnalysis?.frames.length ?? 0) * 192;
      options.onUpdate({ map, time: latestTime, events: fresh, diagnostics: {
        rollingPcmBytes: buffer.byteLength, retainedEvidenceBytes: evidenceBytes,
        retainedEventCount: retainedEvents.length, analysisCadence: ROLLING_LISTENING_CADENCE_SECONDS,
        droppedAnalysisRequests, lastAnalysisLatency: Math.max(0, now() - analysisStarted),
      } });
    } finally {
      running = false;
      if (rerunLatest && !stopped) { rerunLatest = false; void run(); }
    }
  };

  return {
    push(channels: readonly Float32Array[]) {
      if (stopped) return;
      buffer.push(channels);
      if (buffer.totalDuration - lastScheduledAt >= ROLLING_LISTENING_CADENCE_SECONDS) {
        lastScheduledAt = buffer.totalDuration; void run();
      }
    },
    analyzeNow: run,
    diagnostics: () => ({ capacitySamples: buffer.capacity, bufferedSamples: buffer.length,
      rollingPcmBytes: buffer.byteLength, retainedEventCount: retainedEvents.length, droppedAnalysisRequests }),
    stop() { stopped = true; retainedEvents = []; seenEvents.clear(); buffer.clear(); },
  };
}
