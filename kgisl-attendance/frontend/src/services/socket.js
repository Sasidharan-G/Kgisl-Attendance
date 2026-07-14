import { io } from 'socket.io-client';

let socket = null;

/** Lazily creates a single authenticated socket connection for the session. */
export function getSocket() {
  if (socket && socket.connected) return socket;

  const token = localStorage.getItem('kgisl_token');
  socket = io('/', {
    path: '/socket.io',
    auth: { token },
    // Start with long-polling and upgrade to WebSocket. Some free hosting
    // proxies temporarily reject WebSocket upgrades during wake-up/redeploy.
    transports: ['polling', 'websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
