import { collectListeningEvents, type ListeningEvent } from '@computational-listening/engine';
import { analyzePcmAudioAsync, type PcmAudio } from '../analysis/AudioAnalysis.ts';
import { createCompactMelodyEvidenceTimeline, readCompactMelodyEvidenceStorage } from '../melody-evidence/compactTimeline.ts';
import { selectMelodyEvidence } from '../melody-evidence/selectMelodyEvidence.ts';
import type { MelodyEvidenceBuildFrame, MelodyEvidenceTimeline } from '../melody-evidence/types.ts';
import type { AudioEvent, AudioMap, TransportState } from '../types.ts';
import { RollingPcmBuffer } from './RollingPcmBuffer.ts';
import {
  LIVE_ANALYSIS_CADENCE_SECONDS, LIVE_EVENT_BUFFER_CAP, LIVE_INPUT_WINDOW_SECONDS,
  type LiveAnalysisUpdate, type LiveInputState, type LiveListenerState,
} from './types.ts';

type AnalyzePcm = (pcm: PcmAudio, source: Readonly<{ id: string; filename: string; mimeType: string }>) => Promise<AudioMap>;
type TimedAudioEvent = ListeningEvent;
type LiveAnalyzerOptions = Readonly<{
  sampleRate: number;
  sessionId: string;
  deviceId: string | null;
  deviceLabel: string | null;
  channelCount: number;
  baseLatency: number | null;
  outputLatency: number | null;
  readTransport(): TransportState;
  onUpdate(update: LiveAnalysisUpdate): void;
  analyze?: AnalyzePcm;
  now?: () => number;
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

function toLiveMap(map: AudioMap, offset: number, sessionTime: number, options: LiveAnalyzerOptions): AudioMap {
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
    id: `live-input-${options.sessionId}`,
    // AudioMap remains a lookup carrier here, not a claim about external-track duration.
    // A fixed rolling horizon prevents a slow analysis pass from looking ENDED.
    duration: Math.max(1, sessionTime + LIVE_INPUT_WINDOW_SECONDS),
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
    structure: null,
    drops: null,
    source: { kind: 'live-input', filename: null, mimeType: 'audio/x-live-input',
      deviceId: options.deviceId, deviceLabel: options.deviceLabel },
  };
}

function eventKey(event: TimedAudioEvent) {
  const identity = event.type === 'note-on' || event.type === 'note-off' ? event.note.midi
    : event.type === 'chord-change' ? event.harmony?.chord ?? 'none'
    : event.type === 'tonal-center-change' ? event.tonalCenter.label
    : 'id' in event ? event.id : '';
  return `${event.type}:${event.time.toFixed(4)}:${identity}`;
}

const eventsFrom = (map: AudioMap): TimedAudioEvent[] => collectListeningEvents(map, {
  includeInitialTonalCenter: true, includeHarmonyEnds: false, percussionDefaultConfidence: 0,
  noteOffFirstAtSameTime: false,
});

const status = (ready: boolean, available: boolean): LiveListenerState =>
  !ready ? 'WARMING_UP' : available ? 'LIVE' : 'SEARCHING';

export function createLiveRollingAnalyzer(options: LiveAnalyzerOptions) {
  const analyze = options.analyze ?? analyzePcmAudioAsync;
  const now = options.now ?? (() => performance.now() / 1000);
  const buffer = new RollingPcmBuffer(options.sampleRate, LIVE_INPUT_WINDOW_SECONDS);
  const seenEvents = new Map<string, number>();
  let retainedEvents: AudioEvent[] = [];
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
    const transport = options.readTransport();
    const windowDuration = pcm.length / options.sampleRate;
    const offset = Math.max(0, transport.time - windowDuration);
    const analysisStarted = now();
    try {
      const analyzed = await analyze({ sampleRate: options.sampleRate, channels: [pcm] }, {
        id: options.sessionId, filename: options.deviceLabel ?? 'live-input', mimeType: 'audio/x-live-input',
      });
      if (stopped) return;
      const latestTransport = options.readTransport();
      const map = toLiveMap(analyzed, offset, latestTransport.time, options);
      const cutoff = Math.max(0, latestTransport.time - LIVE_INPUT_WINDOW_SECONDS);
      for (const [key, time] of seenEvents) if (time < cutoff) seenEvents.delete(key);
      const fresh = eventsFrom(map).filter(event => {
        const key = eventKey(event);
        if (event.time < cutoff || event.time > latestTransport.time || seenEvents.has(key)) return false;
        seenEvents.set(key, event.time); return true;
      });
      retainedEvents = [...retainedEvents, ...fresh].slice(-LIVE_EVENT_BUFFER_CAP);
      const elapsed = latestTransport.time;
      const evidenceBytes = (map.melodyEvidence?.byteLength ?? 0)
        + (map.amplitude?.length ?? 0) * 64 + (map.spectrum?.length ?? 0) * 80
        + (map.harmonyAnalysis?.frames.length ?? 0) * 160 + (map.tonalCenterAnalysis?.frames.length ?? 0) * 192;
      const listeners = {
        signal: { state: status(elapsed >= 0.05, true), elapsed, required: 0.05 },
        melody: { state: status(elapsed >= 2, map.capabilities.melody), elapsed, required: 2 },
        rhythm: { state: status(elapsed >= 4, map.capabilities.rhythm), elapsed, required: 4 },
        percussion: { state: status(elapsed >= 0.3, map.capabilities.percussion), elapsed, required: 0.3 },
        harmony: { state: status(elapsed >= 2, map.capabilities.harmony), elapsed, required: 2 },
        tonalCenter: { state: status(elapsed >= 8, map.capabilities.tonalCenter), elapsed, required: 8 },
        structure: { state: 'UNAVAILABLE_LIVE' as const, elapsed, required: 0 },
      };
      const state: LiveInputState = {
        status: 'LIVE', devices: [], selectedDeviceId: options.deviceId, deviceLabel: options.deviceLabel,
        sampleRate: options.sampleRate, channelCount: options.channelCount, sessionTime: elapsed,
        baseLatency: options.baseLatency, outputLatency: options.outputLatency,
        rollingPcmBytes: buffer.byteLength, retainedEvidenceBytes: evidenceBytes,
        retainedEventCount: retainedEvents.length, analysisCadence: LIVE_ANALYSIS_CADENCE_SECONDS,
        droppedAnalysisRequests, lastAnalysisLatency: Math.max(0, now() - analysisStarted), listeners, error: null,
      };
      options.onUpdate({ map, transport: latestTransport, events: fresh, state });
    } finally {
      running = false;
      if (rerunLatest && !stopped) { rerunLatest = false; void run(); }
    }
  };

  return {
    push(channels: readonly Float32Array[]) {
      if (stopped) return;
      buffer.push(channels);
      if (buffer.totalDuration - lastScheduledAt >= LIVE_ANALYSIS_CADENCE_SECONDS) {
        lastScheduledAt = buffer.totalDuration; void run();
      }
    },
    analyzeNow: run,
    diagnostics: () => ({ capacitySamples: buffer.capacity, bufferedSamples: buffer.length,
      rollingPcmBytes: buffer.byteLength, retainedEventCount: retainedEvents.length, droppedAnalysisRequests }),
    stop() { stopped = true; retainedEvents = []; seenEvents.clear(); buffer.clear(); },
  };
}
