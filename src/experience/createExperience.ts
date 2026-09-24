import { createPreviewAudioClock, type AudioClock } from '../audio/AudioClock';
import { milestoneSevenAAudioMap } from '../audio/AudioMap';
import { createAudioWorld, lookupSnapshot } from '../audio/AudioWorld';
import type { ControlActions } from '../control/types';
import { createPhysicsWorld } from '../physics/PhysicsWorld';
import { createAnchoredContentParticipant, type WorldBounds } from '../physics/AnchoredContentParticipant';
import { bumperCollisionToWorldImpact } from '../physics/adapters/bumperCars';
import { rollerCoasterToPhysicsWake, ROLLER_WAKE_SOURCE_ID } from '../physics/adapters/rollerCoaster';
import { toCarouselInput } from '../rides/carousel/adapter';
import { createCarouselSimulation } from '../rides/carousel/simulation';
import { toBumperCarsInput } from '../rides/bumper-cars/adapter';
import { createBumperCarsSimulation } from '../rides/bumper-cars/simulation';
import { toPirateShipInput } from '../rides/pirate-ship/adapter';
import { createPirateShipSimulation } from '../rides/pirate-ship/simulation';
import { toFerrisWheelInput } from '../rides/ferris-wheel/adapter';
import { createFerrisWheelSimulation } from '../rides/ferris-wheel/simulation';
import { createDropTowerSimulation } from '../rides/drop-tower/simulation';
import { createDropTowerStructureInterpreter } from '../rides/drop-tower/realStructureAdapter';
import { toRollerCoasterInput } from '../rides/roller-coaster/adapter';
import { createRollerCoasterSimulation } from '../rides/roller-coaster/simulation';
import { planRollerCoasterTrack } from '../rides/roller-coaster/trackPlan';
import { createRollerCoasterTrack } from '../rides/roller-coaster/trackMap';
import { toFreeBodiesInput } from '../free-bodies/adapter';
import { createFreeBodiesSimulation, FREE_BODIES_SEED } from '../free-bodies/simulation';
import { PARK_BUMPER_CARS_BOUNDS, PARK_ROLLER_COASTER_BOUNDS } from './park/config';
import { createAudioBufferPlaybackTransport, type AudioPlaybackTransport } from '../audio/AudioPlaybackTransport';
import type { AudioPreparationState, PreparedRealAudio } from '../audio/AudioPreparationController';
import type { AudioMap } from '../audio/types';
import { createParkPulse, PARK_PULSE_SOURCE_ID } from '../physics/ParkPulse';
import type { SignalConsoleObservation } from '../signal-console/types';
import { selectMelodyEvidenceForTransport } from '../audio/melody-evidence/selectMelodyEvidence.ts';
import { LIVE_INPUT_WINDOW_SECONDS, type LiveAnalysisUpdate, type LiveInputState } from '../audio/live/types';
import type { TransportState } from '../audio/types';

/** Composition only: systems keep their own state and ownership. */
export function createExperience(now: () => number, reducedMotion = false, fixtureMap: AudioMap = milestoneSevenAAudioMap) {
  let clock: AudioClock | AudioPlaybackTransport = createPreviewAudioClock(fixtureMap.duration, now);
  let activeMap: AudioMap = fixtureMap;
  let mapRevision = 0;
  let world = createAudioWorld(activeMap);
  let preparation: AudioPreparationState = {
    sourceMode: 'fixture', filename: null, duration: activeMap.duration,
    decodeState: 'idle', analysisState: 'idle', error: null, requestId: 0,
  };
  const melodyMidi = (milestoneSevenAAudioMap.melody ?? []).map(note => note.midi);
  const carousel = createCarouselSimulation({
    reducedMotion,
    pitchRange: { min: Math.min(...melodyMidi), max: Math.max(...melodyMidi) },
  });
  const bumperCars = createBumperCarsSimulation({ seed: 2048, reducedMotion });
  const pirateShip = createPirateShipSimulation({ reducedMotion });
  const ferrisWheel = createFerrisWheelSimulation({ reducedMotion });
  const dropTower = createDropTowerSimulation({ reducedMotion });
  const dropTowerStructure = createDropTowerStructureInterpreter();
  let rollerCoasterTrack = createRollerCoasterTrack(activeMap, planRollerCoasterTrack);
  let rollerCoaster = createRollerCoasterSimulation({ reducedMotion, route: rollerCoasterTrack.map.route });
  const freeBodies = createFreeBodiesSimulation({ seed: FREE_BODIES_SEED, reducedMotion });
  const physicsWorld = createPhysicsWorld();
  const parkPulse = createParkPulse();
  const content = createAnchoredContentParticipant({
    id: 'zland-content-card',
    bounds: { x: 0.36, y: 0.7, width: 0.28, height: 0.16 },
    reducedMotion,
    maxDisplacement: 0.035,
    maxRotation: 0.06,
    // Temporary QA amplification, separate from the conservative content response bounds above.
    debugResponseGain: 1.6,
  });
  const unregisterBumperSource = physicsWorld.registerSource('bumper-cars');
  const unregisterRollerSource = physicsWorld.registerSource(ROLLER_WAKE_SOURCE_ID);
  const unregisterParkPulseSource = physicsWorld.registerSource(PARK_PULSE_SOURCE_ID);
  const unregisterReceiver = physicsWorld.registerReceiver(content.registration);
  const unregisterFreeBodies = freeBodies.registrations.map(registration => physicsWorld.registerReceiver(registration));
  let frame = world.read(clock.read());
  let recentEvents = frame.events;
  let previousSimulationTime = now();
  let liveTransport: (() => TransportState) | null = null;
  let liveState: LiveInputState | null = null;

  const read = () => {
    if (liveTransport) frame = { snapshot: lookupSnapshot(activeMap, liveTransport()), events: [] };
    else frame = world.read(clock.read());
    const simulationTime = now();
    const dt = simulationTime - previousSimulationTime;
    previousSimulationTime = simulationTime;
    if (frame.events.length) recentEvents = [...recentEvents, ...frame.events].slice(-8);
    carousel.accept(toCarouselInput(frame), dt);
    bumperCars.accept(toBumperCarsInput(frame), dt);
    for (const collision of bumperCars.drainCollisions()) {
      physicsWorld.publishImpact(bumperCollisionToWorldImpact(
        collision,
        bumperCars.read().arena,
        PARK_BUMPER_CARS_BOUNDS,
      ));
    }
    pirateShip.accept(toPirateShipInput(frame), dt);
    ferrisWheel.accept(toFerrisWheelInput(frame), dt);
    dropTower.accept(dropTowerStructure.accept(frame, dt), dt);
    rollerCoaster.accept(toRollerCoasterInput(frame), dt);
    physicsWorld.updateWake(rollerCoasterToPhysicsWake(
      rollerCoaster.read(), simulationTime, rollerCoasterTrack.map, PARK_ROLLER_COASTER_BOUNDS,
    ), dt);
    parkPulse.accept(frame, dt);
    physicsWorld.updatePulse(parkPulse.toPhysicsPulse(simulationTime), dt);
    freeBodies.accept(toFreeBodiesInput(frame), dt);
    content.step(dt);
    const playback = 'diagnostics' in clock ? clock.diagnostics() : null;
    return {
      frame, recentEvents, carousel: carousel.read(), bumperCars: bumperCars.read(), pirateShip: pirateShip.read(),
      ferrisWheel: ferrisWheel.read(),
      dropTower: dropTower.read(),
      rollerCoaster: rollerCoaster.read(),
      rollerCoasterTrackPlan: rollerCoasterTrack.plan,
      rollerCoasterTrackMap: rollerCoasterTrack.map,
      freeBodies: freeBodies.read(),
      parkPulse: parkPulse.read(),
      physics: physicsWorld.read(), content: content.read(), seed: bumperCars.read().seed,
      audio: {
        preparation,
        contextState: playback?.contextState ?? 'not-created',
        musicalTime: frame.snapshot.transport.time,
        playbackOffset: playback?.playbackOffset ?? frame.snapshot.transport.time,
        sourceNodeState: playback?.sourceNodeState ?? (frame.snapshot.transport.playing ? 'fixture-playing' : 'fixture-idle'),
        source: activeMap.source ?? { kind: 'fixture' as const, filename: null, mimeType: null },
        analysis: activeMap.analysis ?? null,
        rhythmAnalysis: activeMap.rhythmAnalysis ?? null,
        percussion: activeMap.percussion,
        percussionAnalysis: activeMap.percussionAnalysis ?? null,
        melodyAnalysis: activeMap.melodyAnalysis ?? null,
        harmonyAnalysis: activeMap.harmonyAnalysis ?? null,
        tonalCenterAnalysis: activeMap.tonalCenterAnalysis ?? null,
        structureAnalysis: activeMap.structureAnalysis ?? null,
      },
    };
  };
  const seek = (time: number) => {
    const from = clock.read().time;
    clock.seek(time);
    frame = world.synchronize(from, clock.read());
    recentEvents = frame.events;
    previousSimulationTime = now();
    carousel.accept(toCarouselInput(frame), 0);
    bumperCars.accept(toBumperCarsInput(frame), 0);
    pirateShip.accept(toPirateShipInput(frame), 0);
    ferrisWheel.accept(toFerrisWheelInput(frame), 0);
    dropTower.accept(dropTowerStructure.accept(frame, 0), 0);
    rollerCoaster.accept(toRollerCoasterInput(frame), 0);
    physicsWorld.updateWake(rollerCoasterToPhysicsWake(
      rollerCoaster.read(), now(), rollerCoasterTrack.map, PARK_ROLLER_COASTER_BOUNDS,
    ), 0);
    parkPulse.accept(frame, 0);
    physicsWorld.updatePulse(parkPulse.toPhysicsPulse(now()), 0);
    freeBodies.accept(toFreeBodiesInput(frame), 0);
    if (time === 0) { parkPulse.reset(); physicsWorld.clear(); content.reset(); }
  };
  const actions: ControlActions = {
    play: () => clock.play(),
    pause: () => clock.pause(),
    seek,
    restart: () => seek(0),
  };
  const stopClock = () => {
    if ('dispose' in clock) clock.dispose();
    else clock.pause();
  };
  const synchronizeNewSource = () => {
    frame = world.synchronize(0, clock.read());
    recentEvents = frame.events;
    previousSimulationTime = now();
    carousel.accept(toCarouselInput(frame), 0);
    bumperCars.accept(toBumperCarsInput(frame), 0);
    pirateShip.accept(toPirateShipInput(frame), 0);
    ferrisWheel.accept(toFerrisWheelInput(frame), 0);
    dropTowerStructure.reset();
    dropTower.reset();
    dropTower.accept(dropTowerStructure.accept(frame, 0), 0);
    rollerCoaster.accept(toRollerCoasterInput(frame), 0);
    parkPulse.reset();
    parkPulse.accept(frame, 0);
    freeBodies.accept(toFreeBodiesInput(frame), 0);
    physicsWorld.clear();
    content.reset();
  };
  return {
    read, actions,
    observeSignalConsole: (): SignalConsoleObservation => {
      const transport = liveTransport ? liveTransport() : clock.read();
      return {
        mapRevision,
        transport,
        audioMap: activeMap,
        melodyEvidence: selectMelodyEvidenceForTransport(activeMap.melodyEvidence, transport),
        live: liveState,
      };
    },
    setAudioPreparationState: (next: AudioPreparationState) => { preparation = next; },
    activateRealAudio(prepared: PreparedRealAudio) {
      const nextRollerCoasterTrack = createRollerCoasterTrack(prepared.map, planRollerCoasterTrack);
      const nextRollerCoaster = createRollerCoasterSimulation({ reducedMotion, route: nextRollerCoasterTrack.map.route });
      stopClock();
      liveTransport = null; liveState = null;
      activeMap = prepared.map;
      mapRevision += 1;
      rollerCoasterTrack = nextRollerCoasterTrack;
      rollerCoaster = nextRollerCoaster;
      world = createAudioWorld(activeMap);
      clock = createAudioBufferPlaybackTransport(prepared.context, prepared.buffer);
      const analyzedRange = activeMap.melodyAnalysis?.pitchRange;
      if (analyzedRange && analyzedRange.minMidi !== null && analyzedRange.maxMidi !== null) {
        carousel.setPitchRange({ min: analyzedRange.minMidi, max: analyzedRange.maxMidi });
      }
      preparation = { ...preparation, sourceMode: 'real-audio', filename: activeMap.source?.filename ?? null,
        duration: activeMap.duration, decodeState: 'ready', analysisState: 'ready', error: null };
      synchronizeNewSource();
    },
    activateFixture() {
      stopClock();
      liveTransport = null; liveState = null;
      activeMap = fixtureMap;
      mapRevision += 1;
      rollerCoasterTrack = createRollerCoasterTrack(activeMap, planRollerCoasterTrack);
      rollerCoaster = createRollerCoasterSimulation({ reducedMotion, route: rollerCoasterTrack.map.route });
      world = createAudioWorld(activeMap);
      clock = createPreviewAudioClock(activeMap.duration, now);
      carousel.setPitchRange({ min: Math.min(...melodyMidi), max: Math.max(...melodyMidi) });
      preparation = { sourceMode: 'fixture', filename: null, duration: activeMap.duration,
        decodeState: 'idle', analysisState: 'idle', error: null, requestId: preparation.requestId };
      synchronizeNewSource();
    },
    startLiveInput(readTransport: () => TransportState, state: LiveInputState) {
      stopClock(); liveTransport = readTransport; liveState = state; recentEvents = [];
      const transport = readTransport();
      activeMap = {
        version: 1, id: `live-input-warmup-${mapRevision + 1}`,
        duration: Math.max(1, transport.time + LIVE_INPUT_WINDOW_SECONDS),
        capabilities: { melody: false, rhythm: false, percussion: false, harmony: false,
          tonalCenter: false, structure: false, spectrum: false },
        melody: null, percussion: null, rhythm: null, harmony: null, structure: null, drops: null,
        spectrum: [], amplitude: [],
        source: { kind: 'live-input', filename: null, mimeType: 'audio/x-live-input',
          deviceId: state.selectedDeviceId, deviceLabel: state.deviceLabel },
      };
      mapRevision += 1; frame = { snapshot: lookupSnapshot(activeMap, transport), events: [] };
      previousSimulationTime = now();
    },
    updateLiveInput(update: LiveAnalysisUpdate) {
      if (!liveTransport) return;
      activeMap = update.map; liveState = update.state; mapRevision += 1;
      frame = { snapshot: lookupSnapshot(activeMap, liveTransport()), events: update.events };
      if (update.events.length) recentEvents = [...recentEvents, ...update.events].slice(-8);
    },
    updateLiveInputState(state: LiveInputState) {
      if (!liveTransport) return;
      const previous = liveState;
      const preserveListeners = previous && (state.status === 'STOPPED' || state.status === 'DEVICE_LOST');
      liveState = preserveListeners ? { ...state, listeners: previous.listeners } : state;
    },
    stopLiveInput(state: LiveInputState) {
      const listeners = liveState?.listeners ?? state.listeners;
      liveState = { ...state, listeners };
      if (liveTransport) frame = { snapshot: lookupSnapshot(activeMap, liveTransport()), events: [] };
    },
    updateContentLayout: (bounds: WorldBounds) => content.updateLayout(bounds),
    dispose: () => {
      stopClock();
      unregisterFreeBodies.forEach(unregister => unregister());
      unregisterReceiver(); unregisterParkPulseSource(); unregisterRollerSource(); unregisterBumperSource();
    },
  };
}

export type ExperienceState = ReturnType<ReturnType<typeof createExperience>['read']>;
