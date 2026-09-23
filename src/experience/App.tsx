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
import { createAudioPreparationController, FIXTURE_PREPARATION_STATE, type AudioPreparationState } from '../audio/AudioPreparationController';
import { resolveDropTowerQaAudioMap } from '../audio/DropTowerQaAudioMap';

export function App() {
  const physicsStageRef = useRef<HTMLDivElement>(null);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || new URLSearchParams(window.location.search).has('reduce-motion');
  const mode = resolveExperienceMode(window.location.search);
  const showPhysicsDebug = physicsDebugVisible(window.location.search);
  const dropTowerQaMap = resolveDropTowerQaAudioMap(new URLSearchParams(window.location.search).get('drop-tower-qa'));
  const [experience] = useState(() => createExperience(
    () => performance.now() / 1000,
    reduceMotion,
    dropTowerQaMap ?? undefined,
  ));
  const [preparation, setPreparation] = useState<AudioPreparationState>(() => ({
    ...FIXTURE_PREPARATION_STATE, duration: dropTowerQaMap?.duration ?? 24,
  }));
  const [audioPreparation] = useState(() => createAudioPreparationController(next => {
    setPreparation(next);
    experience.setAudioPreparationState(next);
  }));
  const [attention] = useState(() => createAttentionController(() => performance.now() / 1000, reduceMotion));
  const [state, setState] = useState(() => experience.read());
  const [attentionState, setAttentionState] = useState<AttentionState>(() => attention.read());
  const focusActor = useCallback((actorId: Parameters<typeof attention.focus>[0]) => {
    setAttentionState(attention.focus(actorId));
  }, [attention]);
  const showOverview = useCallback(() => {
    setAttentionState(attention.overview());
  }, [attention]);
  const commitState = useCallback((next: ReturnType<typeof experience.read>, directResolve = false) => {
    const latestSeek = [...next.recentEvents].reverse().find(event => event.type === 'seek');
    setState(next);
    if (mode === 'park') setAttentionState(attention.update({
      snapshot: next.frame.snapshot,
      dropTowerPhase: next.dropTower.phase,
      rollerCoasterReleaseActive: next.rollerCoaster.releaseActive,
      percussionStrength: next.frame.snapshot.percussion.activity,
      seek: directResolve,
      seekToken: latestSeek?.type === 'seek' ? `${latestSeek.from}:${latestSeek.to}` : null,
    }, next.frame.snapshot.transport.time));
  }, [attention, experience, mode]);
  const chooseAudio = useCallback((file: File) => {
    void audioPreparation.prepare(file).then(prepared => {
      if (!prepared) return;
      experience.activateRealAudio(prepared);
      commitState(experience.read(), true);
    });
  }, [audioPreparation, commitState, experience]);
  const useFixture = useCallback(() => {
    audioPreparation.useFixture();
    experience.activateFixture();
    commitState(experience.read(), true);
  }, [audioPreparation, commitState, experience]);
  useEffect(() => {
    // Low-rate instrumentation refresh, not a transport or simulation clock.
    const timer = window.setInterval(() => {
      const next = experience.read();
      commitState(next);
    }, 100);
    // App is the root owner of this in-memory experience. React development remounts
    // effects without discarding that owner, so only the UI timer belongs to this effect.
    return () => window.clearInterval(timer);
  }, [commitState, experience]);
  useEffect(() => {
    if (mode === 'park') experience.updateContentLayout(PARK_CONTENT_BOUNDS);
  }, [experience, mode]);
  useEffect(() => {
    const dispose = () => { audioPreparation.dispose(); experience.dispose(); };
    window.addEventListener('pagehide', dispose, { once: true });
    return () => window.removeEventListener('pagehide', dispose);
  }, [audioPreparation, experience]);

  const workbench = <>
    <CarouselView state={state.carousel} />
    <FerrisWheelView state={state.ferrisWheel} />
    <DropTowerView state={state.dropTower} />
    <RollerCoasterView state={state.rollerCoaster} trackMap={state.rollerCoasterTrackMap} />
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
  const controlActions = {
    play: experience.actions.play,
    pause: experience.actions.pause,
    seek(time: number) {
      experience.actions.seek(time);
      commitState(experience.read(), true);
    },
    restart() {
      experience.actions.restart();
      commitState(experience.read(), true);
    },
  };

  return <main className={`experience experience--${mode}`}>
    <header className="experience-header">
      <div><h1>Z.land Music Box</h1><p>Milestone 9I · Real Structure → DropTower</p></div>
      <nav aria-label="Experience mode">
        <a href="./" aria-current={mode === 'park' ? 'page' : undefined}>Park Map</a>
        <a href="?mode=workbench" aria-current={mode === 'workbench' ? 'page' : undefined}>Development Workbench</a>
      </nav>
    </header>
    <ControlSurface transport={state.frame.snapshot.transport} melody={state.frame.snapshot.melody}
      rhythm={state.frame.snapshot.rhythm} percussion={state.frame.snapshot.percussion}
      percussionEventCount={state.audio.percussionAnalysis?.acceptedEventCount ?? state.audio.percussion?.length ?? null}
      harmony={state.frame.snapshot.harmony} actions={controlActions}
      tonalCenter={state.frame.snapshot.tonalCenter}
      structure={state.frame.snapshot.structure}
      structureSegmentCount={state.audio.structureAnalysis?.segments.length ?? null}
      preparation={preparation} onChooseAudio={chooseAudio} onUseFixture={useFixture} />
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
