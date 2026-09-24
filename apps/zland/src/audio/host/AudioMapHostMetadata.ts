import type { AudioSourceMetadata } from '@computational-listening/audio-source-browser';

export type AudioMapHostMetadata = Readonly<{
  id: string;
  source?: AudioSourceMetadata;
}>;
