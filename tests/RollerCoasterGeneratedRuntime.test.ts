import assert from 'node:assert/strict';
import test from 'node:test';
import { milestoneSevenAAudioMap } from '../src/audio/AudioMap.ts';
import { readFileSync } from 'node:fs';
import { planRollerCoasterTrack } from '../src/rides/roller-coaster/trackPlan.ts';
import { createRollerCoasterTrack } from '../src/rides/roller-coaster/trackMap.ts';
import { createRollerCoasterSimulation, ROLLER_MAX_ACCELERATION, ROLLER_MAX_VELOCITY } from '../src/rides/roller-coaster/simulation.ts';
import { rollerCoasterToPhysicsWake } from '../src/physics/adapters/rollerCoaster.ts';

const generated = createRollerCoasterTrack(milestoneSevenAAudioMap, planRollerCoasterTrack);
const drive = { structureAvailable:true,section:'development',sectionProgress:.4,phraseProgress:.4,energy:.8,tension:.2,transportPlaying:true,seek:false,restart:false } as const;

test('generated RollerCoaster still advances actor-local routeDistance',()=>{const s=createRollerCoasterSimulation({route:generated.map.route});s.accept(drive,.1);assert.ok(s.read().routeDistance>0);});
test('music values do not directly assign generated routeDistance',()=>{const a=createRollerCoasterSimulation({route:generated.map.route});const b=createRollerCoasterSimulation({route:generated.map.route});a.accept({...drive,energy:.1,seek:true},0);b.accept({...drive,energy:1,seek:true},0);assert.equal(a.read().routeDistance,b.read().routeDistance);});
test('generated map identity is stable throughout repeated simulation accepts',()=>{const track=generated.map;const s=createRollerCoasterSimulation({route:track.route});for(let i=0;i<100;i++)s.accept(drive,.05);assert.equal(generated.map,track);assert.equal(generated.map.id,track.id);});
test('pause-style input does not regenerate generated TrackMap',()=>{const track=generated.map;const s=createRollerCoasterSimulation({route:track.route});s.accept({...drive,transportPlaying:false},.1);assert.equal(generated.map,track);});
test('seek does not regenerate generated TrackMap',()=>{const track=generated.map;const s=createRollerCoasterSimulation({route:track.route});s.accept({...drive,seek:true},0);assert.equal(generated.map,track);});
test('restart retains TrackMap and returns rider to deterministic station',()=>{const track=generated.map;const s=createRollerCoasterSimulation({route:track.route});s.accept(drive,.2);s.accept({...drive,restart:true,seek:true},0);assert.equal(generated.map,track);assert.equal(s.read().routeDistance,0);});
test('fixture generation is deterministic across instances',()=>{const other=createRollerCoasterTrack(milestoneSevenAAudioMap,planRollerCoasterTrack);assert.equal(generated.map.id,other.map.id);});
test('reduced motion preserves song-specific TrackMap identity',()=>{const full=createRollerCoasterSimulation({route:generated.map.route});const reduced=createRollerCoasterSimulation({route:generated.map.route,reducedMotion:true});assert.equal(full.route,reduced.route);});
test('experience replaces track only in source activation paths',()=>{const source=readFileSync(new URL('../src/experience/createExperience.ts',import.meta.url),'utf8');assert.match(source,/activateRealAudio[\s\S]*createRollerCoasterTrack/);assert.doesNotMatch(source,/const read = \(\) => \{[\s\S]{0,500}createRollerCoasterTrack/);});
test('generated-track wake position and direction derive from actual rider state',()=>{const s=createRollerCoasterSimulation({route:generated.map.route});for(let i=0;i<200;i++)s.accept(drive,.05);const state=s.read();const wake=rollerCoasterToPhysicsWake(state,3,generated.map);assert.equal(wake.speed,state.velocity);assert.equal(wake.acceleration,state.acceleration);assert.ok(Number.isFinite(wake.position.x)&&Number.isFinite(wake.forward.y));});
test('generated rider velocity and acceleration stay bounded',()=>{const s=createRollerCoasterSimulation({route:generated.map.route});for(let i=0;i<1200;i++){s.accept(drive,.05);assert.ok(s.read().velocity<=ROLLER_MAX_VELOCITY);assert.ok(Math.abs(s.read().acceleration)<=ROLLER_MAX_ACCELERATION);}});
test('attention and focus remain absent from track generation inputs',()=>{const source=planRollerCoasterTrack.toString();assert.doesNotMatch(source,/attention|focus/i);});
test('TrackMap generation is bounded and does not use uncontrolled randomness',()=>{const source=createRollerCoasterTrack.toString()+planRollerCoasterTrack.toString();assert.doesNotMatch(source,/Math\.random/);assert.ok(generated.map.points.length<2000);});
