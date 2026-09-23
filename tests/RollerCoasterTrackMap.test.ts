import assert from 'node:assert/strict';
import test from 'node:test';
import { dot, magnitude, sub } from '../src/rides/roller-coaster/geometry.ts';
import { sampleRoute } from '../src/rides/roller-coaster/route.ts';
import { createSafeTrackPlan, type TrackFeaturePlan, type TrackPlan } from '../src/rides/roller-coaster/trackPlan.ts';
import { generateTrackMap, TRACK_LOCAL_BOUNDS, validateTrackMap } from '../src/rides/roller-coaster/trackMap.ts';

const evidence = { source:'structure-analysis', summary:'synthetic bounded evidence', sectionIds:['s'], boundaryIds:['b'], arrangementChangeIds:[], recurrenceGroup:'A', energyBefore:.3, energyAfter:.8, energySlope:.02, contrast:.8, importance:.8, rhythmConfidence:.9, releaseProxy:.8 } as const;
const types = ['station','lift','crest','drop','run','loop','runout'] as const;
const features: TrackFeaturePlan[] = types.map((type,index)=>({ id:`f-${type}`, type, startTime:index*10, endTime:(index+1)*10, strength:.75, scale:.72, motif:type==='run'?'recurrence-A':'major', sourceEvidence:evidence }));
const plan: TrackPlan = { version:'9f.1', id:'plan-all', audioMapId:'synthetic', duration:70, generationSource:'structure-analysis', fallbackUsed:false,
  phraseProxy:{name:'beat-block phrase proxy',beatBlockSize:16,blockDuration:8,confidence:.8,formalPhraseAnalysis:false}, macroEnergy:[{time:35,energy:.6,slope:0}], budget:{total:12,major:6,loops:1}, features, valid:true,error:null };
const track = generateTrackMap(plan);
const segment = (kind: string) => track.route.segments.find(item=>item.kind===kind)!;

test('TrackPlan converts to a valid TrackMap',()=>assert.equal(track.valid,true));
test('canonical TrackMap positions are finite',()=>track.points.forEach(point=>Object.values(point).forEach(value=>assert.ok(Number.isFinite(value)))));
test('sampled tangents are finite and normalized',()=>track.route.pieces.forEach(piece=>[0,.5,1].forEach(f=>{const v=piece.geometry.sampleTangent(piece.geometry.length*f); assert.ok(Object.values(v).every(Number.isFinite)); assert.ok(Math.abs(magnitude(v)-1)<1e-5);})));
test('sampled up vectors are finite and perpendicular',()=>track.route.pieces.forEach(piece=>[0,.5,1].forEach(f=>{const u=piece.geometry.sampleUp(piece.geometry.length*f); const t=piece.geometry.sampleTangent(piece.geometry.length*f); assert.ok(Object.values(u).every(Number.isFinite)); assert.ok(Math.abs(dot(u,t))<1e-4);})));
test('total route length is positive',()=>assert.ok(track.totalLength>0));
test('every route piece has positive length',()=>track.route.pieces.forEach(piece=>assert.ok(piece.geometry.length>0)));
test('all route joins are position continuous',()=>track.route.pieces.slice(0,-1).forEach((piece,index)=>assert.ok(magnitude(sub(piece.geometry.samplePosition(piece.geometry.length),track.route.pieces[index+1].geometry.samplePosition(0)))<1e-4)));
test('all ordinary route joins are tangent continuous',()=>track.route.pieces.slice(0,-1).forEach((piece,index)=>assert.ok(dot(piece.geometry.sampleTangent(piece.geometry.length),track.route.pieces[index+1].geometry.sampleTangent(0))>.98)));
test('TrackMap contains no NaN or Infinity',()=>track.route.pieces.forEach(piece=>[0,.2,.4,.6,.8,1].forEach(f=>Object.values(piece.geometry.samplePosition(piece.geometry.length*f)).forEach(Number.isFinite))));
test('whole-route normalization stays in canonical horizontal bounds',()=>{assert.ok(track.bounds.minX>=TRACK_LOCAL_BOUNDS.minX-1e-6);assert.ok(track.bounds.maxX<=TRACK_LOCAL_BOUNDS.maxX+1e-6);});
test('Station semantic segment exists',()=>assert.ok(segment('Station')));
test('Lift geometry rises in actor-local space',()=>{const s=segment('Lift');assert.ok(s.exitFrame.position.y<s.entryFrame.position.y);});
test('Drop geometry descends in actor-local space',()=>{const s=segment('Drop');assert.ok(s.exitFrame.position.y>s.entryFrame.position.y);});
test('Loop geometry has a recognizable bounded vertical excursion',()=>{const s=segment('Loop');const ys=Array.from({length:65},(_,i)=>s.geometry.samplePosition(s.geometry.length*i/64).y);assert.ok(Math.max(...ys)-Math.min(...ys)>25);assert.ok(Math.max(...ys)-Math.min(...ys)<TRACK_LOCAL_BOUNDS.maxY-TRACK_LOCAL_BOUNDS.minY);});
test('Runout segment remains finite and valid',()=>{const s=segment('Runout');assert.ok(s.geometry.length>0);assert.ok(Object.values(s.exitFrame.position).every(Number.isFinite));});
test('route sampling works from zero through total length',()=>{for(let i=0;i<=100;i++){const frame=sampleRoute(track.route,track.totalLength*i/100);assert.ok(Object.values(frame.position).every(Number.isFinite));}});
test('rider samples remain finite at every generated segment boundary',()=>track.route.pieces.forEach(piece=>assert.ok(Object.values(sampleRoute(track.route,piece.start).position).every(Number.isFinite))));
test('same TrackPlan produces deterministic geometry identity and points',()=>{const other=generateTrackMap(plan);assert.equal(track.id,other.id);assert.deepEqual(track.points,other.points);});
test('safe fallback plan generates valid geometry',()=>{const fallback=generateTrackMap(createSafeTrackPlan({id:'weak',duration:60}));assert.equal(validateTrackMap(fallback),true);assert.equal(fallback.fallbackUsed,true);});
test('feature provenance survives into geometry segments',()=>track.segments.forEach(item=>assert.equal(item.sourceEvidence.summary,'synthetic bounded evidence')));
test('geometry uses one global normalization scale',()=>assert.ok(Number.isFinite(track.normalizationScale)&&track.normalizationScale>0));
test('route exposes actual feature distance ranges',()=>track.segments.forEach(item=>assert.ok(item.endDistance>item.startDistance)));
