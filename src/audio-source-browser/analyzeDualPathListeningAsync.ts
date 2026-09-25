import type { DualPathListening, PcmAudio } from '@zoeyetc/computational-listening-engine';

type WorkerReply = Readonly<{ result: DualPathListening; error?: never } | { result?: never; error: string }>;

/** Keep the Engine's synchronous dual-path analysis off the browser UI thread. */
export function analyzeDualPathListeningAsync(pcm: PcmAudio): Promise<DualPathListening> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./dualPath.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<WorkerReply>) => {
      worker.terminate();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.result!);
    };
    worker.onerror = event => {
      worker.terminate();
      reject(new Error(event.message || 'Dual-path analysis failed.'));
    };
    worker.postMessage(pcm);
  });
}
