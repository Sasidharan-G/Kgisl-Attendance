import { createContext, useContext, useState, useCallback } from 'react';
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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('kgisl_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [mustChangePassword, setMustChangePassword] = useState(() => {
    const token = localStorage.getItem('kgisl_token');
    return token ? tokenRequiresPasswordChange(token) : false;
  });

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
