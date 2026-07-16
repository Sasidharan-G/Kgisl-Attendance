import type { AxiosResponse } from 'axios';
import { api } from '../../services/api.js';

type ApiEnvelope<T> = { success: boolean; code?: string; data: T; message?: string };

export type AcousticToken = {
  token: string;
  generationId: string;
  issuedAt: number;
  expiresAt: number;
  refreshAfterMs: number;
};

export type GpsReading = { lat: number; lng: number; accuracy: number };

export type AcousticAttendanceResult = {
  attendanceId: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  rollNo: string;
  subjectName: string;
  status: string;
  method: 'ACOUSTIC';
  markedAt: string;
  distanceMeters?: number;
  gpsAccuracy?: number;
};

type TokenWire = Omit<AcousticToken, 'issuedAt' | 'expiresAt'> & {
  issuedAt: string | number;
  expiresAt: string | number;
};

function toEpochMs(value: string | number): number {
  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error('Backend returned an invalid acoustic token timestamp.');
  return timestamp;
}
export async function issueAcousticToken(sessionId: string): Promise<AcousticToken> {
  const response = (await api.post(`/sessions/${sessionId}/acoustic-token`)) as AxiosResponse<ApiEnvelope<TokenWire>>;
  return {
    ...response.data.data,
    issuedAt: toEpochMs(response.data.data.issuedAt),
    expiresAt: toEpochMs(response.data.data.expiresAt),
  };
}

export async function revokeAcousticToken(sessionId: string): Promise<void> {
  await api.delete(`/sessions/${sessionId}/acoustic-token`);
}

export async function submitAcousticAttendance(payload: {
  token: string;
  deviceId: string;
  gps: GpsReading;
}): Promise<AcousticAttendanceResult> {
  const response = (await api.post('/scan/acoustic', payload)) as AxiosResponse<ApiEnvelope<AcousticAttendanceResult>>;
  return response.data.data;
}
