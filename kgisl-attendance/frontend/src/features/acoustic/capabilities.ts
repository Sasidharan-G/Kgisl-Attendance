import { ACOUSTIC_FREQUENCIES_HZ } from './protocol';

export type AcousticCapability = { supported: true } | { supported: false; reason: string };

function baseAudioCapability(): AcousticCapability {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined' || typeof window.AudioWorkletNode === 'undefined') {
    return { supported: false, reason: 'This browser does not support the Web Audio AudioWorklet.' };
  }
  return { supported: true };
}
export function getTransmitterCapability(): AcousticCapability {
  return baseAudioCapability();
}

export function getReceiverCapability(): AcousticCapability {
  const base = baseAudioCapability();
  if (!base.supported) return base;
  if (!window.isSecureContext) {
    return { supported: false, reason: 'Microphone access requires a secure HTTPS connection. Use Beta QR instead.' };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { supported: false, reason: 'This browser does not support microphone capture.' };
  }
  return { supported: true };
}

export function assertUltrasoundSampleRate(sampleRate: number): void {
  const highestFrequency = ACOUSTIC_FREQUENCIES_HZ[ACOUSTIC_FREQUENCIES_HZ.length - 1];
  if (sampleRate / 2 < highestFrequency + 500) {
    throw new Error(`The ${sampleRate} Hz audio sample rate is too low for high-frequency signalling.`);
  }
}
