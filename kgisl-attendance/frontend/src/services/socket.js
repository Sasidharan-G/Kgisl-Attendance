import { io } from 'socket.io-client';
import { api } from './api.js';

let socket = null;
let lastRefreshNudge = 0;

/** Lazily creates a single authenticated socket connection for the session. */
export function getSocket() {
  // Reuse the existing socket even while it is reconnecting. Creating another one on every call
  // leaked a second connection that also received (and double-processed) every event.
  if (socket) return socket;

  socket = io('/', {
    path: '/socket.io',
    // A function is evaluated on every (re)connection attempt, so a reconnect after a network blip sends the
    // CURRENT access token. A fixed `{ token }` captured at page load was rejected as expired after 15 minutes,
    // which silently froze the live QR and the scan list for the rest of the class.
    auth: (callback) => callback({ token: localStorage.getItem('kgisl_token') }),
    // Start with long-polling and upgrade to WebSocket. Some free hosting
    // proxies temporarily reject WebSocket upgrades during wake-up/redeploy.
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
  });

  // If the stored access token has expired, any authenticated API call refreshes it (see the axios interceptor);
  // the next reconnection attempt then picks the new token up from localStorage.
  socket.on('connect_error', (error) => {
    if (error?.message !== 'UNAUTHORIZED') return;
    const now = Date.now();
    if (now - lastRefreshNudge < 20_000) return;
    lastRefreshNudge = now;
    api.get('/sessions/active/mine').catch(() => undefined);
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
