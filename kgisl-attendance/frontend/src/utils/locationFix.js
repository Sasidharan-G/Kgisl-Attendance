/**
 * Keeps the browser's GPS warm while the student is scanning, so a precise fix already exists by the
 * time the QR is decoded. The reading with the smallest reported error among recent samples is used.
 * This never alters what the server accepts; it only supplies the best reading the device can give.
 */
const MAX_SAMPLE_AGE_MS = 30_000;

export function createLocationTracker() {
  let watchId = null;
  let denied = false;
  let samples = [];
  const listeners = new Set();

  const notify = () => listeners.forEach((listener) => listener());

  function start() {
    if (watchId !== null || !navigator.geolocation) return;
    denied = false;
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        samples.push({
          at: now,
          fix: { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy },
        });
        samples = samples.filter((sample) => now - sample.at <= MAX_SAMPLE_AGE_MS);
        notify();
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) { denied = true; notify(); }
      },
      // maximumAge 0: never accept a cached position; each sample is a fresh satellite/Wi-Fi fix.
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 }
    );
  }

  function stop() {
    if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    samples = [];
    listeners.clear();
  }

  function best(maxAgeMs) {
    const now = Date.now();
    let winner = null;
    for (const sample of samples) {
      if (now - sample.at > maxAgeMs) continue;
      if (!winner || sample.fix.accuracy < winner.accuracy) winner = sample.fix;
    }
    return winner;
  }

  /**
   * Resolves as soon as the best recent fix is within `goodEnough` metres; otherwise keeps sampling
   * until `maxWaitMs` and resolves with the best available reading.
   */
  function getBest({ goodEnough = 15, maxWaitMs = 10_000, maxAgeMs = 20_000, onProgress } = {}) {
    start();
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fix, error) => {
        if (settled) return;
        settled = true;
        listeners.delete(check);
        clearTimeout(timer);
        if (error) reject(error); else resolve(fix);
      };
      const permissionError = { code: 'GPS_REQUIRED', message: 'Precise location permission is required to mark attendance.' };
      const check = () => {
        if (denied) return finish(null, permissionError);
        const candidate = best(maxAgeMs);
        if (candidate) onProgress?.(candidate.accuracy);
        if (candidate && candidate.accuracy <= goodEnough) finish(candidate);
      };
      const timer = setTimeout(() => {
        const candidate = best(maxAgeMs);
        if (candidate) finish(candidate);
        else finish(null, denied ? permissionError : { code: 'GPS_REQUIRED', message: 'Could not get your location. Turn on precise location and try again.' });
      }, maxWaitMs);
      if (!navigator.geolocation) return finish(null, { code: 'GPS_REQUIRED', message: 'Geolocation is not supported by this browser.' });
      listeners.add(check);
      check();
    });
  }

  return { start, stop, getBest };
}
