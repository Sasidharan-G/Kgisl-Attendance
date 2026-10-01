import { serialFrame } from './packet.js';

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

  status() {
    return { type: 'virtual', connected: this.connected, packetsWritten: this.frames.length };
  }

  async close() {
    this.connected = false;
  }
}

export class SerialTransport {
  constructor(path, baudRate) {
    this.path = path;
    this.baudRate = baudRate;
    this.port = null;
    this.reconnects = 0;
    this.lastError = null;
    this.lastAckAt = null;
    this.rxBuffer = '';
    this.waiters = [];
  }

  async open() {
    if (!this.path) throw new Error('ESP32_SERIAL_PORT is required in serial mode');
    const { SerialPort } = await import('serialport');
    this.port = new SerialPort({ path: this.path, baudRate: this.baudRate, autoOpen: false });
    await new Promise((resolve, reject) => this.port.open((error) => error ? reject(error) : resolve()));
    this.port.on('data', (chunk) => this.handleData(chunk));
    // Opening a typical ESP32 serial port resets the board. Give firmware time
    // to boot, then verify that the expected KGS1 protocol is actually present.
    await new Promise((resolve) => setTimeout(resolve, 700));
    await this.exchange('PING\n', 'PONG:KGS1', 2500);
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
  await transport.open();
  return transport;
}
