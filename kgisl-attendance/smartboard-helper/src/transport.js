import { serialFrame } from './packet.js';
import { isLikelyEspPort, rankPorts } from './ports.js';

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

/** After a failed probe, wait this long before trying the same board again (each open resets an ESP32). */
const PROBE_BACKOFF_MS = 5_000;
const HANDSHAKE_ATTEMPTS = 6;

async function loadSerialPort() {
  return (await import('serialport')).SerialPort;
}

export class SerialTransport {
  /**
   * `deps` exists for tests: { SerialPort, listPorts, sleep }. In production the real `serialport` package is used.
   */
  constructor(path, baudRate, deps = {}) {
    this.configuredPath = path;
    this.path = path === 'auto' ? '' : path;
    this.baudRate = baudRate;
    this.port = null;
    this.reconnects = 0;
    this.lastError = null;
    this.lastAckAt = null;
    this.rxBuffer = '';
    this.waiters = [];
    this.opening = null;
    this.monitor = null;
    this.monitorBusy = false;
    this.nextProbeAt = 0;
    this.detected = [];
    this.getSerialPortClass = deps.SerialPort ? async () => deps.SerialPort : loadSerialPort;
    this.listPorts = deps.listPorts ?? (async () => (await loadSerialPort()).list());
    this.sleep = deps.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
    this.handshakeTimeoutMs = deps.handshakeTimeoutMs ?? 700;
  }

  /** Opens one specific port and verifies that it speaks the KGS1 protocol. */
  async openPath(path) {
    const SerialPort = await this.getSerialPortClass();
    const port = new SerialPort({ path, baudRate: this.baudRate, autoOpen: false });
    await new Promise((resolve, reject) => port.open((error) => (error ? reject(error) : resolve())));
    this.port = port;
    this.path = path;
    this.rxBuffer = '';
    port.on('data', (chunk) => this.handleData(chunk));
    port.on('error', (error) => { this.lastError = error.message; });
    port.on('close', () => {
      // Unplugged (or closed by us): forget the port so the monitor / next packet reconnects.
      if (this.port === port) {
        this.port = null;
        this.lastError = 'ESP32 was unplugged or the serial port closed.';
      }
      this.rejectWaiters(new Error('ESP32 serial port closed'));
    });
    try {
      await this.handshake();
    } catch (error) {
      await this.close();
      throw error;
    }
  }

  /**
   * Opening a typical ESP32 serial port resets the board, so the first PINGs may go unanswered while it boots.
   * Keep asking for a few seconds instead of giving up on the first lost reply.
   */
  async handshake() {
    await this.sleep(700);
    let lastError = null;
    for (let attempt = 0; attempt < HANDSHAKE_ATTEMPTS; attempt += 1) {
      try {
        await this.exchange('PING\n', 'PONG:KGS1', this.handshakeTimeoutMs);
        return;
      } catch (error) {
        lastError = error;
        if (!this.port?.isOpen) break;
      }
    }
    throw new Error(`No KGiSL beacon answered on ${this.path} (${lastError?.message ?? 'no response'}).`);
  }

  async openNow({ onlyLikely = false } = {}) {
    if (this.port?.isOpen) return;
    if (this.configuredPath !== 'auto') {
      await this.openPath(this.configuredPath);
      return;
    }
    const ports = await this.listPorts();
    this.detected = ports.filter(isLikelyEspPort).map((port) => port.path);
    // The background monitor only probes boards with a known ESP32 USB-serial chip, so it never pokes at
    // Bluetooth virtual COM ports; an explicit connect also tries everything else (unknown clone chips).
    const candidates = onlyLikely ? this.detected : rankPorts(ports);
    if (candidates.length === 0) throw new Error('No USB serial device found. Plug the ESP32 into this computer.');
    let lastError = null;
    for (const candidate of candidates) {
      try { await this.openPath(candidate); return; } catch (error) { lastError = error; }
    }
    throw new Error(`No ESP32 beacon found on ${candidates.join(', ')} (${lastError?.message ?? 'no response'}).`);
  }

  /** Single-flight: concurrent callers (monitor, connect button, packet write) share one open attempt. */
  open(options = {}) {
    if (!this.opening) {
      this.opening = this.openNow(options)
        .then(() => { this.reconnects += 1; this.lastError = null; })
        .finally(() => { this.opening = null; });
    }
    return this.opening;
  }

  /** Connects to the ESP32 now (used by the web app's one-click start) instead of on the first packet. */
  async ensureOpen() {
    if (this.port?.isOpen) return;
    try {
      await this.open();
    } catch (error) {
      this.lastError = error.message;
      throw error;
    }
  }

  /** Watches for the ESP32 being plugged in (or re-plugged) and connects to it without anyone clicking. */
  startMonitor(intervalMs = 2_000) {
    if (this.monitor) return;
    this.monitor = setInterval(() => { void this.probe(); }, intervalMs);
    this.monitor.unref?.();
  }

  stopMonitor() {
    if (this.monitor) clearInterval(this.monitor);
    this.monitor = null;
  }

  /** One monitor pass; exposed so tests (and the timer) share exactly the same code path. */
  async probe() {
    if (this.port?.isOpen || this.opening || this.monitorBusy || Date.now() < this.nextProbeAt) return;
    this.monitorBusy = true;
    try {
      await this.open({ onlyLikely: true });
      this.nextProbeAt = 0;
    } catch (error) {
      this.lastError = error.message;
      // "Nothing plugged in" is cheap to re-check every pass; a board that was found but did not answer is not.
      if (!/No USB serial device/.test(error.message)) this.nextProbeAt = Date.now() + PROBE_BACKOFF_MS;
    } finally {
      this.monitorBusy = false;
    }
  }

  async writePacket(packet) {
    if (!this.port?.isOpen) await this.open();
    const frame = serialFrame(packet);
    try {
      await this.exchange(frame, 'ACK:KGS1');
      this.lastError = null;
    } catch (error) {
      this.lastError = error.message;
      await this.close();
      await this.open();
      await this.exchange(frame, 'ACK:KGS1');
      this.lastError = null;
    }
  }

  async writeFrame(frame) {
    const port = this.port;
    if (!port?.isOpen) throw new Error('ESP32 serial port is not open');
    await new Promise((resolve, reject) => {
      port.write(frame, (writeError) => {
        if (writeError) return reject(writeError);
        port.drain((drainError) => (drainError ? reject(drainError) : resolve()));
      });
    });
  }

  handleData(chunk) {
    this.rxBuffer += chunk.toString('utf8');
    let newline;
    while ((newline = this.rxBuffer.indexOf('\n')) >= 0) {
      const line = this.rxBuffer.slice(0, newline).trim();
      this.rxBuffer = this.rxBuffer.slice(newline + 1);
      // A boot banner proves the KGS1 firmware is alive just as well as a PING reply does.
      const waiterIndex = this.waiters.findIndex(
        (waiter) => line === waiter.expected || (waiter.expected === 'PONG:KGS1' && line === 'READY:KGS1')
      );
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
    // The reply is awaited below; this keeps an early rejection (port closed while writing) from going unhandled.
    response.catch(() => undefined);
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

  rejectWaiters(error) {
    for (const waiter of this.waiters.splice(0)) {
      clearTimeout(waiter.timeout);
      waiter.reject(error);
    }
  }

  status() {
    return {
      type: 'serial',
      connected: Boolean(this.port?.isOpen),
      port: this.path,
      baudRate: this.baudRate,
      reconnects: this.reconnects,
      lastError: this.lastError,
      lastAckAt: this.lastAckAt,
      detected: this.detected,
      monitoring: Boolean(this.monitor),
    };
  }

  async close() {
    this.rejectWaiters(new Error('ESP32 serial port closed'));
    const port = this.port;
    if (!port?.isOpen) {
      this.port = null;
      return;
    }
    await new Promise((resolve) => port.close(() => resolve()));
    if (this.port === port) this.port = null;
  }
}

export async function createTransport(config) {
  if (config.transport === 'virtual') return new VirtualTransport();
  const transport = new SerialTransport(config.serialPort, config.baudRate);
  // Not fatal: the board may be plugged in after the helper starts. The monitor (and the first packet) retry.
  try { await transport.open(); } catch (error) { transport.lastError = error.message; console.warn(`[smartboard-helper] ESP32 not ready yet: ${error.message}`); }
  transport.startMonitor();
  return transport;
}
