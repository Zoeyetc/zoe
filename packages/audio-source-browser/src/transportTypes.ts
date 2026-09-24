export type BrowserTransportState = Readonly<{ time: number; duration: number; playing: boolean }>;
export interface BrowserAudioClock {
  read(): BrowserTransportState;
  play(): void;
  pause(): void;
  seek(time: number): void;
  restart(): void;
}
