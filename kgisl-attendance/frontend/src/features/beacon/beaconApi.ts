import type { AxiosResponse } from 'axios';
import { api } from '../../services/api.js';

type ApiEnvelope<T> = { success: boolean; code?: string; data: T; message?: string };

export type ClassroomBeacon = { id: string; beaconId: number; name: string; roomId: string; enabled: boolean; room?: { id: string; name: string } };
export type BeaconInput = { beaconId: number; name: string; roomId: string; enabled: boolean };

export type BeaconPacketIssue = {
  packet: string;
  beaconId: number;
  generationId: string;
  issuedAt: number;
  expiresAt: number;
  refreshAfterMs: number;
};

export type HelperStatus = { transport: { connected?: boolean; mode?: string; [key: string]: unknown } };

const HELPER_URL = 'http://127.0.0.1:43821';

function toEpochMs(value: string | number): number {
  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error('Backend returned an invalid beacon timestamp.');
  return timestamp;
}

export async function listBeacons(): Promise<ClassroomBeacon[]> {
  const response = (await api.get('/catalog/beacons')) as AxiosResponse<ApiEnvelope<ClassroomBeacon[]>>;
  return response.data.data;
}

export async function createBeacon(input: BeaconInput): Promise<ClassroomBeacon> {
  const response = (await api.post('/catalog/beacons', input)) as AxiosResponse<ApiEnvelope<ClassroomBeacon>>;
  return response.data.data;
}

export async function updateBeacon(id: string, input: BeaconInput): Promise<ClassroomBeacon> {
  const response = (await api.patch(`/catalog/beacons/${id}`, input)) as AxiosResponse<ApiEnvelope<ClassroomBeacon>>;
  return response.data.data;
}

export async function issueBeaconPacket(sessionId: string, beaconId: number): Promise<BeaconPacketIssue> {
  const response = (await api.post(`/sessions/${sessionId}/beacon-packet`, { beaconId })) as AxiosResponse<
    ApiEnvelope<Omit<BeaconPacketIssue, 'issuedAt' | 'expiresAt'> & { issuedAt: string | number; expiresAt: string | number }>
  >;
  const data = response.data.data;
  return { ...data, issuedAt: toEpochMs(data.issuedAt), expiresAt: toEpochMs(data.expiresAt) };
}

/** Helper problems carry a stable `code` so the start-up flow can tell "keep waiting" from "give up". */
export class HelperError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'HelperError';
    this.code = code;
  }
}

async function helperRequest<T>(path: string, helperKey: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${HELPER_URL}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', 'x-helper-key': helperKey },
    });
  } catch {
    throw new HelperError('HELPER_UNREACHABLE', 'Waiting for the classroom helper on this computer. If Chrome asks to allow access to local devices, choose Allow.');
  }
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) throw new HelperError('HELPER_AUTH', 'Helper key is incorrect.');
  if (!response.ok) throw new HelperError(body?.code || 'HELPER_ERROR', body?.message || body?.code || `Helper error ${response.status}`);
  return body as T;
}

/**
 * Asks the helper for its key. The helper only answers pages served from its allowed origins, so this pairs the
 * browser with the classroom PC without anyone typing a key. Returns null when the helper is not reachable (yet).
 */
export async function pairWithHelper(): Promise<string | null> {
  try {
    const response = await fetch(`${HELPER_URL}/api/v1/pair`);
    if (!response.ok) return null;
    const body = await response.json();
    const key = body?.data?.key;
    return typeof key === 'string' && key.length >= 32 ? key : null;
  } catch {
    return null;
  }
}

export async function getHelperStatus(helperKey: string): Promise<HelperStatus> {
  const body = await helperRequest<{ status: string; transport: HelperStatus['transport'] }>('/health', helperKey);
  return { transport: body.transport };
}

/** Asks the helper to connect to the ESP32 now; rejects with a readable reason if it is unplugged. */
export async function connectHelper(helperKey: string): Promise<HelperStatus> {
  const body = await helperRequest<{ data: { transport: HelperStatus['transport'] } }>('/api/v1/connect', helperKey, { method: 'POST', body: '{}' });
  return { transport: body.data.transport };
}

export async function sendPacketToHelper(helperKey: string, issue: BeaconPacketIssue): Promise<void> {
  await helperRequest('/api/v1/packet', helperKey, {
    method: 'POST',
    body: JSON.stringify({ packet: issue.packet, generationId: issue.generationId, expiresAt: issue.expiresAt }),
  });
}

export async function revokeBeaconPacket(sessionId: string): Promise<void> {
  await api.delete(`/sessions/${sessionId}/beacon-packet`);
}
