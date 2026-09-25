import { analyzeDualPathListening, type PcmAudio } from '@zoeyetc/computational-listening-engine';

self.onmessage = (event: MessageEvent<PcmAudio>) => {
  try {
    self.postMessage({ result: analyzeDualPathListening(event.data) });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Dual-path analysis failed.' });
  }
};
