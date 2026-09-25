import type { PcmAudio } from '../listening-engine/index.ts';

export function pcmFromAudioBuffer(buffer: AudioBuffer): PcmAudio {
  return {
    sampleRate: buffer.sampleRate,
    channels: Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index)),
  };
}
