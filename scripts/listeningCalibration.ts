import { writeFileSync } from 'node:fs';
import { initialInstrumentMotion, stepInstrumentMotion } from '../src/instrument-ui/signal-player/instrumentMotion.ts';
import { initialMaterialMotion, stepMaterialMotion } from '../src/instrument-ui/signal-player/materialMotion.ts';
import { initialFieldMotion, stepFieldMotion } from '../src/instrument-ui/signal-player/fieldMotion.ts';
import { initialObservatoryMotion, stepObservatoryMotion } from '../src/instrument-ui/signal-player/observatoryMotion.ts';
import { motionStudyTarget, type MotionStudySample } from '../src/instrument-ui/signal-player/motionStudyEvidence.ts';

const framesPerSecond = 60;
const dt = 1 / framesPerSecond;
const leadSeconds = .5;
const tailSeconds = 15;
const reactionThreshold = .02;
const activityThreshold = .1;
const settleThreshold = .001;

const evidence = (level = 0, transient = 0, structureEnergy = 0, beat = 0,
  active = true): MotionStudySample => ({ level, transient, structureEnergy, beat, active, progress: 0 });
const silence = evidence(0, 0, 0, 0, false);
const consensus = evidence(.8, .8, .8, .8);
const disagreement = evidence(1, 0, 0, 0);

type Benchmark = Readonly<{
  name: string;
  input: string;
  stimulusSeconds: number;
  sampleAt(seconds: number): MotionStudySample;
}>;

const benchmarks: readonly Benchmark[] = [
  {
    name: 'Single transient', input: '100 ms onset 1.0 with level 0.08, then silence', stimulusSeconds: .1,
    sampleAt: time => time < .1 ? evidence(.08, 1) : silence,
  },
  {
    name: 'Repeated beats', input: 'Six 120 ms beats at 0.5 s spacing; level 0.10 between beats',
    stimulusSeconds: 3,
    sampleAt: time => time < 3
      ? time % .5 < .12 ? evidence(.1, .85, 0, 1) : evidence(.1)
      : silence,
  },
  {
    name: 'Constant tone', input: 'Level 0.50, transient 0.08, structure 0.45 for 4 s',
    stimulusSeconds: 4,
    sampleAt: time => time < 4 ? evidence(.5, .08, .45) : silence,
  },
  {
    name: 'Sudden silence', input: 'Four agreeing observations at 0.70 for 3 s; immediate silence',
    stimulusSeconds: 3,
    sampleAt: time => time < 3 ? evidence(.7, .7, .7, .7) : silence,
  },
  {
    name: 'Gradual fade', input: 'Four agreeing observations at 0.80 for 2 s, then linear fade over 3 s',
    stimulusSeconds: 5,
    sampleAt: time => {
      if (time < 2) return consensus;
      if (time >= 5) return silence;
      const intensity = .8 * (5 - time) / 3;
      return evidence(intensity, intensity, intensity, intensity);
    },
  },
  {
    name: 'Alternating agreement / disagreement',
    input: '0.55 s agreeing, 0.55 s conflicting, repeated for 6.6 s', stimulusSeconds: 6.6,
    sampleAt: time => time < 6.6 ? Math.floor(time / .55) % 2 === 0 ? consensus : disagreement : silence,
  },
  {
    name: 'Short false consensus', input: '0.75 s agreement, then 1.5 s isolated level',
    stimulusSeconds: 2.25,
    sampleAt: time => time < .75 ? consensus : time < 2.25 ? disagreement : silence,
  },
  {
    name: 'Long confirmed consensus', input: 'Four agreeing observations at 0.80 for 4 s, then silence',
    stimulusSeconds: 4,
    sampleAt: time => time < 4 ? consensus : silence,
  },
];

type Point = Readonly<{ time: number; activity: number; confirmed: boolean }>;
type Trace = Readonly<{ mode: string; points: readonly Point[] }>;

function run(benchmark: Benchmark): readonly Trace[] {
  let instrument = initialInstrumentMotion;
  let material = initialMaterialMotion;
  let field = initialFieldMotion;
  let observatory = initialObservatoryMotion;
  const modes = ['Instrument', 'Material', 'Field', 'Observatory'] as const;
  const points: Point[][] = modes.map(() => []);
  const frameCount = Math.round((leadSeconds + benchmark.stimulusSeconds + tailSeconds) * framesPerSecond);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const time = frame * dt;
    const relative = time - leadSeconds;
    const sample = relative < 0 ? silence : benchmark.sampleAt(relative);
    instrument = stepInstrumentMotion(instrument, motionStudyTarget('a', sample), dt);
    material = stepMaterialMotion(material, sample, dt);
    field = stepFieldMotion(field, sample, dt);
    observatory = stepObservatoryMotion(observatory, sample, dt);
    const values = [instrument.activity, material.activity, field.confidence, observatory.activity];
    for (let mode = 0; mode < modes.length; mode += 1) {
      points[mode].push({ time: (frame + 1) * dt, activity: values[mode], confirmed: mode === 3 && observatory.confirmed });
    }
  }
  return modes.map((mode, index) => ({ mode, points: points[index] }));
}

function firstPermanent(points: readonly Point[], start: number, predicate: (point: Point) => boolean) {
  let lastViolation = -1;
  for (let index = 0; index < points.length; index += 1) {
    if (points[index].time >= start && !predicate(points[index])) lastViolation = index;
  }
  const next = points.find((point, index) => index > lastViolation && point.time >= start);
  return next && predicate(next) ? Math.max(0, next.time - start) : null;
}

const seconds = (value: number | null) => value === null ? '—' : value.toFixed(2);

function row(trace: Trace, benchmark: Benchmark) {
  const { points } = trace;
  const start = leadSeconds;
  const end = start + benchmark.stimulusSeconds;
  const reaction = points.find(point => point.time >= start && point.activity >= reactionThreshold);
  const confirmation = points.find(point => point.time >= start && point.confirmed);
  const peak = Math.max(...points.map(point => point.activity));
  const above = points.filter(point => point.activity >= activityThreshold).length * dt;
  const settle = firstPermanent(points, end, point => point.activity <= settleThreshold);
  const rest = firstPermanent(points, end, point => point.activity === 0);
  return `| ${trace.mode} | ${seconds(reaction ? reaction.time - start : null)} | ${seconds(settle)} | ${peak.toFixed(3)} | ${above.toFixed(2)} | ${trace.mode === 'Observatory' ? seconds(confirmation ? confirmation.time - start : null) : '—'} | ${seconds(rest)} |`;
}

const lines = [
  '# Zoë Listening Calibration Suite v0.1',
  '',
  'Deterministic measurements of the existing motion responses. These are synthetic retained-evidence samples, not PCM or perceptual ratings. No mode parameters are changed by this suite.',
  'Regenerate with `node scripts/listeningCalibration.ts` from the repository root.',
  '',
  `- Step: ${framesPerSecond} frames/s (${dt.toFixed(6)} s); each case starts from fresh mode state with ${leadSeconds.toFixed(1)} s of inactive lead-in and ${tailSeconds.toFixed(1)} s of inactive tail.`,
  `- Reaction: first activity ≥ ${reactionThreshold.toFixed(2)} after stimulus onset. Peak: maximum activity. Time above threshold: total duration with activity ≥ ${activityThreshold.toFixed(2)}.`,
  `- Settle: time after the stimulus ends until activity stays ≤ ${settleThreshold.toFixed(3)} for the rest of the trace. Rest: time after stimulus end until activity stays exactly 0.`,
  '- Confirmation: first accepted Observatory state after stimulus onset; other modes have no confirmation state. “—” means the event did not occur within the trace.',
  '- All time columns are seconds. “Settle” and “rest” are measured from the start of final silence, or from the end of the fade/alternating phase.',
  '',
];

for (const benchmark of benchmarks) {
  lines.push(`## ${benchmark.name}`, '', `Input: ${benchmark.input}.`, '',
    '| Mode | React | Settle | Peak | Above 0.10 | Confirm | Exact rest |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...run(benchmark).map(trace => row(trace, benchmark)), '');
}

const output = new URL('../artifacts/listening-calibration-v0.1.md', import.meta.url);
writeFileSync(output, `${lines.join('\n')}\n`);
process.stdout.write(`${output.pathname}\n`);
