import type { AxiosResponse } from 'axios';
import { api } from '../../services/api.js';

type ApiEnvelope<T> = { success: boolean; code?: string; data: T; message?: string };

export type ClassroomBeacon = { id: string; beaconId: number; name: string; roomId: string; enabled: boolean };

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

export async function issueBeaconPacket(sessionId: string, beaconId: number): Promise<BeaconPacketIssue> {
  const response = (await api.post(`/sessions/${sessionId}/beacon-packet`, { beaconId })) as AxiosResponse<
    ApiEnvelope<Omit<BeaconPacketIssue, 'issuedAt' | 'expiresAt'> & { issuedAt: string | number; expiresAt: string | number }>
  >;
  const data = response.data.data;
  return { ...data, issuedAt: toEpochMs(data.issuedAt), expiresAt: toEpochMs(data.expiresAt) };
}

async function helperRequest<T>(path: string, helperKey: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${HELPER_URL}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', 'x-helper-key': helperKey },
    });
  } catch {
    throw new Error('Smart-board helper is not reachable. Start it on this computer (npm start in smartboard-helper).');
  }
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) throw new Error('Helper key is incorrect.');
  if (!response.ok) throw new Error(body?.message || body?.code || `Helper error ${response.status}`);
  return body as T;
}

export async function getHelperStatus(helperKey: string): Promise<HelperStatus> {
  const body = await helperRequest<{ status: string; transport: HelperStatus['transport'] }>('/health', helperKey);
  return { transport: body.transport };
}

export async function sendPacketToHelper(helperKey: string, issue: BeaconPacketIssue): Promise<void> {
  await helperRequest('/api/v1/packet', helperKey, {
    method: 'POST',
    body: JSON.stringify({ packet: issue.packet, generationId: issue.generationId, expiresAt: issue.expiresAt }),
  });
}
