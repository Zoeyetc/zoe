export async function decodeLocalAudioFile(file: File, context: AudioContext): Promise<AudioBuffer> {
  if (!file || file.size <= 0) throw new Error('The selected audio file is empty');
  const bytes = await file.arrayBuffer();
  let buffer: AudioBuffer;
  try {
    buffer = await context.decodeAudioData(bytes.slice(0));
  } catch {
    throw new Error('This browser could not decode the selected audio file');
  }
  if (!Number.isFinite(buffer.duration) || buffer.duration <= 0 || buffer.length <= 0 || buffer.numberOfChannels <= 0) {
    throw new Error('The decoded audio file contains no playable samples');
  }
  return buffer;
}
