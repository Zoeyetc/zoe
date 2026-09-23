import assert from 'node:assert/strict';
import test from 'node:test';
import type { AudioMap, StructureRegion } from '../src/audio/types.ts';
import { createSafeTrackPlan, planRollerCoasterTrack, validateTrackPlan } from '../src/rides/roller-coaster/trackPlan.ts';

const capabilities = { melody: false, rhythm: true, percussion: false, harmony: false, tonalCenter: false, structure: true, spectrum: true } as const;
const region = (id: string, start: number, end: number, energy: readonly [number, number], section = id): StructureRegion => ({
  id, start, end, section, energy, tension: energy, build: energy, phraseProgress: [0, 1],
});
const map = (id: string, duration: number, structure: readonly StructureRegion[] | null, arrangements = 0): AudioMap => ({
  version: 1, id, duration, capabilities: { ...capabilities, structure: structure !== null }, melody: null, percussion: null,
  rhythm: [{ id: 'pulse', start: 0, end: duration, bpm: 120, beatsPerBar: null, groove: .4, swing: .1 }],
  rhythmAnalysis: { available: true, confidence: .82, beatInterval: .5 } as AudioMap['rhythmAnalysis'],
  harmony: null, structure, drops: null, spectrum: [{ id: 's', start: 0, end: duration, low: [.3,.3], mid: [.3,.3], high: [.2,.2], brightness: [.3,.3], texture: [.3,.3] }],
  structureAnalysis: arrangements ? {
    available: true, trackConfidence: .78,
    segments: [{ id: 'macro', start: 0, end: duration, label: 'A', recurrenceGroup: 'A', confidence: .8, energy: .5, contrast: .12, importance: .5, startBoundaryConfidence: .8 }],
    boundaries: [], arrangementChanges: Array.from({ length: arrangements }, (_, index) => ({ id: `arr-${index}`, time: 2 + index * 2, frameIndex: index, confidence: .7, magnitude: .5, featureContributions: { brightness:.3, texture:.3, highBand:.2, onsetDensity:.2, energy:.1 } })),
    frames: [{ id:'f', start:0, end:duration, vector:[1], energy:.5, onsetDensity:.5 }], selfSimilarity:{ size:1, values:new Float32Array([1]) }, novelty:[0], noveltyScales:{short:[0],medium:[0],long:[0]}, recurrenceGroupCount:1, averageSegmentDuration:duration,
    version:1, aggregationMode:'time-fallback', metadata:{} as never,
  } as AudioMap['structureAnalysis'] : null,
});

const buildRelease = map('build-release', 120, [region('intro',0,12,[.12,.18]), region('build',12,62,[.18,.88],'A'), region('release',62,86,[.9,.18],'B'), region('settle',86,120,[.3,.2],'C')]);
const aba = map('aba', 120, [region('a1',0,35,[.3,.45],'A'), region('b',35,78,[.35,.82],'B'), region('a2',78,120,[.3,.45],'A')]);
const high = map('high', 90, [region('intro',0,10,[.3,.4]), region('plateau',10,76,[.82,.86],'H'), region('end',76,90,[.4,.25])]);

const allPlans = [
  map('flat-low',90,[region('flat',0,90,[.1,.1])]), buildRelease,
  map('ab',90,[region('a',0,42,[.2,.3],'A'),region('b',42,90,[.8,.75],'B')]), aba, high,
  map('valley',120,[region('a',0,35,[.7,.7]),region('valley',35,75,[.15,.12]),region('return',75,120,[.7,.8])]),
  map('peak',110,[region('build',0,55,[.15,.9]),region('release',55,85,[.9,.2]),region('end',85,110,[.25,.15])]),
  map('techno',360,null,30),
  map('multi',240,[region('a',0,55,[.15,.8]),region('b',55,110,[.9,.2]),region('c',110,175,[.2,.85]),region('d',175,240,[.8,.25])]),
  map('weak',70,null), map('short',7,null), map('minimal',600,[region('one',0,600,[.18,.2])]),
].map(planRollerCoasterTrack);

test('all synthetic plans begin at Station', () => allPlans.forEach(plan => assert.equal(plan.features[0].type, 'station')));
test('all synthetic plans end with Runout semantics', () => allPlans.forEach(plan => assert.equal(plan.features.at(-1)?.type, 'runout')));
test('feature times are monotonic', () => allPlans.forEach(plan => plan.features.slice(1).forEach((feature,index) => assert.ok(feature.startTime >= plan.features[index].endTime - 1e-9))));
test('feature durations are positive', () => allPlans.forEach(plan => plan.features.forEach(feature => assert.ok(feature.endTime > feature.startTime))));
test('strength and scale remain finite and bounded', () => allPlans.forEach(plan => plan.features.forEach(feature => [feature.strength,feature.scale].forEach(value => assert.ok(Number.isFinite(value) && value >= 0 && value <= 1)))));
test('every major feature contains explainable source evidence', () => allPlans.forEach(plan => plan.features.filter(feature => ['lift','crest','drop','loop'].includes(feature.type)).forEach(feature => assert.ok(feature.sourceEvidence.summary.length > 8))));
test('a gradual long build creates Lift', () => assert.ok(planRollerCoasterTrack(buildRelease).features.some(feature => feature.type === 'lift')));
test('generated Lift leads to Crest', () => { const p=planRollerCoasterTrack(buildRelease); const i=p.features.findIndex(f=>f.type==='lift'); assert.equal(p.features[i+1]?.type,'crest'); });
test('strong release creates Drop', () => assert.ok(planRollerCoasterTrack(buildRelease).features.some(feature => feature.type === 'drop')));
test('arrangement changes alone do not create major Drop', () => assert.equal(planRollerCoasterTrack(map('arrangements',180,null,40)).features.filter(feature=>feature.type==='drop').length,0));
test('sustained important high energy may create bounded Loop', () => assert.ok(planRollerCoasterTrack(high).features.filter(feature=>feature.type==='loop').length <= 1));
test('Loop count never exceeds explicit plan budget', () => allPlans.forEach(plan => assert.ok(plan.features.filter(feature=>feature.type==='loop').length <= plan.budget.loops)));
test('repetitive electronic evidence does not create feature spam', () => assert.ok(planRollerCoasterTrack(map('techno-many',360,null,80)).features.length <= 8));
test('long repetitive minimal evidence stays mechanically simple', () => assert.ok(planRollerCoasterTrack(map('long-min',600,[region('only',0,600,[.18,.2])])).features.length <= 5));
test('A B A recurrence reuses a deterministic motif family', () => { const p=planRollerCoasterTrack(aba); const a=p.features.filter(f=>f.sourceEvidence.recurrenceGroup==='A'); assert.ok(a.length>=2); assert.equal(a[0].motif,a.at(-1)?.motif); });
test('unavailable structure uses safe fallback grammar', () => assert.deepEqual(planRollerCoasterTrack(map('none',60,null)).features.map(feature=>feature.type), ['station','lift','drop','run','runout']));
test('same input produces byte-equivalent TrackPlan', () => assert.deepEqual(planRollerCoasterTrack(buildRelease),planRollerCoasterTrack(buildRelease)));
test('arrangement count cannot radically change major grammar', () => { const a=planRollerCoasterTrack(map('x',180,null,4)); const b=planRollerCoasterTrack(map('x',180,null,40)); assert.deepEqual(a.features.filter(f=>['lift','crest','drop','loop'].includes(f.type)).map(f=>f.type),b.features.filter(f=>['lift','crest','drop','loop'].includes(f.type)).map(f=>f.type)); });
test('phrase proxy is explicit and never claims formal analysis', () => allPlans.forEach(plan => assert.equal(plan.phraseProxy.formalPhraseAnalysis,false)));
test('macro energy is smoothed, bounded, and finite', () => allPlans.forEach(plan => plan.macroEnergy.forEach(point => assert.ok(Number.isFinite(point.slope)&&point.energy>=0&&point.energy<=1))));
test('plan validation accepts generated plans', () => allPlans.forEach(plan => assert.deepEqual(validateTrackPlan(plan),[])));
test('safe plan identity includes source identity', () => assert.notEqual(createSafeTrackPlan({id:'a',duration:60}).id,createSafeTrackPlan({id:'b',duration:60}).id));
