import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getGoogleAuthConfig, loginGoogle } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

let googleScriptPromise;
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-google-identity]');
      if (existing) { existing.addEventListener('load', resolve, { once: true }); existing.addEventListener('error', reject, { once: true }); return; }
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = 'true';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load Google sign-in.'));
      document.head.appendChild(script);
    });
  }
  return googleScriptPromise;
}

export default function GoogleSignIn({ role, onError }) {
  const buttonRef = useRef(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getGoogleAuthConfig().then((value) => { if (!cancelled) setConfig(value); }).catch(() => { if (!cancelled) setConfig({ enabled: false }); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!config?.enabled || !config.clientId || !buttonRef.current) return undefined;
    let cancelled = false;
    loadGoogleScript().then(() => {
      if (cancelled || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: config.clientId,
        callback: async ({ credential }) => {
          try {
            const result = await loginGoogle(credential, role);
            login(result.token, result.refreshToken, result.user);
            navigate(role === 'ADMIN' ? '/admin/timetable' : role === 'FACULTY' ? '/faculty/dashboard' : '/student/scan');
          } catch (err) { onError(err.message || 'Google sign-in failed.'); }
        },
      });
      buttonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(buttonRef.current, { type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', width: Math.min(320, buttonRef.current.clientWidth || 320) });
    }).catch((err) => onError(err.message));
    return () => { cancelled = true; };
  }, [config, login, navigate, onError, role]);

  if (loading) return <div className="google-login-placeholder">Loading Google sign-in…</div>;
  if (!config?.enabled) return <button type="button" className="google-login-disabled" onClick={() => onError('Google sign-in setup is pending. Add GOOGLE_CLIENT_ID in Render.')}><span>G</span>Sign in with Google</button>;
  return <div ref={buttonRef} className="google-login-button"/>;
}
