import type { PcmAudio } from '@computational-listening/engine';

export function pcmFromAudioBuffer(buffer: AudioBuffer): PcmAudio {
  return {
    sampleRate: buffer.sampleRate,
    channels: Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index)),
  };
}
