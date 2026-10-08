import crypto from 'node:crypto';

function integer(value, fallback, minimum, maximum) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Expected an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}

export function parseOrigins(value) {
  return String(value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export function loadConfig(env = process.env, args = process.argv.slice(2)) {
  const virtualFlag = args.includes('--virtual');
  const apiKey = env.HELPER_API_KEY ?? (virtualFlag || env.NODE_ENV === 'test'
    ? 'development-only-helper-key-123456'
    : '');
  if (apiKey.length < 32) throw new Error('HELPER_API_KEY must contain at least 32 characters');

  const transport = virtualFlag ? 'virtual' : (env.HELPER_TRANSPORT ?? 'serial');
  if (!['virtual', 'serial'].includes(transport)) throw new Error('HELPER_TRANSPORT must be virtual or serial');

  return {
    host: '127.0.0.1',
    port: integer(env.HELPER_PORT, 43821, 0, 65535),
    apiKey,
    // Comma-separated list, e.g. "https://app.example.com,http://localhost:5173".
    allowedOrigins: parseOrigins(env.HELPER_ALLOWED_ORIGIN ?? 'http://localhost:5173'),
    transport,
    // "auto" (or empty) detects the ESP32 USB-serial adapter by itself.
    serialPort: (env.ESP32_SERIAL_PORT ?? '').trim() || 'auto',
    baudRate: integer(env.ESP32_BAUD_RATE, 115200, 1200, 2_000_000),
  };
}

export function helperKeyMatches(expected, actual) {
  if (typeof actual !== 'string') return false;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}
