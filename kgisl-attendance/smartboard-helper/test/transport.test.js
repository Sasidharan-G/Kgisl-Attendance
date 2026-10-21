import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SerialTransport } from '../src/transport.js';
import { ensureEnvFile, parseEnv, DEFAULT_ORIGINS } from '../src/envFile.js';

const packetBytes = Buffer.concat([Buffer.from([0x4b, 1]), Buffer.alloc(19)]);
packetBytes.writeUInt32BE(Math.floor(Date.now() / 1000), 4);
const packet = packetBytes.toString('base64url');

/** Behaves like an ESP32 running the KGS1 firmware behind a USB-serial adapter. */
function createFakeBoard({ bootMs = 0, answersPing = true } = {}) {
  const instances = [];
  class FakePort extends EventEmitter {
    constructor(options) {
      super();
      this.path = options.path;
      this.isOpen = false;
      this.written = [];
      instances.push(this);
    }

    open(callback) {
      this.isOpen = true;
      setImmediate(() => callback(null));
      // Opening the port resets the board; it prints READY once it has booted.
      if (answersPing) setTimeout(() => this.isOpen && this.emit('data', Buffer.from('READY:KGS1\n')), bootMs);
    }

    write(data, callback) {
      const line = data.toString().trim();
      this.written.push(line);
      callback(null);
      setImmediate(() => {
        if (!this.isOpen || !answersPing) return;
        if (line === 'PING') this.emit('data', Buffer.from('PONG:KGS1\n'));
        else if (line.startsWith('KGS1:')) this.emit('data', Buffer.from('ACK:KGS1\n'));
      });
    }

    drain(callback) { callback(null); }

    close(callback) {
      this.isOpen = false;
      this.emit('close');
      callback?.(null);
    }
  }
  return { FakePort, instances };
}

function makeTransport(board, ports, overrides = {}) {
  return new SerialTransport('auto', 115200, {
    SerialPort: board.FakePort,
    listPorts: async () => ports,
    sleep: async () => undefined,
    handshakeTimeoutMs: 30,
    ...overrides,
  });
}

test('monitor connects by itself when the ESP32 is plugged in after start-up', async () => {
  const board = createFakeBoard();
  const ports = [];
  const transport = makeTransport(board, ports);

  await transport.probe();
  assert.equal(transport.status().connected, false);
  assert.match(transport.status().lastError, /No USB serial device/);

  ports.push({ path: 'COM7', vendorId: '10C4' }); // CP210x, as on most ESP32 dev boards
  await transport.probe();
  assert.equal(transport.status().connected, true);
  assert.equal(transport.status().port, 'COM7');
  assert.deepEqual(transport.status().detected, ['COM7']);

  await transport.writePacket(packet);
  assert.ok(board.instances.at(-1).written.includes(`KGS1:${packet}`));
});

test('unplugging then re-plugging reconnects without a restart', async () => {
  const board = createFakeBoard();
  const ports = [{ path: 'COM7', vendorId: '1a86' }];
  const transport = makeTransport(board, ports);
  await transport.probe();
  assert.equal(transport.status().connected, true);

  // USB cable pulled: the OS closes the port and the device disappears from the list.
  ports.length = 0;
  board.instances.at(-1).emit('close');
  assert.equal(transport.status().connected, false);

  ports.push({ path: 'COM9', vendorId: '1a86' }); // re-plugged, possibly on another COM number
  await transport.probe();
  assert.equal(transport.status().connected, true);
  assert.equal(transport.status().port, 'COM9');
});

test('the monitor ignores non-ESP serial ports (e.g. Bluetooth virtual COM ports)', async () => {
  const board = createFakeBoard();
  const transport = makeTransport(board, [{ path: 'COM3', vendorId: undefined }]);
  await transport.probe();
  assert.equal(board.instances.length, 0);
  assert.equal(transport.status().connected, false);
});

test('an explicit connect also tries unknown clone chips', async () => {
  const board = createFakeBoard();
  const transport = makeTransport(board, [{ path: 'COM5', vendorId: 'ffff' }]);
  await transport.ensureOpen();
  assert.equal(transport.status().connected, true);
  assert.equal(transport.status().port, 'COM5');
});

test('writePacket opens the board on demand when nothing connected it yet', async () => {
  const board = createFakeBoard();
  const transport = makeTransport(board, [{ path: 'COM4', vendorId: '10c4' }]);
  await transport.writePacket(packet);
  assert.equal(transport.status().connected, true);
  assert.ok(transport.status().lastAckAt);
});

test('a device that never answers PING is rejected and backed off', async () => {
  const board = createFakeBoard({ answersPing: false });
  const transport = makeTransport(board, [{ path: 'COM8', vendorId: '10c4' }]);
  await transport.probe();
  assert.equal(transport.status().connected, false);
  assert.match(transport.status().lastError, /No ESP32 beacon found|No KGiSL beacon answered/);
  const attempts = board.instances.length;
  await transport.probe(); // inside the back-off window: must not poke the board again
  assert.equal(board.instances.length, attempts);
});

test('ensureEnvFile creates a complete, zero-config .env and keeps existing values', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kgisl-helper-'));
  const file = path.join(dir, '.env');
  try {
    const first = ensureEnvFile(file);
    assert.ok(first.HELPER_API_KEY.length >= 32);
    assert.match(first.HELPER_API_KEY, /^[A-Za-z0-9_-]+$/);
    assert.equal(first.HELPER_TRANSPORT, 'serial');
    assert.equal(first.ESP32_SERIAL_PORT, 'auto');
    assert.equal(first.HELPER_ALLOWED_ORIGIN, DEFAULT_ORIGINS);

    const second = ensureEnvFile(file);
    assert.equal(second.HELPER_API_KEY, first.HELPER_API_KEY);

    fs.writeFileSync(file, 'HELPER_API_KEY=replace-with-at-least-32-random-characters\nHELPER_PORT=5000\n');
    const repaired = ensureEnvFile(file);
    assert.notEqual(repaired.HELPER_API_KEY, 'replace-with-at-least-32-random-characters');
    assert.ok(repaired.HELPER_API_KEY.length >= 32);
    assert.equal(repaired.HELPER_PORT, '5000');
    assert.equal(parseEnv(fs.readFileSync(file, 'utf8')).HELPER_API_KEY, repaired.HELPER_API_KEY);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
