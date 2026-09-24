import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import type { AttentionState } from '../apps/zland/src/experience/attention.ts';
import type { ExperienceState } from '../apps/zland/src/experience/createExperience.ts';
import { PARK_FOCUS_BOUNDS, PARK_OVERVIEW_VIEWPORT, focusViewport } from '../apps/zland/src/experience/park/config.ts';
import { resolveAnnotationAnchors, annotationSafeZones } from '../apps/zland/src/experience/annotations/annotationAnchors.ts';
import { annotationBlocksOverlap, resolveAnnotationLayout, transformAnnotationPoint, visibleWorldBounds } from '../apps/zland/src/experience/annotations/annotationLayout.ts';
import { buildAnnotationModels } from '../apps/zland/src/experience/annotations/annotationModels.ts';
import { annotationPresentationHz, compactAngle, compactSigned, compactUnit } from '../apps/zland/src/experience/annotations/formatAnnotation.ts';
import { rollerCoasterRoute } from '../apps/zland/src/rides/roller-coaster/route.ts';

const roles = {
  carousel: 'primary', ferrisWheel: 'secondary', pirateShip: 'ambient',
  bumperCars: 'ambient', dropTower: 'secondary', rollerCoaster: 'secondary',
} as const;
const attention = (focusActorId: keyof typeof roles | null = null): AttentionState => ({
  mode: focusActorId ? 'focus' : 'overview', focusActorId, primaryActorId: 'carousel', roles,
  transition: 'stable', primarySince: 0, reducedMotion: false,
  diagnostics: { source: 'structure', scores: {} as never, decision: 'fixture', holdRemaining: 0 },
});

function fixtureState(): ExperienceState {
  const rider = (index: number) => ({ index, degree: index + 1, position: index === 2 ? .65 : 0,
    velocity: 0, target: 0, active: index === 2 });
  return {
    frame: { snapshot: {
      transport: { time: 4, duration: 24, playing: true },
      melody: { available: true, active: true, source: 'predominant-analysis', confidence: .81,
        scaleDegree: { tonicPitchClass: 0 } },
      harmony: { available: true, active: true }, rhythm: { available: true },
      percussion: { available: true }, structure: { available: true },
    }, events: [] },
    recentEvents: [{ id: 'kick-1', type: 'kick', time: 3.9, strength: .82, confidence: .76 }],
    carousel: { activeRider: 2, riders: Array.from({ length: 8 }, (_, index) => rider(index)), baseAngle: .4,
      activeNoteName: 'E4', activeMidi: 64, displayDegree: 'III', chromaticMarker: { visible: false, offset: null } },
    ferrisWheel: { chord: 'C major', tonalRootPitchClass: 0, confidence: .74, activeCabinIds: [0, 4, 7],
      tonalMode: 'major', targetWheelAngle: 1.2, wheelAngle: 1.1, wheelAngularVelocity: .018 },
    pirateShip: { bpm: 124, beatPhase: .63, groove: .42, swing: .16, angle: -.304, angularVelocity: .18, driveTorque: .22 },
    bumperCars: { latestPercussion: 'kick', eventStrength: .82, collisionCount: 3, selectedBody: 0,
      arena: { width: 560, height: 280 }, bodies: [{ id: 0, x: 90, y: 80, role: 'kick', vx: 12, vy: 5, angularVelocity: .2 }] },
    dropTower: { section: 'B′', sectionProgress: .7, build: .72, tension: .84, phase: 'HOLDING',
      position: .14, velocity: -.03, drive: { release: .12, cooldownRemaining: 0 } },
    rollerCoaster: { routeDistance: 20, currentSegment: 'Lift', velocity: 128, acceleration: 18,
      structureAvailable: true, mode: 'driven', section: 'B', energy: .76,
      riderPosition: rollerCoasterRoute.pieces[0].geometry.samplePosition(20) },
    rollerCoasterTrackMap: { id: 'track-map-test', route: rollerCoasterRoute, segments: [{
      featureId: 'lift-02', startDistance: 0, endDistance: 100,
      sourceEvidence: { sectionIds: ['B'], importance: .8 },
    }] },
    physics: { latestWake: { sourceId: 'roller-coaster', strength: .41 } },
  } as unknown as ExperienceState;
}

const value = (state: ExperienceState, actorId: keyof typeof roles, label: string, focused = false) =>
  buildAnnotationModels(state, attention(focused ? actorId : null))
    .find(model => model.actorId === actorId)!.fields.find(item => item.label === label)?.value;

test('annotation mappings expose current actor evidence and physical state', () => {
  const state = fixtureState();
  assert.equal(value(state, 'carousel', 'NOTE'), 'E4');
  assert.equal(value(state, 'carousel', 'DEGREE'), 'III');
  assert.equal(value(state, 'ferrisWheel', 'CHORD'), 'C MAJOR');
  assert.equal(value(state, 'ferrisWheel', 'TONIC'), 'C');
  assert.equal(value(state, 'pirateShip', 'BPM'), '124.0');
  assert.equal(value(state, 'bumperCars', 'LAST'), 'KICK');
  assert.equal(value(state, 'dropTower', 'SECTION'), 'B′');
  assert.equal(value(state, 'dropTower', 'STATE'), 'HOLDING');
  assert.equal(value(state, 'rollerCoaster', 'SEGMENT'), 'LIFT-02');
  assert.equal(value(state, 'rollerCoaster', 'WAKE'), '.41');
});

test('chromatic and unavailable evidence remain truthful neutral states', () => {
  const state = fixtureState() as unknown as Record<string, any>;
  state.carousel.displayDegree = null;
  state.carousel.chromaticMarker = { visible: true, offset: 1 };
  const chromatic = buildAnnotationModels(state as ExperienceState, attention())
    .find(item => item.actorId === 'carousel')!;
  assert.equal(chromatic.fields.find(item => item.label === 'DEGREE')?.value, '—');
  assert.equal(chromatic.fields.find(item => item.label === 'CHROM')?.value, '+1');
  state.frame.snapshot.melody.available = false;
  state.frame.snapshot.melody.active = false;
  const model = buildAnnotationModels(state as ExperienceState, attention()).find(item => item.actorId === 'carousel')!;
  assert.equal(model.state, 'unavailable');
  assert.equal(model.fields[0].value, '—');
  assert.equal(model.fields[1].value, 'LISTENING');
});

test('building annotation models is a read-only projection of source state', () => {
  const state = fixtureState();
  const before = JSON.stringify(state);
  buildAnnotationModels(state, attention());
  assert.equal(JSON.stringify(state), before);
});

test('Overview density is bounded and Focus expands only the selected actor', () => {
  const state = fixtureState();
  const overview = buildAnnotationModels(state, attention());
  assert.ok(overview.every(model => model.fields.length >= 1 && model.fields.length <= 4));
  const focused = buildAnnotationModels(state, attention('dropTower'));
  assert.equal(focused.find(model => model.actorId === 'dropTower')?.fields.length, 9);
  assert.ok(focused.filter(model => model.actorId !== 'dropTower').every(model => model.fields.length <= 3));
});

test('all canonical actor anchors are finite and dynamic anchors follow physical state', () => {
  const state = fixtureState();
  const first = resolveAnnotationAnchors(state);
  for (const anchor of Object.values(first)) assert.ok(Number.isFinite(anchor.x) && Number.isFinite(anchor.y));
  const changed = fixtureState() as unknown as Record<string, any>;
  changed.carousel.riders[2].position = .05;
  changed.dropTower.position = .9;
  changed.bumperCars.bodies[0].x = 400;
  const second = resolveAnnotationAnchors(changed as ExperienceState);
  assert.notDeepEqual(second.carousel, first.carousel);
  assert.notDeepEqual(second.dropTower, first.dropTower);
  assert.notDeepEqual(second.bumperCars, first.bumperCars);
});

test('anchor calculation is canonical and has no doodle perturbation input', () => {
  const source = readFileSync(new URL('../apps/zland/src/experience/annotations/annotationAnchors.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /doodle|roughness|jitter|seed/i);
});

test('Overview layout stays in frame, finite, deterministic, and non-overlapping', () => {
  const state = fixtureState();
  const models = buildAnnotationModels(state, attention());
  const zones = annotationSafeZones(resolveAnnotationAnchors(state));
  const first = resolveAnnotationLayout(models, PARK_OVERVIEW_VIEWPORT, zones);
  const second = resolveAnnotationLayout(models, PARK_OVERVIEW_VIEWPORT, zones);
  assert.deepEqual(first, second);
  assert.equal(first.length, 6);
  assert.equal(annotationBlocksOverlap(first), false);
  for (const item of first) {
    assert.ok(Object.values(item.block).every(Number.isFinite));
    assert.ok(item.block.x >= 0 && item.block.y >= 0);
    assert.ok(item.block.x + item.block.width <= 1 && item.block.y + item.block.height <= 1);
    assert.ok([item.anchor, item.elbow, item.attachment].flatMap(Object.values).every(Number.isFinite));
  }
});

test('focused annotation fits the focused visible world and endpoint transform remains aligned', () => {
  const state = fixtureState();
  const focused = buildAnnotationModels(state, attention('carousel')).filter(model => model.actorId === 'carousel');
  const viewport = focusViewport(PARK_FOCUS_BOUNDS.carousel);
  const layout = resolveAnnotationLayout(focused, viewport, annotationSafeZones(resolveAnnotationAnchors(state)));
  const visible = visibleWorldBounds(viewport);
  const block = layout[0].block;
  assert.ok(block.x >= visible.x && block.y >= visible.y);
  assert.ok(block.x + block.width <= visible.x + visible.width);
  assert.ok(block.y + block.height <= visible.y + visible.height);
  assert.deepEqual(transformAnnotationPoint(layout[0].anchor, viewport), {
    x: viewport.x + layout[0].anchor.x * viewport.scale,
    y: viewport.y + layout[0].anchor.y * viewport.scale,
  });
});

test('Attention role changes density without changing exact Musical Evidence', () => {
  const state = fixtureState();
  const primary = buildAnnotationModels(state, attention()).find(model => model.actorId === 'carousel')!;
  const ambientAttention = { ...attention(), roles: { ...roles, carousel: 'ambient' as const } };
  const ambient = buildAnnotationModels(state, ambientAttention).find(model => model.actorId === 'carousel')!;
  assert.equal(primary.fields[0].value, ambient.fields[0].value);
  assert.ok(ambient.fields.length < primary.fields.length);
  assert.equal(ambientAttention.roles.carousel, 'ambient');
});

test('formatting and update policy remain compact presentation concerns', () => {
  assert.equal(compactUnit(.738291), '.74');
  assert.equal(compactSigned(.018), '+.018');
  assert.equal(compactAngle(-.304), '-17.4°');
  assert.ok(annotationPresentationHz >= 10 && annotationPresentationHz <= 20);
});

test('annotation source contains no system writes, analysis, clock, or Park Train model', () => {
  const modelSource = readFileSync(new URL('../apps/zland/src/experience/annotations/annotationModels.ts', import.meta.url), 'utf8');
  const systemSource = readFileSync(new URL('../apps/zland/src/experience/annotations/LiveAnnotationSystem.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(modelSource, /createAudio|analyze|accept\(|registerSource|registerReceiver|publishImpact|AttentionState\s*=/);
  assert.doesNotMatch(systemSource, /AudioClock|setInterval|requestAnimationFrame|ParkTrain/);
});
