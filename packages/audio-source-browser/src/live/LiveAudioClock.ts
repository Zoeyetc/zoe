import type { BrowserTransportState } from '../transportTypes.ts';
export function createLiveAudioClock(now: () => number) {
  const startedAt = now(); let stoppedAt: number | null = null;
  const time = () => Math.max(0, (stoppedAt ?? now()) - startedAt);
  return {
    read(): BrowserTransportState { const current = time(); return {
      time: current, duration: stoppedAt === null ? current + 1 : current, playing: stoppedAt === null,
    }; },
    stop() { stoppedAt ??= now(); },
  };
}
