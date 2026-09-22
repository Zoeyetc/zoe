import { useEffect, useState } from 'react';
import { ControlSurface } from '../control/ControlSurface';
import { DebugConsole } from '../debug/DebugConsole';
import { CarouselView } from '../rides/carousel/CarouselView';
import { BumperCarsView } from '../rides/bumper-cars/BumperCarsView';
import { PirateShipView } from '../rides/pirate-ship/PirateShipView';
import { TestReceiverView } from '../physics/TestReceiverView';
import { createExperience } from './createExperience';

export function App() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || new URLSearchParams(window.location.search).has('reduce-motion');
  const [experience] = useState(() => createExperience(
    () => performance.now() / 1000,
    reduceMotion,
  ));
  const [state, setState] = useState(() => experience.read());
  useEffect(() => {
    // Low-rate instrumentation refresh, not a transport or simulation clock.
    const timer = window.setInterval(() => setState(experience.read()), 100);
    return () => { window.clearInterval(timer); experience.dispose(); };
  }, [experience]);

  return <main>
    <h1>Z.land Music Box</h1>
    <p>Milestone 3A · first shared PhysicsWorld causality</p>
    <ControlSurface transport={state.frame.snapshot.transport} actions={experience.actions} />
    <CarouselView state={state.carousel} />
    <div className="physics-demo">
      <BumperCarsView state={state.bumperCars} />
      <TestReceiverView state={state.receiver} />
    </div>
    <PirateShipView state={state.pirateShip} />
    <DebugConsole state={state} />
  </main>;
}
