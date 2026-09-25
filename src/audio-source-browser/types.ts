export type AudioSourceMetadata = Readonly<{
  kind: 'fixture' | 'real-audio' | 'live-input';
  filename: string | null;
  mimeType: string | null;
  deviceId?: string | null;
  deviceLabel?: string | null;
}>;
