import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldCheck, User, KeyRound, Eye, EyeOff, ArrowRight, BadgeCheck } from 'lucide-react';
import { loginAdmin, loginFaculty } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Loader from '../components/Loader.jsx';
import ForgotPasswordModal from '../components/ForgotPasswordModal.jsx';
import GoogleSignIn from '../components/GoogleSignIn.jsx';

export default function AdminLogin({ portal = 'ADMIN', active = true }) {
  const [name, setName] = useState('');
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
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = portal === 'ADMIN' ? await loginAdmin(email, password) : await loginFaculty(email, password);
      const { token, refreshToken, user } = res;
      login(token, refreshToken, user);
      setIsSuccessLoading(true);
      setTimeout(() => {
        setIsSuccessLoading(false);
        navigate(portal === 'ADMIN' ? '/admin/timetable' : '/faculty/dashboard');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full flex flex-col items-center justify-center p-4">
      <style>{`
        .custom-input {
          background: rgba(255,255,255,0.055);
          border: 1px solid rgba(255,255,255,0.12);
          color: #ffffff;
          border-radius: 1rem;
          transition: all 0.3s ease;
        }
        .custom-input:focus {
          outline: none;
          background: rgba(255,255,255,0.09);
          border-color: #0A84FF;
          box-shadow: 0 0 0 3px rgba(10,132,255,0.3), 0 0 28px rgba(10,132,255,0.14);
        }
        .custom-input::placeholder {
          color: transparent;
        }
        .custom-label {
          position: absolute;
          top: 50%;
          left: 44px;
          transition: all ease 0.3s;
          transform: translate(0%, -50%);
          font-size: 0.875rem;
          user-select: none;
          pointer-events: none;
          color: #94a3b8;
        }
        .custom-input:focus ~ .custom-label,
        .custom-input:not(:placeholder-shown) ~ .custom-label {
          transform: translate(-150%, -50%);
          opacity: 0;
        }
      `}</style>
      
      <div className="relative w-full max-w-sm px-2">
        
        <div className="relative z-10 flex flex-col items-center">
          <h2 className="text-3xl font-bold text-white tracking-tight">Welcome Back</h2>
          <p className="mt-1 text-xs text-slate-300 font-medium mb-6">Sign in to continue as {portal === 'ADMIN' ? 'Admin' : 'Faculty'}</p>

          <form onSubmit={handleSubmit} className="w-full space-y-4">
            {false && (
              <div className="relative overflow-hidden rounded-[1rem]">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder=" "
                  className="w-full py-3.5 pl-11 pr-4 custom-input text-sm font-medium"
                />
                <BadgeCheck size={18} className="absolute left-4 top-[15px] text-slate-400 pointer-events-none" strokeWidth={2.5} />
                <label className="custom-label">Full Name</label>
              </div>
            )}
            <div className="relative overflow-hidden rounded-[1rem]">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
                className="w-full py-3.5 pl-11 pr-4 custom-input text-sm font-medium"
              />
              <User size={18} className="absolute left-4 top-[15px] text-slate-400 pointer-events-none" strokeWidth={2.5} />
              <label className="custom-label">Email Address</label>
            </div>

            <div className="relative overflow-hidden rounded-[1rem]">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder=" "
                className="w-full py-3.5 pl-11 pr-11 custom-input text-sm font-medium"
              />
              <KeyRound size={18} className="absolute left-4 top-[15px] text-slate-400 pointer-events-none" strokeWidth={2.5} />
              <label className="custom-label">Password</label>
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-[15px] text-slate-400 hover:text-slate-600 transition-colors z-10"
              >
                {showPassword ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
              </button>
            </div>

            {portal === 'FACULTY' && <div className="text-right"><button type="button" onClick={() => setShowForgot(true)} className="text-xs font-semibold text-signal-blue hover:underline">Forgot Password?</button></div>}

            {error && (
              <div className="w-full bg-red-500/20 border border-red-500/50 rounded-lg p-2 text-center text-xs font-semibold text-red-200">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="w-full py-3.5 font-bold tracking-wider uppercase text-sm bg-signal-blue hover:bg-blue-600 text-white rounded-[1rem] transition-all shadow-md hover:shadow-lg hover:-translate-y-[1px] active:translate-y-0 flex items-center justify-center gap-2 mt-4">
              {loading ? 'Logging in...' : 'Sign In'}
              {!loading && <ArrowRight size={16} strokeWidth={2.5} />}
            </button>
          </form>
          {active && <><div className="login-divider"><span>or</span></div><GoogleSignIn role={portal} onError={setError}/></>}
        </div>
      </div>
      
      {isSuccessLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md">
          <Loader />
        </div>
      )}
      {showForgot && <ForgotPasswordModal role="FACULTY" initialEmail={email} onClose={() => setShowForgot(false)}/>}
    </div>
  );
}
