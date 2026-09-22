import { createPreviewAudioClock } from '../audio/AudioClock';
import { milestoneSevenAAudioMap } from '../audio/AudioMap';
import { createAudioWorld } from '../audio/AudioWorld';
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
import { toDropTowerInput } from '../rides/drop-tower/adapter';
import { createDropTowerSimulation } from '../rides/drop-tower/simulation';
import { toRollerCoasterInput } from '../rides/roller-coaster/adapter';
import { createRollerCoasterSimulation } from '../rides/roller-coaster/simulation';
import { toFreeBodiesInput } from '../free-bodies/adapter';
import { createFreeBodiesSimulation, FREE_BODIES_SEED } from '../free-bodies/simulation';

/** Composition only: systems keep their own state and ownership. */
export function createExperience(now: () => number, reducedMotion = false) {
  const clock = createPreviewAudioClock(milestoneSevenAAudioMap.duration, now);
  const world = createAudioWorld(milestoneSevenAAudioMap);
  const melodyMidi = (milestoneSevenAAudioMap.melody ?? []).map(note => note.midi);
  const carousel = createCarouselSimulation({
    reducedMotion,
    pitchRange: { min: Math.min(...melodyMidi), max: Math.max(...melodyMidi) },
  });
  const bumperCars = createBumperCarsSimulation({ seed: 2048, reducedMotion });
  const pirateShip = createPirateShipSimulation({ reducedMotion });
  const ferrisWheel = createFerrisWheelSimulation({ reducedMotion });
  const dropTower = createDropTowerSimulation({ reducedMotion });
  const rollerCoaster = createRollerCoasterSimulation({ reducedMotion });
  const freeBodies = createFreeBodiesSimulation({ seed: FREE_BODIES_SEED, reducedMotion });
  const physicsWorld = createPhysicsWorld();
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
  const unregisterReceiver = physicsWorld.registerReceiver(content.registration);
  const unregisterFreeBodies = freeBodies.registrations.map(registration => physicsWorld.registerReceiver(registration));
  let frame = world.read(clock.read());
  let recentEvents = frame.events;
  let previousSimulationTime = now();

  const read = () => {
    frame = world.read(clock.read());
    const simulationTime = now();
    const dt = simulationTime - previousSimulationTime;
    previousSimulationTime = simulationTime;
    if (frame.events.length) recentEvents = [...recentEvents, ...frame.events].slice(-8);
    carousel.accept(toCarouselInput(frame), dt);
    bumperCars.accept(toBumperCarsInput(frame), dt);
    for (const collision of bumperCars.drainCollisions()) {
      physicsWorld.publishImpact(bumperCollisionToWorldImpact(collision, bumperCars.read().arena));
    }
    pirateShip.accept(toPirateShipInput(frame), dt);
    ferrisWheel.accept(toFerrisWheelInput(frame), dt);
    dropTower.accept(toDropTowerInput(frame), dt);
    rollerCoaster.accept(toRollerCoasterInput(frame), dt);
    physicsWorld.updateWake(rollerCoasterToPhysicsWake(rollerCoaster.read(), simulationTime), dt);
    freeBodies.accept(toFreeBodiesInput(frame), dt);
    content.step(dt);
    return {
      frame, recentEvents, carousel: carousel.read(), bumperCars: bumperCars.read(), pirateShip: pirateShip.read(),
      ferrisWheel: ferrisWheel.read(),
      dropTower: dropTower.read(),
      rollerCoaster: rollerCoaster.read(),
      freeBodies: freeBodies.read(),
      physics: physicsWorld.read(), content: content.read(), seed: bumperCars.read().seed,
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
    dropTower.accept(toDropTowerInput(frame), 0);
    rollerCoaster.accept(toRollerCoasterInput(frame), 0);
    physicsWorld.updateWake(rollerCoasterToPhysicsWake(rollerCoaster.read(), now()), 0);
    freeBodies.accept(toFreeBodiesInput(frame), 0);
    if (time === 0) { physicsWorld.clear(); content.reset(); }
  };
  const actions: ControlActions = {
    play: () => clock.play(),
    pause: () => clock.pause(),
    seek,
    restart: () => seek(0),
  };
  return {
    read, actions,
    updateContentLayout: (bounds: WorldBounds) => content.updateLayout(bounds),
    dispose: () => {
      clock.pause();
      unregisterFreeBodies.forEach(unregister => unregister());
      unregisterReceiver(); unregisterRollerSource(); unregisterBumperSource();
    },
  };
}

export type ExperienceState = ReturnType<ReturnType<typeof createExperience>['read']>;
