import type { ExperienceState } from '../createExperience';
import type { AttentionState } from '../experience/attention';
import { PARK_FOCUS_BOUNDS, PARK_OVERVIEW_VIEWPORT, focusViewport } from '../experience/park/config';

const maxOrZero = (values: readonly number[]) => values.length ? Math.max(...values) : 0;

export function DebugConsole({ state, attention }: { state: ExperienceState; attention?: AttentionState }) {
  const focusBounds = attention?.focusActorId ? PARK_FOCUS_BOUNDS[attention.focusActorId] : null;
  const viewport = focusBounds ? focusViewport(focusBounds) : PARK_OVERVIEW_VIEWPORT;
  const melodyAnalysis = state.audio.melodyAnalysis;
  const currentContour = melodyAnalysis?.contour.reduce<typeof melodyAnalysis.contour[number] | null>((nearest, frame) =>
    !nearest || Math.abs(frame.time - state.frame.snapshot.transport.time) < Math.abs(nearest.time - state.frame.snapshot.transport.time)
      ? frame : nearest, null) ?? null;
  const currentNote = state.frame.snapshot.melody.activeNote;
  const harmonyAnalysis = state.audio.harmonyAnalysis;
  const currentHarmonyFrame = harmonyAnalysis?.frames.reduce<typeof harmonyAnalysis.frames[number] | null>((nearest, frame) =>
    !nearest || Math.abs(frame.time - state.frame.snapshot.transport.time) < Math.abs(nearest.time - state.frame.snapshot.transport.time)
      ? frame : nearest, null) ?? null;
  const currentChord = harmonyAnalysis?.segments.find(segment =>
    segment.start <= state.frame.snapshot.transport.time && state.frame.snapshot.transport.time < segment.end) ?? null;
  const chordProgress = currentChord
    ? Math.min(1, Math.max(0, (state.frame.snapshot.transport.time - currentChord.start) / (currentChord.end - currentChord.start)))
    : 0;
  const tonalCenterAnalysis = state.audio.tonalCenterAnalysis;
  const currentTonalFrame = tonalCenterAnalysis?.frames.reduce<typeof tonalCenterAnalysis.frames[number] | null>((nearest, frame) =>
    !nearest || Math.abs(frame.time - state.frame.snapshot.transport.time) < Math.abs(nearest.time - state.frame.snapshot.transport.time)
      ? frame : nearest, null) ?? null;
  const currentTonalSegment = tonalCenterAnalysis?.segments.find(segment =>
    segment.start <= state.frame.snapshot.transport.time
    && (state.frame.snapshot.transport.time < segment.end
      || (state.frame.snapshot.transport.time === state.frame.snapshot.transport.duration
        && segment.end === state.frame.snapshot.transport.duration))) ?? null;
  const structureAnalysis = state.audio.structureAnalysis;
  const percussionAnalysis = state.audio.percussionAnalysis;
  const recentPercussion = (state.audio.percussion ?? []).filter(event =>
    event.time <= state.frame.snapshot.transport.time && state.frame.snapshot.transport.time - event.time <= 1).at(-1) ?? null;
  const compactTrackMap = {
    ...state.rollerCoasterTrackMap,
    route: { length: state.rollerCoasterTrackMap.route.length, pieces: state.rollerCoasterTrackMap.route.pieces.length,
      segments: state.rollerCoasterTrackMap.route.segments.map(segment => ({ kind: segment.kind, featureId: segment.featureId, length: segment.geometry.length })) },
    points: `[${state.rollerCoasterTrackMap.points.length} canonical points]`,
  };
  const debugState = {
    ...state,
    rollerCoasterTrackMap: compactTrackMap,
    audio: { ...state.audio, structureAnalysis: structureAnalysis ? {
      ...structureAnalysis,
      selfSimilarity: { size: structureAnalysis.selfSimilarity.size,
        values: `[Float32Array ${structureAnalysis.selfSimilarity.values.length}]` },
    } : null },
  };
  return <section aria-labelledby="debug-heading">
    <h2 id="debug-heading">DebugConsole</h2>
    <p className="event-log" data-debug-audio><strong>Audio Pipeline:</strong>{' '}
      source {state.audio.source.kind} · file {state.audio.source.filename ?? '—'} · MIME {state.audio.source.mimeType ?? '—'} ·{' '}
      decode {state.audio.preparation.decodeState} · analysis {state.audio.preparation.analysisState} ·{' '}
      context {state.audio.contextState} · node {state.audio.sourceNodeState} · musical time {state.audio.musicalTime.toFixed(3)} ·{' '}
      playback offset {state.audio.playbackOffset.toFixed(3)} · duration {state.frame.snapshot.transport.duration.toFixed(3)} ·{' '}
      RMS {state.frame.snapshot.spectrum.rms.toFixed(3)} · peak {state.frame.snapshot.spectrum.peak.toFixed(3)} ·{' '}
      onset {state.frame.snapshot.spectrum.onsetStrength.toFixed(3)} · capabilities{' '}
      melody:{String(state.frame.snapshot.capabilities.melody)} harmony:{String(state.frame.snapshot.capabilities.harmony)}{' '}
      tonalCenter:{String(state.frame.snapshot.capabilities.tonalCenter)}{' '}
      rhythm:{String(state.frame.snapshot.capabilities.rhythm)} percussion:{String(state.frame.snapshot.capabilities.percussion)}{' '}
      structure:{String(state.frame.snapshot.capabilities.structure)}{' '}
      spectrum:{String(state.frame.snapshot.capabilities.spectrum)} · analysis{' '}
      {state.audio.analysis
        ? `${state.audio.analysis.sampleRate} Hz / ${state.audio.analysis.channelCount} ch / ${state.audio.analysis.frameSize} frame / ${state.audio.analysis.hopSize} hop / ${state.audio.analysis.fftSize} FFT / ${state.audio.analysis.analyzedDuration.toFixed(2)}s analyzed`
        : 'authored fixture'}
    </p>
    {attention && <div className="event-log" data-debug-attention><p><strong>Experience Attention:</strong>{' '}
      mode {attention.mode} · manual focus {attention.focusActorId ?? '—'} · automatic primary {attention.primaryActorId ?? '—'} ·{' '}
      transition {attention.transition} · roles {Object.entries(attention.roles).map(([id, role]) => `${id}:${role}`).join(', ')} ·{' '}
      policy {attention.diagnostics.source} · decision {attention.diagnostics.decision} · hold remaining{' '}
      {attention.diagnostics.holdRemaining.toFixed(2)}s ·{' '}
      focus bounds {focusBounds ? `${focusBounds.x}, ${focusBounds.y}, ${focusBounds.width}, ${focusBounds.height}` : 'overview'} ·{' '}
      viewport scale {viewport.scale.toFixed(3)} translate {viewport.x.toFixed(3)}, {viewport.y.toFixed(3)}
    </p><p><strong>Attention candidates:</strong>{' '}
      {Object.entries(attention.diagnostics.scores).map(([id, score]) =>
        `${id}=${score.score.toFixed(2)} [available:${String(score.available)}, active:${String(score.active)}, base:${score.baseActivity.toFixed(2)}, structure:${score.structuralBias.toFixed(2)}, continuity:${score.continuity.toFixed(2)}]`).join(' · ')}
    </p></div>}
    <p>AudioWorld: timeline crossings active · BumperCars seed: {state.bumperCars.seed}</p>
    <p className="event-log" data-debug-park-pulse><strong>Park Pulse:</strong>{' '}
      available {String(state.parkPulse.available)} · BPM {state.parkPulse.bpm?.toFixed(2) ?? '—'} ·{' '}
      phase {state.parkPulse.beatPhase.toFixed(3)} · confidence {state.parkPulse.rhythmConfidence.toFixed(2)} ·{' '}
      envelope {state.parkPulse.envelope.toFixed(3)} · source strength {state.parkPulse.sourceStrength.toFixed(4)} ·{' '}
      position {state.parkPulse.position.x.toFixed(2)}, {state.parkPulse.position.y.toFixed(2)} · radius {state.parkPulse.radius.toFixed(2)} ·{' '}
      last beat {state.parkPulse.lastBeatTime?.toFixed(3) ?? '—'} · pulse count {state.parkPulse.pulseCount} ·{' '}
      active {String(state.parkPulse.active)} · provenance {state.parkPulse.movementSource}
    </p>
    <p className="event-log" data-debug-melody><strong>Melody / Carousel:</strong>{' '}
      capability {String(state.frame.snapshot.melody.available)} · track confidence {melodyAnalysis?.confidence.toFixed(2) ?? 'authored'} ·{' '}
      voiced ratio {melodyAnalysis?.voicedFrameRatio.toFixed(2) ?? '—'} · notes {melodyAnalysis?.notes.length ?? 'authored'} ·{' '}
      pitch range {melodyAnalysis?.pitchRange.minMidi ?? '—'}–{melodyAnalysis?.pitchRange.maxMidi ?? '—'} ·{' '}
      median note confidence {melodyAnalysis?.medianNoteConfidence.toFixed(2) ?? '—'} · contour voiced {String(currentContour?.voiced ?? false)} ·{' '}
      pitch {currentContour?.pitchHz?.toFixed(2) ?? '—'} Hz · MIDI float {currentContour?.midiFloat?.toFixed(2) ?? '—'} ·{' '}
      frame confidence {currentContour?.confidence.toFixed(2) ?? '—'} · salience {currentContour?.salience.toFixed(2) ?? '—'} ·{' '}
      source {state.frame.snapshot.melody.source} · current {currentNote?.id ?? '—'} / {state.frame.snapshot.melody.noteName ?? '—'} / MIDI {state.frame.snapshot.melody.midi ?? '—'} ·{' '}
      pitch {state.frame.snapshot.melody.pitchHz?.toFixed(2) ?? '—'} Hz · range {currentNote ? `${currentNote.start.toFixed(3)}–${currentNote.end.toFixed(3)}` : '—'} ·{' '}
      duration {currentNote ? (currentNote.end - currentNote.start).toFixed(3) : '—'} · progress {state.frame.snapshot.melody.noteProgress.toFixed(2)} ·{' '}
      intensity {state.frame.snapshot.melody.intensity.toFixed(2)} · confidence {state.frame.snapshot.melody.confidence.toFixed(2)} ·{' '}
      tonal {state.frame.snapshot.tonalCenter.segmentId ?? '—'} / {state.frame.snapshot.tonalCenter.label ?? '—'} · root {state.frame.snapshot.tonalCenter.rootPitchClass ?? '—'} · mode {state.frame.snapshot.tonalCenter.mode ?? '—'} · tonal confidence {state.frame.snapshot.tonalCenter.confidence.toFixed(2)} ·{' '}
      degree available {String(state.frame.snapshot.melody.scaleDegree.available)} · in scale {String(state.frame.snapshot.melody.scaleDegree.inScale)} · degree {state.frame.snapshot.melody.scaleDegree.degree ?? '—'} / {state.frame.snapshot.melody.scaleDegree.displayDegree ?? '—'} ·{' '}
      relative {state.frame.snapshot.melody.scaleDegree.relativeSemitones ?? '—'} semitones · reference tonic MIDI {state.frame.snapshot.melody.scaleDegree.referenceTonicMidi ?? '—'} · octave {state.frame.snapshot.melody.scaleDegree.octaveRelation ?? '—'} · chromatic offset {state.frame.snapshot.melody.scaleDegree.chromaticOffset ?? '—'} · degree confidence {state.frame.snapshot.melody.scaleDegree.confidence.toFixed(2)} ·{' '}
      octave corrections {melodyAnalysis?.octaveCorrectionCount ?? '—'} · rejected frames {melodyAnalysis?.rejectedLowConfidenceFrameCount ?? '—'} ·{' '}
      rejected short notes {melodyAnalysis?.rejectedShortNoteCount ?? '—'} · carrier {state.carousel.activeRider === null ? '—' : state.carousel.activeRider + 1} / degree {state.carousel.activeDegree ?? '—'} · marker {String(state.carousel.chromaticMarker.visible)} ·{' '}
      presentation {state.carousel.presentationEnvelope.toFixed(2)} · mechanical idle {String(state.carousel.mechanicalIdleActive)} ·{' '}
      provenance {state.carousel.movementSource} · {state.carousel.mode}
    </p>
    <p className="event-log"><strong>Spectrum / Free Bodies:</strong>{' '}
      available {String(state.frame.snapshot.spectrum.available)} · brightness {state.frame.snapshot.spectrum.brightness.toFixed(2)} ·{' '}
      texture {state.frame.snapshot.spectrum.texture.toFixed(2)} · low/mid/high{' '}
      {state.frame.snapshot.spectrum.low.toFixed(2)} / {state.frame.snapshot.spectrum.mid.toFixed(2)} / {state.frame.snapshot.spectrum.high.toFixed(2)} ·{' '}
      bodies {state.freeBodies.bodies.length} · seed {state.freeBodies.seed} · average speed {state.freeBodies.averageSpeed.toFixed(3)} ·{' '}
      max speed {state.freeBodies.maxSpeed.toFixed(3)} · active/sleeping {state.freeBodies.activeCount}/{state.freeBodies.sleepingCount} ·{' '}
      selected {state.freeBodies.selectedBodyId} · position{' '}
      {state.freeBodies.bodies[0]
        ? `${state.freeBodies.bodies[0].position.x.toFixed(3)}, ${state.freeBodies.bodies[0].position.y.toFixed(3)}` : '—'} · velocity{' '}
      {state.freeBodies.bodies[0]
        ? `${state.freeBodies.bodies[0].velocity.x.toFixed(3)}, ${state.freeBodies.bodies[0].velocity.y.toFixed(3)}` : '—'} · atmosphere{' '}
      {state.freeBodies.bodies[0]
        ? `${state.freeBodies.bodies[0].atmosphericForce.x.toFixed(3)}, ${state.freeBodies.bodies[0].atmosphericForce.y.toFixed(3)}` : '—'} · PhysicsWorld{' '}
      {state.freeBodies.bodies[0]
        ? `${state.freeBodies.bodies[0].physicsForce.x.toFixed(3)}, ${state.freeBodies.bodies[0].physicsForce.y.toFixed(3)}` : '—'} · combined{' '}
      {state.freeBodies.bodies[0]
        ? `${state.freeBodies.bodies[0].combinedForce.x.toFixed(3)}, ${state.freeBodies.bodies[0].combinedForce.y.toFixed(3)}` : '—'}
      {' '}· pulse source {state.freeBodies.bodies[0]?.latestPulseSource ?? '—'} · wake source {state.freeBodies.bodies[0]?.latestWakeSource ?? '—'}
    </p>
    <p className="event-log" data-debug-harmony><strong>Harmony / FerrisWheel:</strong>{' '}
      capability {String(state.frame.snapshot.harmony.available)} · track confidence {harmonyAnalysis?.confidence.toFixed(2) ?? 'authored'} ·{' '}
      segments {harmonyAnalysis?.segments.length ?? 'authored'} · no-chord ratio {harmonyAnalysis?.noChordRatio.toFixed(2) ?? '—'} ·{' '}
      average duration {harmonyAnalysis?.averageSegmentDuration.toFixed(2) ?? '—'} · chroma{' '}
      {currentHarmonyFrame?.chroma.map(value => value.toFixed(2)).join('/') ?? '—'} ·{' '}
      top {currentHarmonyFrame?.topCandidate ? `${currentHarmonyFrame.topCandidate.label}:${currentHarmonyFrame.topCandidate.score.toFixed(2)}` : '—'} ·{' '}
      second {currentHarmonyFrame?.secondCandidate ? `${currentHarmonyFrame.secondCandidate.label}:${currentHarmonyFrame.secondCandidate.score.toFixed(2)}` : '—'} ·{' '}
      margin {currentHarmonyFrame?.scoreMargin.toFixed(2) ?? '—'} · frame confidence {currentHarmonyFrame?.confidence.toFixed(2) ?? '—'} ·{' '}
      current {currentChord?.id ?? '—'} / {state.frame.snapshot.harmony.chord ?? '—'} ·{' '}
      root {state.frame.snapshot.harmony.rootPitchClass ?? '—'} · quality {currentChord?.quality ?? '—'} ·{' '}
      pitch classes {state.frame.snapshot.harmony.pitchClasses.join(',') || '—'} ·{' '}
      range {currentChord ? `${currentChord.start.toFixed(3)}–${currentChord.end.toFixed(3)}` : '—'} ·{' '}
      progress {chordProgress.toFixed(2)} · confidence {state.frame.snapshot.harmony.confidence.toFixed(2)} ·{' '}
      latest change {state.ferrisWheel.latestChordChange ?? '—'} · angle {state.ferrisWheel.wheelAngle.toFixed(3)} ·{' '}
      target {state.ferrisWheel.targetWheelAngle.toFixed(3)} · error {state.ferrisWheel.targetError.toFixed(3)} ·{' '}
      velocity {state.ferrisWheel.wheelAngularVelocity.toFixed(3)} · acceleration {state.ferrisWheel.wheelAngularAcceleration.toFixed(3)} ·{' '}
      settling {String(state.ferrisWheel.settling)} · active cabins {state.ferrisWheel.activeCabinIds.join(', ') || '—'} ·{' '}
      physical order {state.ferrisWheel.cabins.map(cabin => cabin.pitchClass).join(', ')} · swings{' '}
      {state.ferrisWheel.cabins.map(cabin => `${cabin.pitchClass}:${cabin.swingAngle.toFixed(3)}`).join(', ')} · {state.ferrisWheel.mode}
    </p>
    <p className="event-log" data-debug-tonal-center><strong>Tonal Center / Key:</strong>{' '}
      capability {String(state.frame.snapshot.tonalCenter.available)} · global{' '}
      {tonalCenterAnalysis?.globalTonalCenter?.label ?? '—'} · track confidence{' '}
      {tonalCenterAnalysis?.confidence.toFixed(2) ?? '—'} · segments {tonalCenterAnalysis?.segments.length ?? '—'} ·{' '}
      average duration {tonalCenterAnalysis?.averageSegmentDuration.toFixed(2) ?? '—'} · frame top{' '}
      {currentTonalFrame?.topCandidate
        ? `${currentTonalFrame.topCandidate.label}:${currentTonalFrame.topScore.toFixed(2)}` : '—'} · second{' '}
      {currentTonalFrame?.secondCandidate
        ? `${currentTonalFrame.secondCandidate.label}:${currentTonalFrame.secondScore.toFixed(2)}` : '—'} · margin{' '}
      {currentTonalFrame?.margin.toFixed(2) ?? '—'} · frame confidence {currentTonalFrame?.confidence.toFixed(2) ?? '—'} · current{' '}
      {currentTonalSegment?.id ?? '—'} / {state.frame.snapshot.tonalCenter.label ?? '—'} · root{' '}
      {state.frame.snapshot.tonalCenter.rootPitchClass ?? '—'} · mode {state.frame.snapshot.tonalCenter.mode ?? '—'} · range{' '}
      {currentTonalSegment ? `${currentTonalSegment.start.toFixed(3)}–${currentTonalSegment.end.toFixed(3)}` : '—'} · progress{' '}
      {state.frame.snapshot.tonalCenter.segmentProgress.toFixed(2)} · confidence{' '}
      {state.frame.snapshot.tonalCenter.confidence.toFixed(2)} · fifths index{' '}
      {state.frame.snapshot.tonalCenter.circleOfFifthsIndex ?? '—'} · distance{' '}
      {state.frame.snapshot.tonalCenter.distanceFromPrevious ?? '—'} · Ferris accepted tonic{' '}
      {state.ferrisWheel.tonicCabinId ?? '—'} · target fifths {state.ferrisWheel.targetFifthsIndex ?? '—'} · target angle{' '}
      {state.ferrisWheel.targetWheelAngle.toFixed(3)} · latest accepted change {state.ferrisWheel.latestTonalCenterChange ?? '—'}
    </p>
    <p className="event-log" data-debug-structure><strong>Structure Analysis:</strong>{' '}
      source {state.frame.snapshot.structure.source ?? '—'} · capability {String(state.frame.snapshot.structure.available)} · track confidence{' '}
      {structureAnalysis?.trackConfidence.toFixed(2) ?? 'authored'} · segments {structureAnalysis?.segments.length ?? 'authored'} ·{' '}
      boundaries {structureAnalysis?.boundaries.length ?? 'authored'} · arrangement changes{' '}
      {structureAnalysis?.arrangementChanges.length ?? 'authored'} · recurrence groups{' '}
      {structureAnalysis?.recurrenceGroupCount ?? 'authored'} · average duration{' '}
      {structureAnalysis?.averageSegmentDuration.toFixed(2) ?? '—'} · current {state.frame.snapshot.structure.segmentId ?? '—'} /{' '}
      {state.frame.snapshot.structure.label ?? '—'} · group {state.frame.snapshot.structure.recurrenceGroup ?? '—'} · range{' '}
      {state.frame.snapshot.structure.segmentStart === null ? '—' : `${state.frame.snapshot.structure.segmentStart.toFixed(2)}–${state.frame.snapshot.structure.segmentEnd?.toFixed(2)}`} ·{' '}
      progress {state.frame.snapshot.structure.sectionProgress.toFixed(2)} · confidence {state.frame.snapshot.structure.confidence.toFixed(2)} ·{' '}
      energy {state.frame.snapshot.structure.energy.toFixed(2)} · contrast {state.frame.snapshot.structure.contrast.toFixed(2)} ·{' '}
      importance {state.frame.snapshot.structure.importance.toFixed(2)} · novelty {state.frame.snapshot.structure.novelty.toFixed(2)} · scales{' '}
      {structureAnalysis ? `${maxOrZero(structureAnalysis.noveltyScales.short).toFixed(2)} / ${maxOrZero(structureAnalysis.noveltyScales.medium).toFixed(2)} / ${maxOrZero(structureAnalysis.noveltyScales.long).toFixed(2)}` : '—'} · boundaries{' '}
      {state.frame.snapshot.structure.previousBoundaryTime?.toFixed(2) ?? '—'} ({state.frame.snapshot.structure.previousBoundaryConfidence?.toFixed(2) ?? '—'}) /{' '}
      {state.frame.snapshot.structure.nextBoundaryTime?.toFixed(2) ?? '—'} ({state.frame.snapshot.structure.nextBoundaryConfidence?.toFixed(2) ?? '—'}) ·{' '}
      seconds to next {state.frame.snapshot.structure.nextBoundaryTime === null ? '—'
        : Math.max(0, state.frame.snapshot.structure.nextBoundaryTime - state.frame.snapshot.transport.time).toFixed(2)}
    </p>
    <p className="event-log" data-debug-drop-tower-drive><strong>DropTower Structure Drive:</strong>{' '}
      source {state.dropTower.drive.source} · available {String(state.dropTower.drive.available)} · section {state.frame.snapshot.structure.section ?? '—'} ·{' '}
      build {state.dropTower.drive.build.toFixed(2)} · tension {state.dropTower.drive.tension.toFixed(2)} · release {state.dropTower.drive.release.toFixed(2)} ·{' '}
      lift intent {state.dropTower.drive.liftIntent.toFixed(2)} · hold intent {state.dropTower.drive.holdIntent.toFixed(2)} ·{' '}
      drop authorized {String(state.dropTower.drive.dropAuthorized)} · preparation {state.dropTower.drive.preparationSeconds.toFixed(2)}s ·{' '}
      cooldown {state.dropTower.drive.cooldownRemaining.toFixed(2)}s · confidence {state.dropTower.drive.confidence.toFixed(2)} ·{' '}
      reason {state.dropTower.drive.reason}
    </p>
    <p className="event-log" data-debug-drop-tower-physics><strong>DropTower Physical State:</strong>{' '}
      latest drop {state.dropTower.latestDropEvent ?? '—'} · phase {state.dropTower.phase} ·{' '}
      position {state.dropTower.position.toFixed(3)} · velocity {state.dropTower.velocity.toFixed(3)} ·{' '}
      target {state.dropTower.liftTarget.toFixed(3)} · lift speed {state.dropTower.liftSpeed.toFixed(3)} ·{' '}
      rebound {String(state.dropTower.reboundActive)} · settling {String(state.dropTower.settlingActive)} ·{' '}
      movement {state.dropTower.movementProvenance} · hold {String(state.dropTower.phase === 'HOLDING')} ·{' '}
      reduced {String(state.dropTower.reducedMotion)}
    </p>
    <p className="event-log" data-debug-track-plan><strong>RollerCoaster TrackPlan / TrackMap:</strong>{' '}
      source {state.rollerCoasterTrackPlan.generationSource} · plan {state.rollerCoasterTrackPlan.version} / {state.rollerCoasterTrackPlan.id} ·{' '}
      features {state.rollerCoasterTrackPlan.features.length} · major {state.rollerCoasterTrackPlan.features.filter(feature => ['lift', 'crest', 'drop', 'loop'].includes(feature.type)).length} ·{' '}
      lift/crest/drop/loop/run {(['lift', 'crest', 'drop', 'loop', 'run'] as const).map(type => `${type}:${state.rollerCoasterTrackPlan.features.filter(feature => feature.type === type).length}`).join(' ')} ·{' '}
      fallback {String(state.rollerCoasterTrackPlan.fallbackUsed)} · phrase proxy {state.rollerCoasterTrackPlan.phraseProxy.beatBlockSize} beats / confidence {state.rollerCoasterTrackPlan.phraseProxy.confidence.toFixed(2)} ·{' '}
      map {state.rollerCoasterTrackMap.version} / {state.rollerCoasterTrackMap.id} · route {state.rollerCoasterTrackMap.totalLength.toFixed(1)} ·{' '}
      points/segments {state.rollerCoasterTrackMap.points.length}/{state.rollerCoasterTrackMap.segments.length} · scale {state.rollerCoasterTrackMap.normalizationScale.toFixed(4)} ·{' '}
      bounds {state.rollerCoasterTrackMap.bounds.minX.toFixed(1)},{state.rollerCoasterTrackMap.bounds.minY.toFixed(1)} → {state.rollerCoasterTrackMap.bounds.maxX.toFixed(1)},{state.rollerCoasterTrackMap.bounds.maxY.toFixed(1)} ·{' '}
      valid {String(state.rollerCoasterTrackMap.valid)} · generated {state.rollerCoasterTrackMap.generationMs.toFixed(2)}ms
      <br />{state.rollerCoasterTrackPlan.features.map(feature => `${feature.id} ${feature.type} ${feature.startTime.toFixed(1)}–${feature.endTime.toFixed(1)}s strength:${feature.strength.toFixed(2)} scale:${feature.scale.toFixed(2)} — ${feature.sourceEvidence.summary}`).join(' · ')}
    </p>
    <p className="event-log"><strong>Phrase / RollerCoaster:</strong>{' '}
      available {String(state.frame.snapshot.structure.available)} · phrase {state.frame.snapshot.structure.phraseProgress.toFixed(2)} ·{' '}
      section {state.frame.snapshot.structure.section ?? '—'} · section progress {state.frame.snapshot.structure.sectionProgress.toFixed(2)} ·{' '}
      energy {state.frame.snapshot.structure.energy.toFixed(2)} · tension {state.frame.snapshot.structure.tension.toFixed(2)} ·{' '}
      release {String(state.rollerCoaster.releaseActive)} · latest release {state.rollerCoaster.latestRelease ?? '—'} ·{' '}
      mode {state.rollerCoaster.mode} · segment {state.rollerCoaster.currentSegment} ·{' '}
      distance {state.rollerCoaster.routeDistance.toFixed(1)} / {state.rollerCoaster.routeLength.toFixed(1)} ·{' '}
      progress {state.rollerCoaster.routeProgress.toFixed(3)} · velocity {state.rollerCoaster.velocity.toFixed(2)} ·{' '}
      acceleration {state.rollerCoaster.acceleration.toFixed(2)} · drive {state.rollerCoaster.driveTarget.toFixed(2)} ·{' '}
      braking {String(state.rollerCoaster.braking)} · rider{' '}
      {state.rollerCoaster.riderPosition.x.toFixed(1)}, {state.rollerCoaster.riderPosition.y.toFixed(1)}, {state.rollerCoaster.riderPosition.z.toFixed(1)} ·{' '}
      reduced {String(state.rollerCoaster.reducedMotion)}
    </p>
    <p className="event-log" data-debug-percussion><strong>Percussion Analysis:</strong>{' '}
      capability {String(state.frame.snapshot.percussion.available)} · confidence {state.frame.snapshot.percussion.confidence.toFixed(2)} ·{' '}
      activity {state.frame.snapshot.percussion.activity.toFixed(2)} · candidates {percussionAnalysis?.candidateCount ?? 'authored'} ·{' '}
      accepted {percussionAnalysis?.acceptedEventCount ?? state.audio.percussion?.length ?? 0} · density{' '}
      {percussionAnalysis?.eventDensity.toFixed(2) ?? '—'} · classes{' '}
      {percussionAnalysis ? Object.entries(percussionAnalysis.classCounts).map(([role, count]) => `${role}:${count}`).join(', ') : 'authored'} ·{' '}
      recent {recentPercussion?.type ?? '—'} @{recentPercussion?.time.toFixed(3) ?? '—'} · intensity{' '}
      {recentPercussion?.strength.toFixed(2) ?? '—'} · confidence {recentPercussion?.confidence?.toFixed(2) ?? '—'} · scores{' '}
      {recentPercussion?.topScore?.toFixed(2) ?? '—'}/{recentPercussion?.secondScore?.toFixed(2) ?? '—'} · margin{' '}
      {recentPercussion?.margin?.toFixed(2) ?? '—'} · descriptors{' '}
      {recentPercussion?.descriptors
        ? `sub:${recentPercussion.descriptors.subRatio.toFixed(2)} low-mid:${recentPercussion.descriptors.lowMidRatio.toFixed(2)} high:${recentPercussion.descriptors.highRatio.toFixed(2)} centroid:${recentPercussion.descriptors.centroid.toFixed(2)} spread:${recentPercussion.descriptors.spread.toFixed(2)} duration:${recentPercussion.descriptors.duration.toFixed(3)} decay:${recentPercussion.descriptors.decay.toFixed(2)} onset:${recentPercussion.descriptors.onsetStrength.toFixed(2)}`
        : '—'}
    </p>
    <p className="event-log"><strong>BumperCars:</strong>{' '}
      count {state.bumperCars.bodies.length} · {state.bumperCars.latestPercussion ?? 'no percussion'} · strength {state.bumperCars.eventStrength.toFixed(2)} ·{' '}
      body {state.bumperCars.selectedBody === null ? '—' : state.bumperCars.selectedBody + 1} ·{' '}
      activity {Math.round(state.bumperCars.kineticActivity)} · {state.bumperCars.mode} · cars{' '}
      {state.bumperCars.bodies.map(body => `#${body.id + 1} ${body.role} pos:${body.x.toFixed(1)},${body.y.toFixed(1)} vel:${body.vx.toFixed(1)},${body.vy.toFixed(1)} speed:${Math.hypot(body.vx, body.vy).toFixed(1)} angular:${body.angularVelocity.toFixed(2)} event:${body.lastPercussionEvent ?? '—'} impulse:${body.lastImpulseStrength.toFixed(2)} collisions:${body.collisionCount}`).join(' | ')}
    </p>
    <p className="event-log"><strong>PirateShip:</strong>{' '}
      rhythm {String(state.frame.snapshot.rhythm.available)} · BPM {state.pirateShip.bpm ?? '—'} ·{' '}
      confidence {(state.audio.rhythmAnalysis?.confidence ?? state.frame.snapshot.rhythm.confidence).toFixed(2)} ·{' '}
      beat count {state.audio.rhythmAnalysis?.beats.length ?? 'authored'} · beat index {state.frame.snapshot.rhythm.beatIndex ?? '—'} ·{' '}
      beat {state.pirateShip.beatPhase.toFixed(3)} · interval {state.frame.snapshot.rhythm.beatInterval?.toFixed(3) ?? '—'} ·{' '}
      nearest {state.frame.snapshot.rhythm.nearestBeatTime?.toFixed(3) ?? '—'} ·{' '}
      bar index {state.frame.snapshot.rhythm.barIndex ?? '—'} · bar phase {state.pirateShip.barPhase.toFixed(2)} ·{' '}
      groove {state.pirateShip.groove.toFixed(2)} · swing {state.pirateShip.swing.toFixed(2)} ·{' '}
      swing confidence {state.frame.snapshot.rhythm.swingConfidence.toFixed(2)} · onset {state.frame.snapshot.spectrum.onsetStrength.toFixed(3)} ·{' '}
      candidates {state.audio.rhythmAnalysis?.tempoCandidates.map(candidate => `${candidate.bpm.toFixed(1)}:${candidate.score.toFixed(2)}`).join(', ') || '—'} ·{' '}
      evidence {state.audio.rhythmAnalysis ? `low:${state.audio.rhythmAnalysis.evidence.lowBandSupport.toFixed(2)}, subdivision:${state.audio.rhythmAnalysis.evidence.subdivisionSupport.toFixed(2)}, energy:${state.audio.rhythmAnalysis.evidence.energyPulseSupport.toFixed(2)}, grid:${state.audio.rhythmAnalysis.evidence.gridSupport.toFixed(2)}, family-margin:${state.audio.rhythmAnalysis.evidence.tempoFamilyMargin.toFixed(2)}` : '—'} ·{' '}
      angle {(state.pirateShip.angle * 180 / Math.PI).toFixed(1)}° ·{' '}
      velocity {state.pirateShip.angularVelocity.toFixed(2)} · drive {state.pirateShip.driveAmplitude.toFixed(2)} ·{' '}
      error {state.pirateShip.phaseError.toFixed(2)} · {state.pirateShip.mode}
    </p>
    <p className="event-log"><strong>PhysicsWorld:</strong>{' '}
      {state.physics.registeredSources} source · {state.physics.registeredReceivers} receiver ·{' '}
      {state.physics.impactCount} impact · latest {state.physics.latestImpact?.id ?? '—'} ·{' '}
      source {state.physics.latestImpact?.sourceId ?? '—'} · timestamp {state.physics.latestImpact?.timestamp.toFixed(3) ?? '—'} ·{' '}
      position {state.physics.latestImpact
        ? `${state.physics.latestImpact.position.x.toFixed(2)}, ${state.physics.latestImpact.position.y.toFixed(2)}` : '—'} ·{' '}
      normal {state.physics.latestImpact
        ? `${state.physics.latestImpact.direction.x.toFixed(2)}, ${state.physics.latestImpact.direction.y.toFixed(2)}` : '—'} ·{' '}
      strength {state.physics.latestImpact?.strength.toFixed(2) ?? '—'} · radius {state.physics.latestImpact?.radius.toFixed(2) ?? '—'} ·{' '}
      receiver distance {state.physics.latestReceiverDistance?.toFixed(2) ?? '—'}
    </p>
    <p className="event-log" data-debug-physics-pulse><strong>PhysicsWorld Park Pulse:</strong>{' '}
      updates {state.physics.pulseCount} · source {state.physics.latestPulse?.sourceId ?? '—'} ·{' '}
      active {String(state.physics.latestPulse?.active ?? false)} · timestamp {state.physics.latestPulse?.timestamp.toFixed(3) ?? '—'} ·{' '}
      position {state.physics.latestPulse ? `${state.physics.latestPulse.position.x.toFixed(2)}, ${state.physics.latestPulse.position.y.toFixed(2)}` : '—'} ·{' '}
      strength {state.physics.latestPulse?.strength.toFixed(4) ?? '—'} · radius {state.physics.latestPulse?.radius.toFixed(2) ?? '—'} ·{' '}
      receiver {state.physics.latestPulseReception?.receiverId ?? '—'} · distance {state.physics.latestPulseReception?.distance.toFixed(3) ?? '—'} ·{' '}
      falloff {state.physics.latestPulseReception?.falloff.toFixed(3) ?? '—'} · force{' '}
      {state.physics.latestPulseReception
        ? `${state.physics.latestPulseReception.force.x.toFixed(4)}, ${state.physics.latestPulseReception.force.y.toFixed(4)}` : '—'}
    </p>
    <p className="event-log"><strong>RollerCoaster Physics Source:</strong>{' '}
      registered {state.physics.registeredSources >= 2 ? 'true' : 'false'} ·{' '}
      active {String(state.physics.latestWake?.active ?? false)} ·{' '}
      position {state.physics.latestWake
        ? `${state.physics.latestWake.position.x.toFixed(3)}, ${state.physics.latestWake.position.y.toFixed(3)}` : '—'} ·{' '}
      forward {state.physics.latestWake
        ? `${state.physics.latestWake.forward.x.toFixed(3)}, ${state.physics.latestWake.forward.y.toFixed(3)}` : '—'} ·{' '}
      speed {state.physics.latestWake?.speed.toFixed(2) ?? '—'} · acceleration {state.physics.latestWake?.acceleration.toFixed(2) ?? '—'} ·{' '}
      radius {state.physics.latestWake?.radius.toFixed(3) ?? '—'} · strength {state.physics.latestWake?.strength.toFixed(3) ?? '—'} ·{' '}
      receiver {state.physics.latestWakeReception?.receiverId ?? '—'} · distance {state.physics.latestWakeReception?.distance.toFixed(3) ?? '—'} ·{' '}
      alignment {state.physics.latestWakeReception?.alignment.toFixed(3) ?? '—'} ·{' '}
      falloff {state.physics.latestWakeReception?.falloff.toFixed(3) ?? '—'} · force{' '}
      {state.physics.latestWakeReception
        ? `${state.physics.latestWakeReception.force.x.toFixed(3)}, ${state.physics.latestWakeReception.force.y.toFixed(3)}` : '—'}
    </p>
    <p className="event-log"><strong>Anchored Content:</strong>{' '}
      {state.content.id} · anchor {state.content.anchor.x.toFixed(3)}, {state.content.anchor.y.toFixed(3)} ·{' '}
      bounds {state.content.bounds.x.toFixed(3)}, {state.content.bounds.y.toFixed(3)}, {state.content.bounds.width.toFixed(3)}, {state.content.bounds.height.toFixed(3)} ·{' '}
      velocity {state.content.velocity.x.toFixed(3)}, {state.content.velocity.y.toFixed(3)} ·{' '}
      received impulse {state.content.latestReceivedImpulse.x.toFixed(3)}, {state.content.latestReceivedImpulse.y.toFixed(3)} ·{' '}
      impact distance {state.content.latestImpactDistance?.toFixed(3) ?? '—'} ·{' '}
      wake {state.content.latestWakeSource ?? '—'} · wake distance {state.content.latestWakeDistance?.toFixed(3) ?? '—'} ·{' '}
      alignment {state.content.latestWakeAlignment.toFixed(3)} · falloff {state.content.latestWakeFalloff.toFixed(3)} ·{' '}
      received force {state.content.latestReceivedForce.x.toFixed(3)}, {state.content.latestReceivedForce.y.toFixed(3)} ·{' '}
      pulse {state.content.latestPulseSource ?? '—'} · pulse distance {state.content.latestPulseDistance?.toFixed(3) ?? '—'} ·{' '}
      pulse falloff {state.content.latestPulseFalloff.toFixed(3)} · pulse force{' '}
      {state.content.latestPulseForce.x.toFixed(4)}, {state.content.latestPulseForce.y.toFixed(4)} ·{' '}
      offset {state.content.offset.x.toFixed(3)}, {state.content.offset.y.toFixed(3)} ({state.content.displacement.toFixed(3)}) ·{' '}
      rotation {(state.content.rotation * 180 / Math.PI).toFixed(2)}° ·{' '}
      {state.content.active ? 'active' : 'settled'} · spring {state.content.springState} · layout revision {state.content.layoutRevision}
    </p>
    <p className="event-log"><strong>Recent events:</strong>{' '}
      {state.recentEvents.length
        ? state.recentEvents.map(event => `${event.type}@${event.type === 'seek' ? event.to.toFixed(2) : event.time.toFixed(2)}`).join(' · ')
        : 'none'}
    </p>
    <pre>{JSON.stringify(debugState, null, 2)}</pre>
  </section>;
}
