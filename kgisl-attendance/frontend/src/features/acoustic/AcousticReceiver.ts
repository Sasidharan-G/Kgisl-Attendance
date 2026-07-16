import receiverWorkletUrl from './receiver.worklet.ts?worker&url';
import { AcousticError, toAcousticError } from './errors';
import { assertUltrasoundSampleRate, getReceiverCapability } from './capabilities';
import {
  ACOUSTIC_FREQUENCIES_HZ,
  decodeTokenFrame,
  OBSERVATION_SECONDS,
  OBSERVATIONS_PER_SYMBOL,
  type AcousticSymbol,
} from './protocol';

type ReceiverCallbacks = {
  onToken: (token: string) => void;
  onLevel?: (level: number) => void;
};

type ObservationMessage = {
  type: 'observation';
  symbol: number;
  confidence: number;
  level: number;
};

const MAX_OBSERVATIONS = Math.ceil(7 / OBSERVATION_SECONDS);

export class AcousticReceiver {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: AudioWorkletNode | null = null;
  private observations: number[] = [];
  private decodedTokens = new Set<string>();
  private callbacks: ReceiverCallbacks | null = null;
  private lastLevelUpdate = 0;

  async start(callbacks: ReceiverCallbacks): Promise<void> {
    await this.stop();
    const capability = getReceiverCapability();
    if (!capability.supported) throw new AcousticError('AUDIO_UNSUPPORTED', capability.reason);
    this.callbacks = callbacks;
    this.observations = [];
    this.decodedTokens.clear();

    const context = new AudioContext({ latencyHint: 'interactive' });
    this.context = context;
    try {
      assertUltrasoundSampleRate(context.sampleRate);
      await context.resume();
      const supported = navigator.mediaDevices.getSupportedConstraints?.() ?? {};
      const audio: MediaTrackConstraints = {
        channelCount: { ideal: 1 },
        ...(supported.echoCancellation ? { echoCancellation: { ideal: false } } : {}),
        ...(supported.noiseSuppression ? { noiseSuppression: { ideal: false } } : {}),
        ...(supported.autoGainControl ? { autoGainControl: { ideal: false } } : {}),
        ...(supported.sampleRate ? { sampleRate: { ideal: 48_000 } } : {}),
      };
      const stream = await navigator.mediaDevices.getUserMedia({ audio, video: false });
      this.stream = stream;
      await context.audioWorklet.addModule(receiverWorkletUrl);
      const source = context.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(context, 'kgisl-acoustic-receiver', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        processorOptions: {
          frequencies: [...ACOUSTIC_FREQUENCIES_HZ],
          observationSeconds: OBSERVATION_SECONDS,
        },
      });
      node.port.onmessage = (event: MessageEvent<ObservationMessage>) => this.handleObservation(event.data);
      source.connect(node);
      this.source = source;
      this.node = node;
    } catch (error) {
      await this.stop();
      throw toAcousticError(error);
    }
  }

  private handleObservation(message: ObservationMessage): void {
    if (message.type !== 'observation') return;
    this.observations.push(message.symbol);
    if (this.observations.length > MAX_OBSERVATIONS) this.observations.shift();

    const now = performance.now();
    if (now - this.lastLevelUpdate >= 70) {
      this.lastLevelUpdate = now;
      this.callbacks?.onLevel?.(message.level);
    }
    if (this.observations.length % OBSERVATIONS_PER_SYMBOL !== 0) return;

    const token = this.tryDecodeObservations();
    if (token && !this.decodedTokens.has(token)) {
      this.decodedTokens.add(token);
      this.callbacks?.onToken(token);
    }
  }

  private tryDecodeObservations(): string | null {
    for (let phase = 0; phase < OBSERVATIONS_PER_SYMBOL; phase += 1) {
      let contiguous: AcousticSymbol[] = [];
      for (let offset = phase; offset + OBSERVATIONS_PER_SYMBOL <= this.observations.length; offset += OBSERVATIONS_PER_SYMBOL) {
        const block = this.observations.slice(offset, offset + OBSERVATIONS_PER_SYMBOL);
        const counts = [0, 0, 0, 0];
        for (const symbol of block) if (symbol >= 0 && symbol <= 3) counts[symbol] += 1;
        let winner = 0;
        for (let index = 1; index < counts.length; index += 1) if (counts[index] > counts[winner]) winner = index;
        if (counts[winner] < Math.ceil(OBSERVATIONS_PER_SYMBOL / 2)) {
          contiguous = [];
          continue;
        }
        contiguous.push(winner as AcousticSymbol);
        const token = decodeTokenFrame(contiguous);
        if (token) return token;
      }
    }
    return null;
  }

  async stop(): Promise<void> {
    const context = this.context;
    this.node?.port.close();
    this.source?.disconnect();
    this.node?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.context = null;
    this.stream = null;
    this.source = null;
    this.node = null;
    this.callbacks = null;
    this.observations = [];
    if (context && context.state !== 'closed') await context.close().catch(() => undefined);
  }
}
