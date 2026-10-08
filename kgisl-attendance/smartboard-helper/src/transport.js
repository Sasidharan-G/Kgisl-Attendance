import { serialFrame } from './packet.js';
import { listCandidatePorts } from './ports.js';

export class VirtualTransport {
  constructor() {
    this.connected = true;
    this.frames = [];
  }

  async writePacket(packet) {
    const frame = serialFrame(packet);
    this.frames.push({ frame, receivedAt: Date.now() });
    if (this.frames.length > 50) this.frames.shift();
  }

  async ensureOpen() {}

  status() {
    return { type: 'virtual', connected: this.connected, packetsWritten: this.frames.length };
  }

  async close() {
    this.connected = false;
  }
}

export class SerialTransport {
  constructor(path, baudRate) {
    this.configuredPath = path;
    this.path = path === 'auto' ? '' : path;
    this.baudRate = baudRate;
    this.port = null;
    this.reconnects = 0;
    this.lastError = null;
    this.lastAckAt = null;
    this.rxBuffer = '';
    this.waiters = [];
  }

  /** Opens one specific port and verifies that it speaks the KGS1 protocol. */
  async openPath(path) {
    const { SerialPort } = await import('serialport');
    const port = new SerialPort({ path, baudRate: this.baudRate, autoOpen: false });
    await new Promise((resolve, reject) => port.open((error) => error ? reject(error) : resolve()));
    this.port = port;
    this.path = path;
    this.rxBuffer = '';
    port.on('data', (chunk) => this.handleData(chunk));
    port.on('error', (error) => { this.lastError = error.message; });
    try {
      // Opening a typical ESP32 serial port resets the board. Give firmware time
      // to boot, then verify that the expected KGS1 protocol is actually present.
      await new Promise((resolve) => setTimeout(resolve, 900));
      await this.exchange('PING\n', 'PONG:KGS1', 2500);
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  async open() {
    if (this.configuredPath !== 'auto') return this.openPath(this.configuredPath);
    const candidates = await listCandidatePorts();
    if (candidates.length === 0) throw new Error('No USB serial device found. Plug the ESP32 into this computer.');
    let lastError = null;
    for (const candidate of candidates) {
      try { await this.openPath(candidate); return; } catch (error) { lastError = error; }
    }
    throw new Error(`No ESP32 beacon found on ${candidates.join(', ')} (${lastError?.message ?? 'no response'}).`);
  }

  /** Connects to the ESP32 now (used by the web app's one-click start) instead of on the first packet. */
  async ensureOpen() {
    if (this.port?.isOpen) return;
    try { await this.open(); this.reconnects += 1; this.lastError = null; }
    catch (error) { this.lastError = error.message; throw error; }
  }

  async writePacket(packet) {
    if (!this.port?.isOpen) { await this.open(); this.reconnects += 1; }
    const frame = serialFrame(packet);
    try { await this.exchange(frame, 'ACK:KGS1'); this.lastError = null; }
    catch (error) {
      this.lastError = error.message;
      await this.close();
      await this.open();
      this.reconnects += 1;
      await this.exchange(frame, 'ACK:KGS1');
      this.lastError = null;
    }
  }

  async writeFrame(frame) {
    await new Promise((resolve, reject) => {
      this.port.write(frame, (writeError) => {
        if (writeError) return reject(writeError);
        this.port.drain((drainError) => drainError ? reject(drainError) : resolve());
      });
    });
  }

  handleData(chunk) {
    this.rxBuffer += chunk.toString('utf8');
    let newline;
    while ((newline = this.rxBuffer.indexOf('\n')) >= 0) {
      const line = this.rxBuffer.slice(0, newline).trim();
      this.rxBuffer = this.rxBuffer.slice(newline + 1);
      const waiterIndex = this.waiters.findIndex((waiter) => line === waiter.expected);
      if (waiterIndex >= 0) {
        const [waiter] = this.waiters.splice(waiterIndex, 1);
        clearTimeout(waiter.timeout);
        this.lastAckAt = Date.now();
        waiter.resolve();
      }
    }
  }

  async exchange(frame, expected, timeoutMs = 1800) {
    const response = new Promise((resolve, reject) => {
      const waiter = { expected, resolve, reject, timeout: null };
      waiter.timeout = setTimeout(() => {
        this.waiters = this.waiters.filter((candidate) => candidate !== waiter);
        reject(new Error(`ESP32 response timeout: ${expected}`));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
    try {
      await this.writeFrame(frame);
      await response;
    } catch (error) {
      const waiterIndex = this.waiters.findIndex((waiter) => waiter.expected === expected);
      if (waiterIndex >= 0) {
        const [waiter] = this.waiters.splice(waiterIndex, 1);
        clearTimeout(waiter.timeout);
      }
      throw error;
    }
  }

  status() {
    return { type: 'serial', connected: Boolean(this.port?.isOpen), port: this.path, baudRate: this.baudRate, reconnects: this.reconnects, lastError: this.lastError, lastAckAt: this.lastAckAt };
  }

  async close() {
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error('ESP32 serial port closed'));
    }
    if (!this.port?.isOpen) return;
    await new Promise((resolve) => this.port.close(() => resolve()));
  }
}

export async function createTransport(config) {
  if (config.transport === 'virtual') return new VirtualTransport();
  const transport = new SerialTransport(config.serialPort, config.baudRate);
  // Not fatal: the board may be plugged in after the helper starts. The first packet retries.
  try { await transport.open(); } catch (error) { transport.lastError = error.message; console.warn(`[smartboard-helper] ESP32 not ready yet: ${error.message}`); }
  return transport;
}
