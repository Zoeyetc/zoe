import { useCallback, useEffect, useRef, useState } from 'react';
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
import { ParkMap } from './park/ParkMap';
import { PARK_CONTENT_BOUNDS } from './park/config';
import { physicsDebugVisible, resolveExperienceMode } from './mode';
import { createAttentionController, type AttentionState } from './attention';

export function App() {
  const physicsStageRef = useRef<HTMLDivElement>(null);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || new URLSearchParams(window.location.search).has('reduce-motion');
  const mode = resolveExperienceMode(window.location.search);
  const showPhysicsDebug = physicsDebugVisible(window.location.search);
  const [experience] = useState(() => createExperience(
    () => performance.now() / 1000,
    reduceMotion,
  ));
  const [attention] = useState(() => createAttentionController(() => performance.now() / 1000, reduceMotion));
  const [state, setState] = useState(() => experience.read());
  const [attentionState, setAttentionState] = useState<AttentionState>(() => attention.read());
  const focusActor = useCallback((actorId: Parameters<typeof attention.focus>[0]) => {
    setAttentionState(attention.focus(actorId));
  }, [attention]);
  const showOverview = useCallback(() => {
    setAttentionState(attention.overview());
  }, [attention]);
  useEffect(() => {
    // Low-rate instrumentation refresh, not a transport or simulation clock.
    const timer = window.setInterval(() => {
      const next = experience.read();
      setState(next);
      if (mode === 'park') setAttentionState(attention.update({
        snapshot: next.frame.snapshot,
        dropTowerPhase: next.dropTower.phase,
        rollerCoasterReleaseActive: next.rollerCoaster.releaseActive,
        percussionStrength: next.bumperCars.eventStrength,
      }, next.frame.snapshot.transport.time));
    }, 100);
    // App is the root owner of this in-memory experience. React development remounts
    // effects without discarding that owner, so only the UI timer belongs to this effect.
    return () => window.clearInterval(timer);
  }, [attention, experience, mode]);
  useEffect(() => {
    if (mode === 'park') experience.updateContentLayout(PARK_CONTENT_BOUNDS);
  }, [experience, mode]);

  const workbench = <>
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
  </>;

  return <main className={`experience experience--${mode}`}>
    <header className="experience-header">
      <div><h1>Z.land Music Box</h1><p>Milestone 8B.1 · Monochrome Visual Language</p></div>
      <nav aria-label="Experience mode">
        <a href="./" aria-current={mode === 'park' ? 'page' : undefined}>Park Map</a>
        <a href="?mode=workbench" aria-current={mode === 'workbench' ? 'page' : undefined}>Development Workbench</a>
      </nav>
    </header>
    <ControlSurface transport={state.frame.snapshot.transport} actions={experience.actions} />
    {mode === 'park' ? <>
      <ParkMap state={state} worldRef={physicsStageRef} showPhysicsDebug={showPhysicsDebug}
        onContentLayout={experience.updateContentLayout} attention={attentionState}
        onFocus={focusActor} onOverview={showOverview} />
      <details className="park-diagnostics"><summary>Development diagnostics</summary>
        <DebugConsole state={state} attention={attentionState} />
      </details>
    </> : workbench}
  </main>;
}
