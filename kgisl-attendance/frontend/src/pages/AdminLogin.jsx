import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { loginAdmin, loginFaculty } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Loader from '../components/Loader.jsx';
import ForgotPasswordModal from '../components/ForgotPasswordModal.jsx';
import GoogleSignIn from '../components/GoogleSignIn.jsx';

export default function AdminLogin({ portal = 'ADMIN', active = true }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccessLoading, setIsSuccessLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const res = portal === 'ADMIN' ? await loginAdmin(email, password) : await loginFaculty(email, password);
      login(res.token, res.refreshToken, res.user); setIsSuccessLoading(true);
      setTimeout(() => { setIsSuccessLoading(false); navigate(portal === 'ADMIN' ? '/admin/timetable' : '/faculty/dashboard'); }, 2000);
    } catch (err) { setError(err.message || 'Login failed'); }
    finally { setLoading(false); }
  }

  return <>
    <form onSubmit={handleSubmit} className="calm-login-form">
      <label className="calm-field">
        <span>Email address</span>
        <div><Mail size={18}/><input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@kgisl.com" /></div>
      </label>
      <label className="calm-field">
        <span>Password</span>
        <div><LockKeyhole size={18}/><input type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" />
          <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
        </div>
      </label>
      <div className="calm-form-options calm-form-options-end">
        {portal === 'FACULTY' && <button type="button" onClick={() => setShowForgot(true)}>Forgot password?</button>}
      </div>
      {error && <div className="calm-form-error" role="alert"><AlertCircle size={16}/><span>{error}</span></div>}
      <button type="submit" disabled={loading} className="calm-submit">{loading ? 'Signing in...' : 'Sign in'}{!loading && <ArrowRight size={18}/>}</button>
    </form>
    {active && <><div className="login-divider"><span>or continue with</span></div><GoogleSignIn role={portal} onError={setError}/></>}
    {isSuccessLoading && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 backdrop-blur-sm"><Loader /></div>}
    {showForgot && <ForgotPasswordModal role="FACULTY" initialEmail={email} onClose={() => setShowForgot(false)}/>}
  </>;
}
