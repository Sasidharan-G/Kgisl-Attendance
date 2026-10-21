import crypto from 'node:crypto';
import fs from 'node:fs';

/** Origins that may talk to the helper by default: the hosted site and the local dev site. */
export const DEFAULT_ORIGINS = 'https://kgisl-attendance.onrender.com,http://localhost:5173';

/** Parses KEY=VALUE lines (quotes and # comments allowed) into a plain object. */
export function parseEnv(text) {
  const values = {};
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[name] = value;
  }
  return values;
}

/** 48 URL-safe characters: long enough for the helper, and accepted by the website's pairing pattern. */
export function generateHelperKey() {
  return crypto.randomBytes(36).toString('base64url').slice(0, 48);
}

function keyIsUsable(key) {
  return typeof key === 'string' && key.length >= 32 && !/replace-with/i.test(key);
}

export function readEnvFile(file) {
  try { return parseEnv(fs.readFileSync(file, 'utf8')); } catch { return {}; }
}

/**
 * Makes the helper zero-config: creates `.env` when missing and fills every setting the classroom needs
 * (a secret key, USB serial transport with automatic port detection, the allowed website origins).
 * Existing values are never overwritten, except an unusable (missing, short or placeholder) key.
 */
export function ensureEnvFile(file) {
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { /* first run: no file yet */ }
  const values = parseEnv(text);
  let lines = text === '' ? [] : text.replace(/\r?\n$/, '').split(/\r?\n/);
  let changed = false;

  const setValue = (name, value) => {
    lines = lines.filter((line) => !new RegExp(`^\\s*${name}\\s*=`).test(line));
    lines.push(`${name}=${value}`);
    values[name] = value;
    changed = true;
  };

  if (!keyIsUsable(values.HELPER_API_KEY)) setValue('HELPER_API_KEY', generateHelperKey());
  if (!values.HELPER_TRANSPORT) setValue('HELPER_TRANSPORT', 'serial');
  if (!values.ESP32_SERIAL_PORT) setValue('ESP32_SERIAL_PORT', 'auto');
  if (!values.HELPER_PORT) setValue('HELPER_PORT', '43821');
  if (!values.HELPER_ALLOWED_ORIGIN) setValue('HELPER_ALLOWED_ORIGIN', DEFAULT_ORIGINS);

  if (changed) fs.writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
  return values;
}

/** Copies file values into the environment without overriding anything that is already set. */
export function applyEnv(values, env = process.env) {
  for (const [name, value] of Object.entries(values)) {
    if (env[name] === undefined) env[name] = value;
  }
}
