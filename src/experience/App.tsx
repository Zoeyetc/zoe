import { useEffect, useRef, useState } from 'react';
import { ControlSurface } from '../control/ControlSurface';
import { DebugConsole } from '../debug/DebugConsole';
import { CarouselView } from '../rides/carousel/CarouselView';
import { BumperCarsView } from '../rides/bumper-cars/BumperCarsView';
import { PirateShipView } from '../rides/pirate-ship/PirateShipView';
import { PhysicsDebugOverlay } from '../physics/PhysicsDebugOverlay';
import { AnchoredContentView } from '../physics/AnchoredContentView';
import { FerrisWheelView } from '../rides/ferris-wheel/FerrisWheelView';
import { DropTowerView } from '../rides/drop-tower/DropTowerView';
import { RollerCoasterView } from '../rides/roller-coaster/RollerCoasterView';
import { FreeBodiesView } from '../free-bodies/FreeBodiesView';
import { createExperience } from './createExperience';

export function App() {
  const physicsStageRef = useRef<HTMLDivElement>(null);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || new URLSearchParams(window.location.search).has('reduce-motion');
  const showPhysicsDebug = !new URLSearchParams(window.location.search).has('hide-physics-debug');
  const [experience] = useState(() => createExperience(
    () => performance.now() / 1000,
    reduceMotion,
  ));
  const [state, setState] = useState(() => experience.read());
  useEffect(() => {
    // Low-rate instrumentation refresh, not a transport or simulation clock.
    const timer = window.setInterval(() => setState(experience.read()), 100);
    // App is the root owner of this in-memory experience. React development remounts
    // effects without discarding that owner, so only the UI timer belongs to this effect.
    return () => window.clearInterval(timer);
  }, [experience]);

  return <main>
    <h1>Z.land Music Box</h1>
    <p>Milestone 7A · Free Bodies / Orb</p>
    <ControlSurface transport={state.frame.snapshot.transport} actions={experience.actions} />
    <CarouselView state={state.carousel} />
    <FerrisWheelView state={state.ferrisWheel} />
    <DropTowerView state={state.dropTower} />
    <RollerCoasterView state={state.rollerCoaster} />
    <FreeBodiesView state={state.freeBodies} />
    <div className="physics-demo">
      <BumperCarsView state={state.bumperCars} stageRef={physicsStageRef}
        debugOverlay={showPhysicsDebug
          ? <PhysicsDebugOverlay arena={state.bumperCars.arena} physics={state.physics}
            receiver={state.content} freeBodies={state.freeBodies} />
          : null}
        stageContent={<AnchoredContentView state={state.content} worldElementRef={physicsStageRef}
          onLayout={experience.updateContentLayout} />} />
    </div>
    <PirateShipView state={state.pirateShip} />
    <DebugConsole state={state} />
  </main>;
}
