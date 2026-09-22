import { createPreviewAudioClock } from '../audio/AudioClock';
import { milestoneTwoBAudioMap } from '../audio/AudioMap';
import { createAudioWorld } from '../audio/AudioWorld';
import type { ControlActions } from '../control/types';
import { createPhysicsWorld } from '../physics/PhysicsWorld';
import { createAnchoredReceiver } from '../physics/AnchoredReceiver';
import { bumperCollisionToWorldImpact } from '../physics/adapters/bumperCars';
import { toCarouselInput } from '../rides/carousel/adapter';
import { createCarouselSimulation } from '../rides/carousel/simulation';
import { toBumperCarsInput } from '../rides/bumper-cars/adapter';
import { createBumperCarsSimulation } from '../rides/bumper-cars/simulation';
import { toPirateShipInput } from '../rides/pirate-ship/adapter';
import { createPirateShipSimulation } from '../rides/pirate-ship/simulation';

/** Composition only: systems keep their own state and ownership. */
export function createExperience(now: () => number, reducedMotion = false) {
  const clock = createPreviewAudioClock(milestoneTwoBAudioMap.duration, now);
  const world = createAudioWorld(milestoneTwoBAudioMap);
  const melodyMidi = (milestoneTwoBAudioMap.melody ?? []).map(note => note.midi);
  const carousel = createCarouselSimulation({
    reducedMotion,
    pitchRange: { min: Math.min(...melodyMidi), max: Math.max(...melodyMidi) },
  });
  const bumperCars = createBumperCarsSimulation({ seed: 2048, reducedMotion });
  const pirateShip = createPirateShipSimulation({ reducedMotion });
  const physicsWorld = createPhysicsWorld();
  const receiver = createAnchoredReceiver({ position: { x: 0.5, y: 0.5 }, reducedMotion });
  const unregisterSource = physicsWorld.registerSource('bumper-cars');
  const unregisterReceiver = physicsWorld.registerReceiver(receiver.registration);
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
    receiver.step(dt);
    pirateShip.accept(toPirateShipInput(frame), dt);
    return {
      frame, recentEvents, carousel: carousel.read(), bumperCars: bumperCars.read(), pirateShip: pirateShip.read(),
      physics: physicsWorld.read(), receiver: receiver.read(), seed: bumperCars.read().seed,
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
    if (time === 0) { physicsWorld.clear(); receiver.reset(); }
  };
  const actions: ControlActions = {
    play: () => clock.play(),
    pause: () => clock.pause(),
    seek,
    restart: () => seek(0),
  };
  return {
    read, actions,
    dispose: () => { clock.pause(); unregisterReceiver(); unregisterSource(); },
  };
}

export type ExperienceState = ReturnType<ReturnType<typeof createExperience>['read']>;
