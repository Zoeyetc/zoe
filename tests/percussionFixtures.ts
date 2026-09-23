export type SyntheticPcm = Readonly<{ sampleRate: number; channels: readonly Float32Array[] }>;
export type HitKind = 'kick' | 'snare' | 'closed-hat' | 'open-hat' | 'tom' | 'other';

const randomAt = (index: number) => {
  let value = Math.imul(index + 1, 0x45d9f3b) ^ 0x9e3779b9;
  value ^= value >>> 16; value = Math.imul(value, 0x45d9f3b); value ^= value >>> 16;
  return ((value >>> 0) / 0xffffffff) * 2 - 1;
};

export function syntheticPercussion(sampleRate = 48_000, seconds = 2,
  hits: readonly Readonly<{ time: number; kind: HitKind; gain?: number }>[] = []): SyntheticPcm {
  const signal = new Float32Array(Math.floor(sampleRate * seconds));
  for (const hit of hits) {
    const start = Math.floor(hit.time * sampleRate);
    const decay = hit.kind === 'closed-hat' ? 0.035 : hit.kind === 'open-hat' ? 0.32
      : hit.kind === 'snare' ? 0.11 : hit.kind === 'kick' ? 0.16 : hit.kind === 'tom' ? 0.2 : 0.09;
    const length = Math.min(signal.length - start, Math.ceil(decay * sampleRate * 5));
    for (let offset = 0; offset < length; offset += 1) {
      const time = offset / sampleRate;
      const envelope = Math.exp(-time / decay);
      const gain = hit.gain ?? 0.8;
      let sample = 0;
      if (hit.kind === 'kick') {
        const frequency = 58 + 36 * Math.exp(-time / 0.035);
        sample = Math.sin(2 * Math.PI * frequency * time);
      } else if (hit.kind === 'tom') {
        sample = 0.82 * Math.sin(2 * Math.PI * 230 * time) + 0.18 * Math.sin(2 * Math.PI * 460 * time);
      } else if (hit.kind === 'closed-hat' || hit.kind === 'open-hat') {
        sample = 0.6 * Math.sin(2 * Math.PI * 6300 * time)
          + 0.35 * Math.sin(2 * Math.PI * 9100 * time) + randomAt(start + offset) * 0.18;
      } else if (hit.kind === 'snare') {
        sample = randomAt(start + offset) * 0.82 + Math.sin(2 * Math.PI * 1100 * time) * 0.18;
      } else {
        sample = randomAt(start + offset) * 0.45
          + Math.sin(2 * Math.PI * 380 * time) * 0.28 + Math.sin(2 * Math.PI * 4200 * time) * 0.27;
      }
      signal[start + offset] += gain * envelope * sample;
    }
  }
  return { sampleRate, channels: [signal] };
}

export const isolatedKick = () => syntheticPercussion(48_000, 1, [{ time: 0.2, kind: 'kick' }]);
export const isolatedSnare = () => syntheticPercussion(48_000, 1, [{ time: 0.2, kind: 'snare' }]);
export const isolatedClosedHat = () => syntheticPercussion(48_000, 1, [{ time: 0.2, kind: 'closed-hat' }]);
export const isolatedOpenHat = () => syntheticPercussion(48_000, 1, [{ time: 0.2, kind: 'open-hat' }]);
export const isolatedTom = () => syntheticPercussion(48_000, 1, [{ time: 0.2, kind: 'tom' }]);
export const ambiguousClap = () => syntheticPercussion(48_000, 1, [{ time: 0.2, kind: 'other' }]);
export const kickSnarePattern = () => syntheticPercussion(48_000, 2, [
  { time: 0.2, kind: 'kick' }, { time: 0.7, kind: 'snare' }, { time: 1.2, kind: 'kick' }, { time: 1.7, kind: 'snare' },
]);
export const kickHatPattern = () => syntheticPercussion(48_000, 2, [
  { time: 0.2, kind: 'kick' }, { time: 0.45, kind: 'closed-hat' }, { time: 0.7, kind: 'kick' },
  { time: 0.95, kind: 'closed-hat' }, { time: 1.2, kind: 'kick' }, { time: 1.45, kind: 'closed-hat' },
]);
export const fourOnFloorHats = () => syntheticPercussion(48_000, 2,
  Array.from({ length: 8 }, (_, index) => ({ time: 0.15 + index * 0.22,
    kind: index % 2 ? 'closed-hat' as const : 'kick' as const })));
export const denseHats = () => syntheticPercussion(48_000, 2,
  Array.from({ length: 24 }, (_, index) => ({ time: 0.12 + index * 0.075, kind: 'closed-hat' as const })));
export const lowSine = (sampleRate = 48_000) => ({ sampleRate, channels: [Float32Array.from(
  { length: sampleRate * 2 }, (_, index) => 0.5 * Math.sin(2 * Math.PI * 90 * index / sampleRate))] });
export const whiteNoise = (sampleRate = 48_000) => ({ sampleRate, channels: [Float32Array.from(
  { length: sampleRate * 2 }, (_, index) => randomAt(index) * 0.25)] });
export const sustainedCymbal = () => syntheticPercussion(48_000, 2, [{ time: 0.2, kind: 'open-hat', gain: 0.8 }]);
export const silence = (sampleRate = 48_000) => ({ sampleRate, channels: [new Float32Array(sampleRate)] });
export const overlappingKickSnare = () => syntheticPercussion(48_000, 1, [
  { time: 0.2, kind: 'kick' }, { time: 0.2, kind: 'snare' },
]);
export const varyingKickIntensity = () => syntheticPercussion(48_000, 2, [
  { time: 0.2, kind: 'kick', gain: 0.2 }, { time: 0.8, kind: 'kick', gain: 0.5 }, { time: 1.4, kind: 'kick', gain: 0.9 },
]);
export const sampleRateFixture = (sampleRate: number) => syntheticPercussion(sampleRate, 2, [
  { time: 0.2, kind: 'kick' }, { time: 0.7, kind: 'snare' }, { time: 1.2, kind: 'closed-hat' },
]);
export const stereoFixture = () => {
  const mono = kickSnarePattern();
  return { sampleRate: mono.sampleRate, channels: [mono.channels[0], Float32Array.from(mono.channels[0], value => value * 0.75)] };
};

