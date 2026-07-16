export type AcousticErrorCode =
  | 'AUDIO_UNSUPPORTED'
  | 'INSECURE_CONTEXT'
  | 'MIC_PERMISSION_DENIED'
  | 'MIC_NOT_FOUND'
  | 'MIC_BUSY'
  | 'SAMPLE_RATE_UNSUPPORTED'
  | 'GPS_REQUIRED'
  | 'LOCATION_CANCELLED'
  | 'DECODE_TIMEOUT';

export class AcousticError extends Error {
  readonly code: AcousticErrorCode;

  constructor(code: AcousticErrorCode, message: string) {
    super(message);
    this.name = 'AcousticError';
    this.code = code;
  }
}
export function toAcousticError(error: unknown): AcousticError {
  if (error instanceof AcousticError) return error;
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return new AcousticError('MIC_PERMISSION_DENIED', 'Microphone permission denied. Use Beta QR attendance instead.');
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return new AcousticError('MIC_NOT_FOUND', 'Indha device-la working microphone kandupidikka mudiyala.');
    }
    if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      return new AcousticError('MIC_BUSY', 'Microphone vera app use pannudhu. Andha app-a close pannitu retry pannunga.');
    }
  }
  return new AcousticError('AUDIO_UNSUPPORTED', error instanceof Error ? error.message : 'Acoustic audio start panna mudiyala.');
}
