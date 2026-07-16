import transmitterWorkletUrl from './transmitter.worklet.ts?worker&url';
import { AcousticError } from './errors';
import { assertUltrasoundSampleRate, getTransmitterCapability } from './capabilities';
import { ACOUSTIC_FREQUENCIES_HZ, encodeTokenFrame, SYMBOL_SECONDS } from './protocol';

const SILENT_GAP_SYMBOLS = 5;

export class AcousticTransmitter {
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private gain: GainNode | null = null;

  get isPrepared(): boolean {
    return this.context !== null && this.node !== null;
  }

  async prepare(): Promise<void> {
    if (this.isPrepared) {
      await this.context?.resume();
      return;
    }
    const capability = getTransmitterCapability();
    if (!capability.supported) throw new AcousticError('AUDIO_UNSUPPORTED', capability.reason);

    const context = new AudioContext({ latencyHint: 'interactive' });
    try {
      assertUltrasoundSampleRate(context.sampleRate);
      await context.audioWorklet.addModule(transmitterWorkletUrl);
      const node = new AudioWorkletNode(context, 'kgisl-acoustic-transmitter', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: {
          frequencies: [...ACOUSTIC_FREQUENCIES_HZ],
          symbolSeconds: SYMBOL_SECONDS,
        },
      });
      const gain = context.createGain();
      // Conservative output level: enough for nearby classroom reception while
      // avoiding unnecessarily loud energy near the edge of human hearing.
      gain.gain.value = 0.14;
      node.connect(gain).connect(context.destination);
      this.context = context;
      this.node = node;
      this.gain = gain;
      await context.resume();
    } catch (error) {
      await context.close().catch(() => undefined);
      throw error;
    }
  }

  async setToken(token: string): Promise<void> {
    await this.prepare();
    const symbols: number[] = [...encodeTokenFrame(token), ...Array<number>(SILENT_GAP_SYMBOLS).fill(-1)];
    this.node?.port.postMessage({ type: 'set-frame', symbols });
  }

  async stop(): Promise<void> {
    const context = this.context;
    this.node?.port.postMessage({ type: 'stop' });
    this.node?.disconnect();
    this.gain?.disconnect();
    this.node = null;
    this.gain = null;
    this.context = null;
    if (context && context.state !== 'closed') await context.close().catch(() => undefined);
  }
}
