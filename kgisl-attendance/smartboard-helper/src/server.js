import http from 'node:http';
import { helperKeyMatches } from './config.js';
import { packetIssuedAt, validateBeaconPacketShape } from './packet.js';

const MAX_BODY_BYTES = 2048;

function json(response, status, body, origin) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...(origin ? {
      'access-control-allow-origin': origin,
      'access-control-allow-headers': 'content-type,x-helper-key',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      // Chrome Private Network Access: a public HTTPS page may call loopback only if the preflight opts in.
      'access-control-allow-private-network': 'true',
      // Chrome Private Network Access: a public HTTPS page may call loopback only if the preflight opts in.
      'access-control-allow-private-network': 'true',
      vary: 'Origin',
    } : {}),
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new Error('request body is too large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createHelperServer(config, transport) {
  let latest = null;
  return http.createServer(async (request, response) => {
    const origin = request.headers.origin;
    const corsOrigin = origin === config.allowedOrigin ? origin : undefined;
    if (origin && !corsOrigin) return json(response, 403, { success: false, code: 'ORIGIN_DENIED' });
    if (request.method === 'OPTIONS') return json(response, 204, {}, corsOrigin);
    if (!helperKeyMatches(config.apiKey, request.headers['x-helper-key'])) {
      return json(response, 401, { success: false, code: 'HELPER_AUTH_REQUIRED' }, corsOrigin);
    }

    if (request.method === 'GET' && request.url === '/health') {
      return json(response, 200, { status: 'ok', transport: transport.status() }, corsOrigin);
    }
    if (request.method === 'GET' && request.url === '/api/v1/status') {
      return json(response, 200, { success: true, data: { transport: transport.status(), latest } }, corsOrigin);
    }
    if (request.method === 'POST' && request.url === '/api/v1/packet') {
      try {
        const body = await readJson(request);
        const packet = validateBeaconPacketShape(body.packet);
        const packetDeadline = packetIssuedAt(packet) + 30_000;
        if (packetDeadline <= Date.now()) {
          return json(response, 410, { success: false, code: 'PACKET_EXPIRED' }, corsOrigin);
        }
        if (body.expiresAt !== undefined && (!Number.isFinite(body.expiresAt) || body.expiresAt <= Date.now())) {
          return json(response, 410, { success: false, code: 'PACKET_EXPIRED' }, corsOrigin);
        }
        await transport.writePacket(packet);
        latest = { packet, generationId: body.generationId ?? null, expiresAt: Math.min(body.expiresAt ?? packetDeadline, packetDeadline), writtenAt: Date.now() };
        return json(response, 202, { success: true, data: latest }, corsOrigin);
      } catch (error) {
        return json(response, 400, { success: false, code: 'INVALID_PACKET', message: error.message }, corsOrigin);
      }
    }
    return json(response, 404, { success: false, code: 'NOT_FOUND' }, corsOrigin);
  });
}
