import test from 'node:test';
import assert from 'node:assert/strict';
import { createHelperServer } from '../src/server.js';
import { VirtualTransport } from '../src/transport.js';

const key = 'test-helper-key-with-at-least-32-characters';
const packetBytes = Buffer.concat([Buffer.from([0x4b, 1]), Buffer.alloc(19)]);
packetBytes.writeUInt32BE(Math.floor(Date.now() / 1000), 4);
const packet = packetBytes.toString('base64url');

async function fixture() {
  const transport = new VirtualTransport();
  const server = createHelperServer({ apiKey: key, allowedOrigin: 'http://localhost:5173' }, transport);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  return { transport, server, baseUrl: `http://127.0.0.1:${address.port}` };
}

test('authorized packet is framed and forwarded to the virtual ESP32', async (t) => {
  const { transport, server, baseUrl } = await fixture();
  t.after(() => server.close());
  const response = await fetch(`${baseUrl}/api/v1/packet`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-helper-key': key, origin: 'http://localhost:5173' },
    body: JSON.stringify({ packet, generationId: 'test-generation', expiresAt: Date.now() + 30_000 }),
  });
  assert.equal(response.status, 202);
  assert.equal(transport.frames.length, 1);
  assert.equal(transport.frames[0].frame, `KGS1:${packet}\n`);
});

test('helper rejects missing key, foreign origin, malformed packet, and stale packet', async (t) => {
  const { server, baseUrl } = await fixture();
  t.after(() => server.close());
  const options = (body, extraHeaders = {}) => ({
    method: 'POST', headers: { 'content-type': 'application/json', 'x-helper-key': key, ...extraHeaders }, body: JSON.stringify(body),
  });
  assert.equal((await fetch(`${baseUrl}/api/v1/packet`, { method: 'POST' })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/v1/packet`, options({ packet }, { origin: 'https://evil.example' }))).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/v1/packet`, options({ packet: 'bad' }))).status, 400);
  assert.equal((await fetch(`${baseUrl}/api/v1/packet`, options({ packet, expiresAt: Date.now() - 1 }))).status, 410);
});

test('multiple origins are allowed and unknown origins are rejected', async (t) => {
  const transport = new VirtualTransport();
  const server = createHelperServer({ apiKey: key, allowedOrigins: ['https://app.example.com', 'http://localhost:5173'] }, transport);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const ask = (origin) => fetch(`${base}/health`, { headers: { 'x-helper-key': key, origin } });
  assert.equal((await ask('https://app.example.com')).status, 200);
  assert.equal((await ask('http://localhost:5173')).status, 200);
  assert.equal((await ask('https://evil.example')).status, 403);
});

test('an unplugged ESP32 returns 503 instead of a packet error', async (t) => {
  const transport = { writePacket: async () => { throw new Error('No USB serial device found.'); }, status: () => ({ connected: false }) };
  const server = createHelperServer({ apiKey: key, allowedOrigins: [] }, transport);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/packet`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-helper-key': key }, body: JSON.stringify({ packet }),
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'ESP32_UNAVAILABLE');
});
