export type AcousticSymbol = 0 | 1 | 2 | 3;

export const ACOUSTIC_FREQUENCIES_HZ = [18_200, 18_600, 19_000, 19_400] as const;
export const SYMBOL_SECONDS = 0.035;
export const OBSERVATION_SECONDS = 0.007;
export const OBSERVATIONS_PER_SYMBOL = Math.round(SYMBOL_SECONDS / OBSERVATION_SECONDS);

const PROTOCOL_VERSION = 1;
const PREAMBLE_BYTES = new Uint8Array([0x1b, 0xe4, 0x1b, 0xe4, 0xd3, 0x91]);
const PREAMBLE_SYMBOLS = bytesToSymbols(PREAMBLE_BYTES);
const MIN_TOKEN_LENGTH = 6;
const MAX_TOKEN_LENGTH = 16;

export function crc16Ccitt(bytes: Uint8Array): number {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

export function bytesToSymbols(bytes: Uint8Array): AcousticSymbol[] {
  const symbols: AcousticSymbol[] = [];
  for (const byte of bytes) {
    symbols.push(
      ((byte >>> 6) & 0b11) as AcousticSymbol,
      ((byte >>> 4) & 0b11) as AcousticSymbol,
      ((byte >>> 2) & 0b11) as AcousticSymbol,
      (byte & 0b11) as AcousticSymbol,
    );
  }
  return symbols;
}

export function symbolsToBytes(symbols: readonly AcousticSymbol[]): Uint8Array {
  if (symbols.length % 4 !== 0) throw new Error('Acoustic symbol count must be divisible by four.');
  const bytes = new Uint8Array(symbols.length / 4);
  for (let index = 0; index < bytes.length; index += 1) {
    const offset = index * 4;
    bytes[index] =
      (symbols[offset] << 6) |
      (symbols[offset + 1] << 4) |
      (symbols[offset + 2] << 2) |
      symbols[offset + 3];
  }
  return bytes;
}

export function encodeTokenFrame(token: string): AcousticSymbol[] {
  if (!/^[A-Z0-9]+$/.test(token) || token.length < MIN_TOKEN_LENGTH || token.length > MAX_TOKEN_LENGTH) {
    throw new Error(`Acoustic token must contain ${MIN_TOKEN_LENGTH}-${MAX_TOKEN_LENGTH} uppercase letters or digits.`);
  }

  const payload = new TextEncoder().encode(token);
  const protectedBytes = new Uint8Array(2 + payload.length);
  protectedBytes[0] = PROTOCOL_VERSION;
  protectedBytes[1] = payload.length;
  protectedBytes.set(payload, 2);
  const crc = crc16Ccitt(protectedBytes);

  const frame = new Uint8Array(PREAMBLE_BYTES.length + protectedBytes.length + 2);
  frame.set(PREAMBLE_BYTES, 0);
  frame.set(protectedBytes, PREAMBLE_BYTES.length);
  frame[frame.length - 2] = crc >>> 8;
  frame[frame.length - 1] = crc & 0xff;
  return bytesToSymbols(frame);
}

/**
 * Searches an aligned symbol stream for a complete, CRC-valid frame. The frame
 * is deliberately self-describing so future token lengths remain compatible.
 */
export function decodeTokenFrame(symbols: readonly AcousticSymbol[]): string | null {
  const minimumSymbols = PREAMBLE_SYMBOLS.length + (2 + MIN_TOKEN_LENGTH + 2) * 4;
  if (symbols.length < minimumSymbols) return null;

  for (let start = 0; start <= symbols.length - minimumSymbols; start += 1) {
    let preambleErrors = 0;
    for (let index = 0; index < PREAMBLE_SYMBOLS.length; index += 1) {
      if (symbols[start + index] !== PREAMBLE_SYMBOLS[index]) preambleErrors += 1;
      if (preambleErrors > 1) break;
    }
    if (preambleErrors > 1) continue;

    const bodyStart = start + PREAMBLE_SYMBOLS.length;
    if (bodyStart + 8 > symbols.length) continue;
    const header = symbolsToBytes(symbols.slice(bodyStart, bodyStart + 8));
    const [version, payloadLength] = header;
    if (version !== PROTOCOL_VERSION || payloadLength < MIN_TOKEN_LENGTH || payloadLength > MAX_TOKEN_LENGTH) continue;

    const protectedByteLength = 2 + payloadLength;
    const bodySymbolLength = (protectedByteLength + 2) * 4;
    if (bodyStart + bodySymbolLength > symbols.length) continue;

    const body = symbolsToBytes(symbols.slice(bodyStart, bodyStart + bodySymbolLength));
    const protectedBytes = body.slice(0, protectedByteLength);
    const expectedCrc = (body[protectedByteLength] << 8) | body[protectedByteLength + 1];
    if (crc16Ccitt(protectedBytes) !== expectedCrc) continue;

    const token = new TextDecoder().decode(protectedBytes.slice(2));
    if (/^[A-Z0-9]{6,16}$/.test(token)) return token;
  }
  return null;
}
