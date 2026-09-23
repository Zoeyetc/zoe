import type { AudioMap } from '../../audio/types.ts';

export const TRACK_PLAN_VERSION = '9f.1';
export type TrackFeatureType = 'station' | 'lift' | 'crest' | 'drop' | 'run' | 'loop' | 'runout';
export type TrackEvidenceSource = 'authored-structure' | 'structure-analysis' | 'safe-fallback';
export type TrackFeatureEvidence = Readonly<{
  source: TrackEvidenceSource;
  summary: string;
  sectionIds: readonly string[];
  boundaryIds: readonly string[];
  arrangementChangeIds: readonly string[];
  recurrenceGroup: string | null;
  energyBefore: number;
  energyAfter: number;
  energySlope: number;
  contrast: number;
  importance: number;
  rhythmConfidence: number;
  releaseProxy: number;
}>;
export type TrackFeaturePlan = Readonly<{
  id: string;
  type: TrackFeatureType;
  startTime: number;
  endTime: number;
  strength: number;
  scale: number;
  motif: string;
  sourceEvidence: TrackFeatureEvidence;
}>;
export type MacroEnergyPoint = Readonly<{ time: number; energy: number; slope: number }>;
export type PhraseProxy = Readonly<{
  name: 'beat-block phrase proxy';
  beatBlockSize: 4 | 8 | 16 | 32;
  blockDuration: number;
  confidence: number;
  formalPhraseAnalysis: false;
}>;
export type TrackPlan = Readonly<{
  version: typeof TRACK_PLAN_VERSION;
  id: string;
  audioMapId: string;
  duration: number;
  generationSource: TrackEvidenceSource;
  fallbackUsed: boolean;
  phraseProxy: PhraseProxy;
  macroEnergy: readonly MacroEnergyPoint[];
  budget: Readonly<{ total: number; major: number; loops: number }>;
  features: readonly TrackFeaturePlan[];
  valid: boolean;
  error: string | null;
}>;

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const stableHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
};
const average = (values: readonly number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const energyAt = (map: AudioMap, time: number) => {
  const frame = map.structureAnalysis?.frames.find(item => item.start <= time && time < item.end);
  if (frame) return clamp01(frame.energy);
  const authored = map.structure?.find(item => item.start <= time && time < item.end);
  if (authored) {
    const progress = (time - authored.start) / Math.max(1e-6, authored.end - authored.start);
    return clamp01(authored.energy[0] + (authored.energy[1] - authored.energy[0]) * progress);
  }
  const amplitude = map.amplitude?.find(item => item.start <= time && time < item.end);
  return amplitude ? clamp01(average(amplitude.rms)) : 0;
};

export function createMacroEnergy(map: AudioMap): readonly MacroEnergyPoint[] {
  const block = Math.max(2, Math.min(8, map.rhythmAnalysis?.beatInterval
    ? map.rhythmAnalysis.beatInterval * 8 : map.duration / 24));
  const count = Math.max(3, Math.min(96, Math.ceil(map.duration / block)));
  const raw = Array.from({ length: count }, (_, index) => {
    const time = Math.min(map.duration, (index + 0.5) * map.duration / count);
    const samples = [-0.35, 0, 0.35].map(offset => energyAt(map, Math.max(0, Math.min(map.duration - 1e-6, time + offset * block))));
    return { time, energy: average(samples) };
  });
  return raw.map((point, index) => {
    const previous = raw[Math.max(0, index - 1)];
    const next = raw[Math.min(raw.length - 1, index + 1)];
    const smoothed = average([previous.energy, point.energy, next.energy]);
    return { time: point.time, energy: clamp01(smoothed), slope: (next.energy - previous.energy) / Math.max(block, next.time - previous.time) };
  });
}

const fallbackEvidence = (summary: string): TrackFeatureEvidence => ({
  source: 'safe-fallback', summary, sectionIds: [], boundaryIds: [], arrangementChangeIds: [], recurrenceGroup: null,
  energyBefore: 0, energyAfter: 0, energySlope: 0, contrast: 0, importance: 0, rhythmConfidence: 0, releaseProxy: 0,
});

export function createSafeTrackPlan(map: Pick<AudioMap, 'id' | 'duration'>, reason = 'structure evidence unavailable'): TrackPlan {
  const duration = Math.max(1, Number.isFinite(map.duration) ? map.duration : 1);
  const cuts = [0, .1, .42, .62, .84, 1].map(value => value * duration);
  const types: TrackFeatureType[] = ['station', 'lift', 'drop', 'run', 'runout'];
  const features = types.map((type, index): TrackFeaturePlan => ({
    id: `fallback-${index}-${type}`, type, startTime: cuts[index], endTime: cuts[index + 1],
    strength: type === 'lift' || type === 'drop' ? 0.35 : 0.2,
    scale: type === 'station' || type === 'runout' ? 0.7 : 0.55,
    motif: 'fallback-gentle', sourceEvidence: fallbackEvidence(`${reason}; deterministic gentle ${type}`),
  }));
  const id = `track-plan-${stableHash(JSON.stringify({ map: map.id, duration, reason, types }))}`;
  return {
    version: TRACK_PLAN_VERSION, id, audioMapId: map.id, duration, generationSource: 'safe-fallback', fallbackUsed: true,
    phraseProxy: { name: 'beat-block phrase proxy', beatBlockSize: 16, blockDuration: Math.min(duration, 8), confidence: 0, formalPhraseAnalysis: false },
    macroEnergy: [{ time: duration / 2, energy: 0, slope: 0 }], budget: { total: 5, major: 2, loops: 0 },
    features, valid: true, error: reason,
  };
}

type PlannerSegment = Readonly<{ id: string; start: number; end: number; energy: number; energyStart: number; energyEnd: number; contrast: number; importance: number; recurrenceGroup: string | null; confidence: number }>;
const sourceSegments = (map: AudioMap): { source: TrackEvidenceSource; segments: readonly PlannerSegment[] } | null => {
  const analysis = map.structureAnalysis;
  if (analysis?.available && analysis.segments.length) return { source: 'structure-analysis', segments: analysis.segments.map(segment => ({ ...segment, energyStart: segment.energy, energyEnd: segment.energy })) };
  if (map.structure?.length) return { source: 'authored-structure', segments: map.structure.map(region => ({
    id: region.id, start: region.start, end: region.end, energy: average(region.energy), energyStart: region.energy[0], energyEnd: region.energy[1],
    contrast: Math.abs(region.energy[1] - region.energy[0]), importance: Math.max(average(region.energy), average(region.build)),
    recurrenceGroup: region.section, confidence: 1,
  })) };
  return null;
};

function makeEvidence(map: AudioMap, source: TrackEvidenceSource, segment: PlannerSegment, previousEnergy: number, nextEnergy: number) {
  const boundaries = map.structureAnalysis?.boundaries.filter(item => Math.abs(item.time - segment.end) <= 2) ?? [];
  const arrangements = map.structureAnalysis?.arrangementChanges.filter(item => segment.start <= item.time && item.time < segment.end) ?? [];
  const duration = Math.max(1, segment.end - segment.start);
  const slope = (nextEnergy - previousEnergy) / duration;
  const release = clamp01(Math.max(segment.energy - nextEnergy, segment.energyStart - segment.energyEnd, segment.contrast * .72 + segment.importance * .28));
  const summary = `${source}; ${segment.id} ${segment.start.toFixed(2)}–${segment.end.toFixed(2)}s; energy ${segment.energy.toFixed(2)}; contrast ${segment.contrast.toFixed(2)}; importance ${segment.importance.toFixed(2)}; slope ${slope.toFixed(3)}; release ${release.toFixed(2)}; ${arrangements.length} arrangement changes`;
  return {
    source, summary, sectionIds: [segment.id], boundaryIds: boundaries.map(item => item.id),
    arrangementChangeIds: arrangements.map(item => item.id), recurrenceGroup: segment.recurrenceGroup,
    energyBefore: clamp01(previousEnergy), energyAfter: clamp01(nextEnergy), energySlope: slope,
    contrast: clamp01(segment.contrast), importance: clamp01(segment.importance),
    rhythmConfidence: clamp01(map.rhythmAnalysis?.confidence ?? (map.capabilities.rhythm ? 1 : 0)), releaseProxy: release,
  } satisfies TrackFeatureEvidence;
}

export function validateTrackPlan(plan: TrackPlan): readonly string[] {
  const errors: string[] = [];
  if (plan.features[0]?.type !== 'station') errors.push('plan must begin with station');
  if (plan.features.at(-1)?.type !== 'runout') errors.push('plan must end with runout');
  plan.features.forEach((feature, index) => {
    if (!(feature.endTime > feature.startTime) || feature.startTime < 0 || feature.endTime > plan.duration + 1e-6) errors.push(`${feature.id}: invalid time range`);
    if (index && feature.startTime < plan.features[index - 1].endTime - 1e-6) errors.push(`${feature.id}: overlaps previous feature`);
    if (![feature.strength, feature.scale, ...Object.values(feature.sourceEvidence).filter(value => typeof value === 'number')].every(Number.isFinite)) errors.push(`${feature.id}: non-finite evidence`);
    if (feature.strength < 0 || feature.strength > 1 || feature.scale < 0 || feature.scale > 1) errors.push(`${feature.id}: unbounded strength or scale`);
    if (['lift', 'crest', 'drop', 'loop'].includes(feature.type) && !feature.sourceEvidence.summary) errors.push(`${feature.id}: major feature lacks evidence`);
  });
  if (plan.features.filter(feature => feature.type === 'loop').length > plan.budget.loops) errors.push('loop budget exceeded');
  return errors;
}

export function planRollerCoasterTrack(map: AudioMap): TrackPlan {
  const duration = map.duration;
  const input = sourceSegments(map);
  if (!input || duration < 12 || input.segments.some(segment => !Number.isFinite(segment.energy))) return createSafeTrackPlan(map);
  const macroEnergy = createMacroEnergy(map);
  const majorBudget = Math.max(4, Math.min(8, 2 + Math.floor(duration / 45)));
  const loopBudget = duration >= 75 ? Math.min(2, Math.floor(duration / 100) + 1) : duration >= 38 ? 1 : 0;
  const totalBudget = Math.max(10, Math.min(20, 7 + Math.floor(duration / 24)));
  const rhythmConfidence = map.rhythmAnalysis?.confidence ?? (map.capabilities.rhythm ? 1 : 0);
  const beatBlockSize: 4 | 8 | 16 | 32 = duration < 30 ? 8 : duration > 240 ? 32 : 16;
  const beatInterval = map.rhythmAnalysis?.beatInterval ?? (map.rhythm?.[0] ? 60 / map.rhythm[0].bpm : null);
  const phraseProxy: PhraseProxy = {
    name: 'beat-block phrase proxy', beatBlockSize,
    blockDuration: beatInterval ? beatInterval * beatBlockSize : Math.min(16, Math.max(4, duration / input.segments.length)),
    confidence: clamp01((map.structureAnalysis?.trackConfidence ?? .65) * .75 + rhythmConfidence * .25), formalPhraseAnalysis: false,
  };
  const features: TrackFeaturePlan[] = [];
  let majorCount = 0;
  let loopCount = 0;
  const stationEnd = Math.min(duration * .1, Math.max(2, phraseProxy.blockDuration * .4));
  features.push({ id: 'track-station', type: 'station', startTime: 0, endTime: stationEnd, strength: .2, scale: .7, motif: 'anchor', sourceEvidence: fallbackEvidence('beginning anchor required by track grammar') });
  const endStart = Math.max(stationEnd + 1, duration - Math.min(duration * .14, Math.max(3, phraseProxy.blockDuration * .55)));
  const usable = input.segments.filter(segment => segment.end > stationEnd && segment.start < endStart);
  for (let index = 0; index < usable.length && features.length < totalBudget - 1; index += 1) {
    const segment = usable[index];
    const start = Math.max(stationEnd, segment.start, features.at(-1)!.endTime);
    const end = Math.min(endStart, segment.end);
    if (end - start < .25) continue;
    const previous = usable[index - 1]?.energy ?? energyAt(map, start);
    const next = usable[index + 1]?.energy ?? energyAt(map, Math.min(duration - 1e-6, end));
    const evidence = makeEvidence(map, input.source, segment, previous, next);
    const motif = segment.recurrenceGroup ? `recurrence-${stableHash(segment.recurrenceGroup).slice(0, 4)}` : `section-${index}`;
    const rise = Math.max(segment.energy - previous, segment.energyEnd - segment.energyStart);
    const strongBuild = end - start >= (input.source === 'authored-structure' ? 4 : 6) && (rise > .14 || evidence.energySlope > .015) && segment.importance >= .35 && majorCount + 2 <= majorBudget;
    const strongRelease = evidence.releaseProxy >= .48 && (evidence.boundaryIds.length > 0 || segment.contrast >= .55) && majorCount + 2 <= majorBudget;
    const loopCandidate = segment.energy >= .72 && segment.importance >= .62 && end - start >= 8 && rhythmConfidence >= .58 && loopCount < loopBudget && majorCount < majorBudget;
    const add = (type: TrackFeatureType, a: number, b: number, strength: number, scale: number) => {
      if (b - a < .2 || features.length >= totalBudget - 1) return;
      features.push({ id: `track-${features.length}-${type}`, type, startTime: a, endTime: b, strength: clamp01(strength), scale: clamp01(scale), motif, sourceEvidence: evidence });
      if (['lift', 'crest', 'drop', 'loop'].includes(type)) majorCount += 1;
      if (type === 'loop') loopCount += 1;
    };
    if (strongBuild) {
      const liftEnd = start + (end - start) * .68;
      add('lift', start, liftEnd, Math.max(.35, segment.importance), .45 + .45 * segment.importance);
      add('crest', liftEnd, end, Math.max(.3, evidence.releaseProxy), .35 + .45 * segment.importance);
    } else if (strongRelease) {
      const split = start + (end - start) * .58;
      add('crest', start, split, evidence.releaseProxy, .45 + .4 * segment.importance);
      add('drop', split, end, evidence.releaseProxy, .45 + .5 * segment.importance);
    } else if (loopCandidate) {
      add('loop', start, end, Math.max(segment.energy, segment.importance), .48 + .45 * segment.importance);
    } else {
      const arrangementFactor = Math.min(.15, evidence.arrangementChangeIds.length * .025);
      add('run', start, end, segment.energy, .35 + .35 * segment.importance + arrangementFactor);
    }
  }
  if (features.at(-1)!.endTime < endStart) {
    const last = input.segments.at(-1)!;
    features.push({ id: `track-${features.length}-run`, type: 'run', startTime: features.at(-1)!.endTime, endTime: endStart,
      strength: clamp01(last.energy), scale: .45, motif: 'ending-approach', sourceEvidence: makeEvidence(map, input.source, last, last.energy, energyAt(map, endStart)) });
  }
  features.push({ id: 'track-runout', type: 'runout', startTime: endStart, endTime: duration, strength: .25, scale: .7,
    motif: 'ending-anchor', sourceEvidence: fallbackEvidence('song ending requires a stable runout') });
  const seed = { map: map.id, duration, source: input.source, phraseProxy, macroEnergy, budget: { total: totalBudget, major: majorBudget, loops: loopBudget }, features };
  const draft: TrackPlan = { version: TRACK_PLAN_VERSION, id: `track-plan-${stableHash(JSON.stringify(seed))}`, audioMapId: map.id, duration,
    generationSource: input.source, fallbackUsed: false, phraseProxy, macroEnergy,
    budget: { total: totalBudget, major: majorBudget, loops: loopBudget }, features, valid: true, error: null };
  const errors = validateTrackPlan(draft);
  return errors.length ? createSafeTrackPlan(map, `invalid generated plan: ${errors.join('; ')}`) : draft;
}
