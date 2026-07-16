import { ACOUSTIC_FREQUENCIES_HZ } from './protocol';

export type AcousticCapability = { supported: true } | { supported: false; reason: string };

function baseAudioCapability(): AcousticCapability {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined' || typeof window.AudioWorkletNode === 'undefined') {
    return { supported: false, reason: 'Indha browser Web Audio AudioWorklet-a support pannala.' };
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
    return { supported: false, reason: 'Microphone-ku HTTPS secure connection thevai. Beta QR-a use pannunga.' };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { supported: false, reason: 'Indha browser microphone capture-a support pannala.' };
  }
  return { supported: true };
}

export function assertUltrasoundSampleRate(sampleRate: number): void {
  const highestFrequency = ACOUSTIC_FREQUENCIES_HZ[ACOUSTIC_FREQUENCIES_HZ.length - 1];
  if (sampleRate / 2 < highestFrequency + 500) {
    throw new Error(`Audio sample rate ${sampleRate} Hz ultrasound-ku podhathu.`);
  }
}
