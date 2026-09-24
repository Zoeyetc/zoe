/** Fixed-capacity mono ring. Multi-channel blocks use the file analyzer's arithmetic mean. */
export class RollingPcmBuffer {
  readonly capacity: number; readonly sampleRate: number;
  #samples: Float32Array; #write = 0; #length = 0; #totalSamples = 0;
  constructor(sampleRate: number, seconds: number) {
    if (!(sampleRate > 0) || !(seconds > 0)) throw new RangeError('Invalid rolling PCM configuration');
    this.sampleRate = sampleRate; this.capacity = Math.max(1, Math.ceil(sampleRate * seconds));
    this.#samples = new Float32Array(this.capacity);
  }
  get length() { return this.#length; }
  get duration() { return this.#length / this.sampleRate; }
  get totalDuration() { return this.#totalSamples / this.sampleRate; }
  get byteLength() { return this.#samples.byteLength; }
  push(channels: readonly Float32Array[]) {
    if (!channels.length) return;
    const length = Math.min(...channels.map(channel => channel.length));
    for (let index = 0; index < length; index += 1) {
      let sample = 0;
      for (const channel of channels) sample += (channel[index] ?? 0) / channels.length;
      this.#samples[this.#write] = sample; this.#write = (this.#write + 1) % this.capacity;
      this.#length = Math.min(this.capacity, this.#length + 1);
    }
    this.#totalSamples += length;
  }
  snapshot() {
    const result = new Float32Array(this.#length);
    const start = (this.#write - this.#length + this.capacity) % this.capacity;
    const first = Math.min(this.#length, this.capacity - start);
    result.set(this.#samples.subarray(start, start + first));
    if (first < this.#length) result.set(this.#samples.subarray(0, this.#length - first), first);
    return result;
  }
  clear() { this.#samples.fill(0); this.#write = 0; this.#length = 0; this.#totalSamples = 0; }
}
