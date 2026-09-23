import type { AudioEvent, AudioFrame } from '../../audio/types';
import { toDropTowerInput, type DropTowerDrive, type DropTowerInput } from './adapter.ts';

export const DROP_TOWER_STRUCTURE_CONSTANTS = {
  minimumBuildSeconds: 1.5,
  rawBuildPersistenceThreshold: 0.34,
  liftThreshold: 0.42,
  holdThreshold: 0.72,
  releaseThreshold: 0.74,
  confidenceGate: 0.62,
  strongBoundaryThreshold: 0.68,
  preparedTensionThreshold: 0.62,
  anticipationWindowSeconds: 4,
  cooldownSeconds: 6,
  holdAbortSeconds: 1.2,
  holdCaptureDistance: 0.2,
  partialLiftFraction: 0.28,
  fullLiftFraction: 1,
} as const;

type StructuralMemory = {
  source: AudioFrame['snapshot']['structure']['source'];
  segmentId: string | null;
  energy: number;
  preparationSeconds: number;
  peakBuild: number;
  peakTension: number;
  lastAuthorizationTime: number | null;
  authorizationCount: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const seekEvent = (events: AudioFrame['events']) => events.find(
  (event): event is Extract<AudioEvent, { type: 'seek' }> => event.type === 'seek',
);
const sectionChange = (events: AudioFrame['events']) => events.find(
  (event): event is Extract<AudioEvent, { type: 'section-change' }> => event.type === 'section-change',
);

const emptyMemory = (): StructuralMemory => ({
  source: null, segmentId: null, energy: 0, preparationSeconds: 0,
  peakBuild: 0, peakTension: 0, lastAuthorizationTime: null, authorizationCount: 0,
});

/** Stateful actor interpretation of analyzed structural truth. It does not create AudioWorld evidence. */
export function createDropTowerStructureInterpreter() {
  let memory = emptyMemory();

  const reset = () => { memory = emptyMemory(); };
  return {
    reset,
    accept(frame: AudioFrame, dt: number): DropTowerInput {
      const base = toDropTowerInput(frame);
      const structure = frame.snapshot.structure;
      const seek = seekEvent(frame.events);
      if (seek?.to === 0) reset();
      if (structure.source === 'authored') {
        if (memory.source !== 'authored') reset();
        memory.source = 'authored';
        return base;
      }
      if (structure.source !== 'analysis' || !structure.available) {
        if (memory.source !== null) reset();
        return base;
      }
      if (memory.source !== 'analysis') reset();
      memory.source = 'analysis';

      const time = frame.snapshot.transport.time;
      const playing = frame.snapshot.transport.playing;
      const confidence = clamp01(structure.confidence);
      const confidenceFactor = clamp01((confidence - 0.35) / 0.65);
      const secondsToNextBoundary = structure.nextBoundaryTime === null
        ? null : Math.max(0, structure.nextBoundaryTime - time);
      const anticipation = secondsToNextBoundary !== null
        && secondsToNextBoundary <= DROP_TOWER_STRUCTURE_CONSTANTS.anticipationWindowSeconds
        ? clamp01(structure.nextBoundaryConfidence ?? 0)
          * (1 - secondsToNextBoundary / DROP_TOWER_STRUCTURE_CONSTANTS.anticipationWindowSeconds)
        : 0;
      const energyRise = clamp01(Math.max(0, structure.energy - memory.energy) * 4);
      const rawBuild = clamp01(confidenceFactor * (
        anticipation * 0.42
        + structure.importance * structure.sectionProgress * 0.28
        + structure.contrast * structure.sectionProgress * 0.2
        + energyRise * 0.1
      ));
      const boundedDt = Math.min(0.1, Math.max(0, dt));
      if (seek) {
        memory.preparationSeconds = rawBuild >= DROP_TOWER_STRUCTURE_CONSTANTS.rawBuildPersistenceThreshold
          ? DROP_TOWER_STRUCTURE_CONSTANTS.minimumBuildSeconds * structure.sectionProgress : 0;
        memory.peakBuild = rawBuild;
        memory.peakTension = 0;
        memory.lastAuthorizationTime = null;
      } else if (playing && boundedDt > 0) {
        memory.preparationSeconds = rawBuild >= DROP_TOWER_STRUCTURE_CONSTANTS.rawBuildPersistenceThreshold
          ? Math.min(12, memory.preparationSeconds + boundedDt)
          : Math.max(0, memory.preparationSeconds - boundedDt * 1.5);
      }
      const persistence = clamp01(memory.preparationSeconds / DROP_TOWER_STRUCTURE_CONSTANTS.minimumBuildSeconds);
      const build = clamp01(rawBuild * persistence);
      const tension = clamp01(confidenceFactor * (build * 0.5 + anticipation * 0.3 + structure.importance * 0.2));
      const liftIntent = clamp01((build - 0.18) / 0.62);
      const holdIntent = clamp01(persistence * (tension - 0.45) / 0.3);
      memory.peakBuild = Math.max(memory.peakBuild, build);
      memory.peakTension = Math.max(memory.peakTension, tension);

      const crossing = !seek && playing ? sectionChange(frame.events) : undefined;
      const boundaryConfidence = crossing ? clamp01(structure.previousBoundaryConfidence ?? 0) : 0;
      const energyShift = crossing ? clamp01(Math.abs(structure.energy - memory.energy) * 2) : 0;
      const release = crossing ? clamp01(confidenceFactor * (
        structure.contrast * 0.4 + boundaryConfidence * 0.3
        + energyShift * 0.2 + structure.importance * 0.1
      )) : 0;
      const cooldownRemaining = memory.lastAuthorizationTime === null
        ? 0 : Math.max(0, DROP_TOWER_STRUCTURE_CONSTANTS.cooldownSeconds - (time - memory.lastAuthorizationTime));
      const prepared = memory.preparationSeconds >= DROP_TOWER_STRUCTURE_CONSTANTS.minimumBuildSeconds
        && memory.peakBuild >= DROP_TOWER_STRUCTURE_CONSTANTS.liftThreshold
        && memory.peakTension >= DROP_TOWER_STRUCTURE_CONSTANTS.preparedTensionThreshold;
      const dropAuthorized = Boolean(crossing)
        && prepared
        && release >= DROP_TOWER_STRUCTURE_CONSTANTS.releaseThreshold
        && confidence >= DROP_TOWER_STRUCTURE_CONSTANTS.confidenceGate
        && boundaryConfidence >= DROP_TOWER_STRUCTURE_CONSTANTS.strongBoundaryThreshold
        && cooldownRemaining <= 0;
      let reason = 'stable structure; no lift intent';
      if (confidence < DROP_TOWER_STRUCTURE_CONSTANTS.confidenceGate) reason = 'structure confidence below gate';
      else if (dropAuthorized) reason = `prepared release ${release.toFixed(2)} at strong boundary`;
      else if (crossing && cooldownRemaining > 0) reason = `release blocked by ${cooldownRemaining.toFixed(2)}s cooldown`;
      else if (crossing && !prepared) reason = 'boundary observed without sustained preparation';
      else if (crossing && release < DROP_TOWER_STRUCTURE_CONSTANTS.releaseThreshold) reason = `boundary release ${release.toFixed(2)} below threshold`;
      else if (holdIntent >= DROP_TOWER_STRUCTURE_CONSTANTS.holdThreshold) reason = `strong boundary anticipation; hold intent ${holdIntent.toFixed(2)}`;
      else if (liftIntent >= DROP_TOWER_STRUCTURE_CONSTANTS.liftThreshold) reason = `sustained structural preparation; lift intent ${liftIntent.toFixed(2)}`;
      else if (rawBuild >= DROP_TOWER_STRUCTURE_CONSTANTS.rawBuildPersistenceThreshold) reason = `preparation accumulating ${memory.preparationSeconds.toFixed(2)}s`;

      let authorizationId: string | null = null;
      if (dropAuthorized) {
        memory.authorizationCount += 1;
        authorizationId = `analyzed-drop-${memory.authorizationCount}@${time.toFixed(3)}`;
        memory.lastAuthorizationTime = time;
        memory.preparationSeconds = 0;
        memory.peakBuild = 0;
        memory.peakTension = 0;
      }
      const drive: DropTowerDrive = {
        source: 'analyzed', available: true, build, tension, release,
        liftIntent, holdIntent, dropAuthorized, confidence,
        preparationSeconds: memory.preparationSeconds,
        cooldownRemaining: dropAuthorized ? DROP_TOWER_STRUCTURE_CONSTANTS.cooldownSeconds : cooldownRemaining,
        reason, authorizationId,
      };
      memory.segmentId = structure.segmentId;
      memory.energy = structure.energy;
      return {
        ...base,
        structureAvailable: true,
        drive,
        section: structure.section,
        sectionProgress: structure.sectionProgress,
        energy: structure.energy,
        tension,
        build,
        drop: null,
      };
    },
  };
}
