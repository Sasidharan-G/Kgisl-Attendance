import test from 'node:test';
import assert from 'node:assert/strict';
import { rankPorts } from '../src/ports.js';
import { parseOrigins } from '../src/config.js';

test('ESP32 USB adapters are tried before unrelated serial ports', () => {
  const ranked = rankPorts([
    { path: 'COM1' },
    { path: 'COM5', vendorId: '10C4' },
    { path: 'COM7', vendorId: '1a86' },
  ]);
  assert.deepEqual(ranked, ['COM5', 'COM7', 'COM1']);
});

test('origin list is trimmed and trailing slashes removed', () => {
  assert.deepEqual(parseOrigins(' https://a.com/ , http://localhost:5173 ,'), ['https://a.com', 'http://localhost:5173']);
});
