import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { logoutRequest } from '../services/api';

const AuthContext = createContext(null);

/** True while the server still requires this account to replace its initial password (claim `mcp`). */
function tokenRequiresPasswordChange(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return Boolean(JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))).mcp);
  } catch {
    return false;
  }
}

function readStoredUser() {
  try {
    const raw = localStorage.getItem('kgisl_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    // A corrupted entry must not white-screen the app; treat it as signed out.
    return null;
  }
}

function readStoredGate() {
  try {
    const token = localStorage.getItem('kgisl_token');
    return token ? tokenRequiresPasswordChange(token) : false;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [mustChangePassword, setMustChangePassword] = useState(readStoredGate);

  /**
   * One browser holds exactly one login (tokens live in localStorage, which every tab shares). When another tab
   * signs in as someone else, signs out, or finishes the forced password change, this tab must follow immediately.
   * Without this a tab kept showing "admin" while its requests silently went out with the faculty member's token,
   * which the server answered with "Authentication token is invalid or expired".
   */
  useEffect(() => {
    function onStorage(event) {
      if (event.key !== null && !['kgisl_user', 'kgisl_token', 'kgisl_refresh_token'].includes(event.key)) return;
      setUser(readStoredUser());
      setMustChangePassword(readStoredGate());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback((token, refreshToken, userData) => {
    localStorage.setItem('kgisl_token', token);
    localStorage.setItem('kgisl_refresh_token', refreshToken);
    localStorage.setItem('kgisl_user', JSON.stringify(userData));
    setMustChangePassword(tokenRequiresPasswordChange(token));
    setUser(userData);
  }, []);

  /** After a password change the server signs every old session out and returns a fresh pair. */
  const replaceTokens = useCallback((token, refreshToken) => {
    localStorage.setItem('kgisl_token', token);
    localStorage.setItem('kgisl_refresh_token', refreshToken);
    setMustChangePassword(tokenRequiresPasswordChange(token));
  }, []);

  const logout = useCallback(() => {
    const refreshToken = localStorage.getItem('kgisl_refresh_token');
    // Best-effort server-side revoke — don't block the UI on it, and don't let
    // a network failure prevent the client from clearing its own session.
    if (refreshToken) logoutRequest(refreshToken).catch(() => void 0);

    localStorage.removeItem('kgisl_token');
    localStorage.removeItem('kgisl_refresh_token');
    localStorage.removeItem('kgisl_user');
    setMustChangePassword(false);
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, login, logout, mustChangePassword, replaceTokens }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
