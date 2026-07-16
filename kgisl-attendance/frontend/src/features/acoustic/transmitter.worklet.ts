type TransmitterOptions = {
  processorOptions?: {
    frequencies?: number[];
    symbolSeconds?: number;
  };
};

class AcousticTransmitterProcessor extends AudioWorkletProcessor {
  private readonly frequencies: number[];
  private readonly samplesPerSymbol: number;
  private readonly edgeSamples: number;
  private symbols: number[] = [];
  private symbolIndex = 0;
  private sampleInSymbol = 0;
  private phase = 0;
  private active = false;

  constructor(options?: TransmitterOptions) {
    super();
    this.frequencies = options?.processorOptions?.frequencies ?? [18_200, 18_600, 19_000, 19_400];
    this.samplesPerSymbol = Math.max(1, Math.round((options?.processorOptions?.symbolSeconds ?? 0.035) * sampleRate));
    this.edgeSamples = Math.max(1, Math.round(0.0015 * sampleRate));
    this.port.onmessage = (event: MessageEvent<{ type: string; symbols?: number[] }>) => {
      if (event.data.type === 'set-frame') {
        this.symbols = event.data.symbols ?? [];
        this.symbolIndex = 0;
        this.sampleInSymbol = 0;
        this.active = this.symbols.length > 0;
      } else if (event.data.type === 'stop') {
        this.active = false;
        this.symbols = [];
      }
    };
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const channel = outputs[0]?.[0];
    if (!channel) return true;

    for (let index = 0; index < channel.length; index += 1) {
      const symbol = this.symbols[this.symbolIndex];
      if (!this.active || symbol === undefined || symbol < 0) {
        channel[index] = 0;
      } else {
        const frequency = this.frequencies[symbol];
        const edge = Math.min(
          1,
          this.sampleInSymbol / this.edgeSamples,
          (this.samplesPerSymbol - this.sampleInSymbol) / this.edgeSamples,
        );
        channel[index] = Math.sin(this.phase) * Math.max(0, edge);
        this.phase = (this.phase + (2 * Math.PI * frequency) / sampleRate) % (2 * Math.PI);
      }

      this.sampleInSymbol += 1;
      if (this.sampleInSymbol >= this.samplesPerSymbol) {
        this.sampleInSymbol = 0;
        this.symbolIndex = this.symbols.length === 0 ? 0 : (this.symbolIndex + 1) % this.symbols.length;
      }
    }
    return true;
  }
}

registerProcessor('kgisl-acoustic-transmitter', AcousticTransmitterProcessor);
