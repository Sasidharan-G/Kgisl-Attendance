import { AcousticError } from './errors';
import type { GpsReading } from './acousticApi';

export type LocationProgress = { accuracy: number; samples: number };
export type LocationTask = { promise: Promise<GpsReading>; cancel: () => void };

export function getStableDeviceId(): string {
  const storageKey = 'kgisl_device_id';
  const existing = localStorage.getItem(storageKey);
  if (existing) return existing;
  const id = typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `device-${Date.now()}-${Array.from(crypto.getRandomValues(new Uint32Array(3))).join('-')}`;
  localStorage.setItem(storageKey, id);
  return id;
}
export function startAccurateLocation(onProgress?: (progress: LocationProgress) => void): LocationTask {
  let watchId: number | undefined;
  let timerId: number | undefined;
  let rejectTask: ((reason: AcousticError) => void) | undefined;
  let settled = false;
  let best: GpsReading | null = null;
  let samples = 0;

  const promise = new Promise<GpsReading>((resolve, reject) => {
    rejectTask = reject;
    const finish = (result?: GpsReading, error?: AcousticError) => {
      if (settled) return;
      settled = true;
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      if (timerId !== undefined) window.clearTimeout(timerId);
      if (error) reject(error);
      else if (result) resolve(result);
    };

    if (!navigator.geolocation) {
      finish(undefined, new AcousticError('GPS_REQUIRED', 'This browser does not support location services.'));
      return;
    }

    timerId = window.setTimeout(() => {
      if (best) finish(best);
      else finish(undefined, new AcousticError('GPS_REQUIRED', 'A precise location could not be obtained. Enable GPS and try again.'));
    }, 10_000);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        samples += 1;
        const reading: GpsReading = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        if (!best || reading.accuracy < best.accuracy) best = reading;
        onProgress?.({ accuracy: best.accuracy, samples });
        if (samples >= 2 && best.accuracy <= 25) finish(best);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          finish(undefined, new AcousticError('GPS_REQUIRED', 'Attendance-ku precise location permission mandatory.'));
        }
      },
      { enableHighAccuracy: true, timeout: 9_000, maximumAge: 0 },
    );
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      if (timerId !== undefined) window.clearTimeout(timerId);
      rejectTask?.(new AcousticError('LOCATION_CANCELLED', 'Location request cancelled.'));
    },
  };
}
