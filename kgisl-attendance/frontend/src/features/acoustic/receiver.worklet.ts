type ReceiverOptions = {
  processorOptions?: {
    frequencies?: number[];
    observationSeconds?: number;
  };
};

class AcousticReceiverProcessor extends AudioWorkletProcessor {
  private readonly frequencies: number[];
  private readonly samplesPerObservation: number;
  private readonly buffer: Float32Array;
  private offset = 0;

  constructor(options?: ReceiverOptions) {
    super();
    this.frequencies = options?.processorOptions?.frequencies ?? [18_200, 18_600, 19_000, 19_400];
    this.samplesPerObservation = Math.max(128, Math.round((options?.processorOptions?.observationSeconds ?? 0.007) * sampleRate));
    this.buffer = new Float32Array(this.samplesPerObservation);
  }

  private goertzelPower(frequency: number): number {
    const coefficient = 2 * Math.cos((2 * Math.PI * frequency) / sampleRate);
    let previous = 0;
    let previousTwo = 0;
    for (let index = 0; index < this.buffer.length; index += 1) {
      // Hann window reduces leakage from nearby speech and adjacent FSK bins.
      const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * index) / (this.buffer.length - 1));
      const current = this.buffer[index] * window + coefficient * previous - previousTwo;
      previousTwo = previous;
      previous = current;
    }
    return Math.max(0, previousTwo * previousTwo + previous * previous - coefficient * previous * previousTwo);
  }

  private analyse(): void {
    const powers = this.frequencies.map((frequency) => this.goertzelPower(frequency));
    let bestIndex = 0;
    let secondPower = 0;
    for (let index = 1; index < powers.length; index += 1) {
      if (powers[index] > powers[bestIndex]) {
        secondPower = powers[bestIndex];
        bestIndex = index;
      } else if (powers[index] > secondPower) {
        secondPower = powers[index];
      }
    }

    let squareSum = 0;
    for (const sample of this.buffer) squareSum += sample * sample;
    const rms = Math.sqrt(squareSum / this.buffer.length);
    const confidence = powers[bestIndex] / Math.max(secondPower, 1e-12);
    const symbol = rms >= 0.00008 && confidence >= 1.8 ? bestIndex : -1;
    this.port.postMessage({ type: 'observation', symbol, confidence, level: Math.min(1, rms * 80) });
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel) return true;
    for (const sample of channel) {
      this.buffer[this.offset] = sample;
      this.offset += 1;
      if (this.offset >= this.buffer.length) {
        this.analyse();
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor('kgisl-acoustic-receiver', AcousticReceiverProcessor);
