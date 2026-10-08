const STORAGE_KEY = 'kgisl_helper_key';

/**
 * Key that lets this browser talk to the smart-board helper running on the classroom PC.
 * Order: key remembered in this browser, then the build-time default used in local development.
 */
export function readHelperKey(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch { /* storage unavailable */ }
  return (import.meta.env.VITE_HELPER_KEY as string | undefined) ?? '';
}

export function saveHelperKey(key: string): void {
  try { localStorage.setItem(STORAGE_KEY, key); } catch { /* storage unavailable */ }
}

/**
 * The classroom launcher opens the site as `/#helperKey=...`. Fragments are never sent to a
 * server, so this pairs the browser with the local helper without typing and without leaking the key.
 */
export function capturePairingFromUrl(): void {
  if (typeof window === 'undefined') return;
  const match = /[#&]helperKey=([A-Za-z0-9_-]{32,128})/.exec(window.location.hash);
  if (!match) return;
  saveHelperKey(match[1]);
  const cleaned = window.location.hash.replace(/[#&]?helperKey=[A-Za-z0-9_-]+/, '').replace(/^#&/, '#');
  window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${cleaned === '#' ? '' : cleaned}`);
}
