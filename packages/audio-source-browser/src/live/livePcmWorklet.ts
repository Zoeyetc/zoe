export const LIVE_PCM_PROCESSOR_NAME = 'computational-listening-live-pcm-capture';
export function createLivePcmWorkletUrl() {
  const source = `class LivePcmCapture extends AudioWorkletProcessor {
    constructor() {
      super();
      this.inFlight = false;
      this.port.onmessage = event => {
        if (event.data?.type === 'consumed') this.inFlight = false;
      };
    }
    process(inputs) {
      const input = inputs[0];
      if (!this.inFlight && input && input.length) {
        const channels = input.map(channel => channel.slice());
        this.inFlight = true;
        this.port.postMessage({ channels }, channels.map(channel => channel.buffer));
      }
      return true;
    }
  }
  registerProcessor('${LIVE_PCM_PROCESSOR_NAME}', LivePcmCapture);`;
  return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
}
