import { describe, expect, it } from 'vitest';
import { bytesToSymbols, crc16Ccitt, decodeTokenFrame, encodeTokenFrame, symbolsToBytes } from './protocol';

describe('acoustic protocol', () => {
  it('round-trips bytes through 4-FSK symbols', () => {
    const bytes = new Uint8Array([0x00, 0x1b, 0xa5, 0xff]);
    expect(symbolsToBytes(bytesToSymbols(bytes))).toEqual(bytes);
  });

  it('round-trips a framed token through leading noise', () => {
    const frame = encodeTokenFrame('A9F2B4K7');
    expect(decodeTokenFrame([3, 3, 0, 1, ...frame])).toBe('A9F2B4K7');
  });

  it('rejects a payload corrupted after transmission', () => {
    const frame = encodeTokenFrame('A9F2B4K7');
    const corrupted = [...frame];
    corrupted[34] = ((corrupted[34] + 1) % 4) as 0 | 1 | 2 | 3;
    expect(decodeTokenFrame(corrupted)).toBeNull();
  });

  it('matches the standard CRC-16/CCITT-FALSE check value', () => {
    expect(crc16Ccitt(new TextEncoder().encode('123456789'))).toBe(0x29b1);
  });
});
