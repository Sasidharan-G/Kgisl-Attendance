import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, User, KeyRound, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { loginStudent } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Loader from '../components/Loader.jsx';
import ForgotPasswordModal from '../components/ForgotPasswordModal.jsx';

export default function StudentLogin() {
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
      const { token, refreshToken, user } = await loginStudent(email, password);
      login(token, refreshToken, user);
      setIsSuccessLoading(true);
      setTimeout(() => {
        setIsSuccessLoading(false);
        navigate('/student/scan');
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
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          color: #0f172a;
          border-radius: 1rem;
          transition: all 0.3s ease;
        }
        .custom-input:focus {
          outline: none;
          background: #ffffff;
          border-color: #3b82f6;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
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
          color: #64748b;
        }
        .custom-input:focus ~ .custom-label,
        .custom-input:not(:placeholder-shown) ~ .custom-label {
          transform: translate(-150%, -50%);
          opacity: 0;
        }
      `}</style>
      
      <div className="relative w-full max-w-sm px-2">
        
        <div className="relative z-10 flex flex-col items-center">
          <div className="w-14 h-14 rounded-2xl bg-black/5 border border-black/10 flex items-center justify-center mb-4">
            <GraduationCap size={28} className="text-black" strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl font-bold text-black tracking-wide">Student Portal</h2>
          <p className="text-xs text-black/70 font-medium mb-8">Sign in to mark your attendance</p>

          <form onSubmit={handleSubmit} className="w-full space-y-5">
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
              <label className="custom-label">Username / Email</label>
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

            <div className="flex items-center justify-between text-xs px-1">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-500 hover:text-slate-800 transition-colors">
                <input type="checkbox" className="w-3.5 h-3.5 accent-signal-blue rounded-sm border-slate-300" />
                Remember me
              </label>
              <button type="button" onClick={() => setShowForgot(true)} className="font-medium text-signal-blue hover:text-blue-700 underline-offset-2 hover:underline transition-all">
                Forgot Password?
              </button>
            </div>

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
        </div>
      </div>
      
      {isSuccessLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md">
          <Loader />
        </div>
      )}
      {showForgot && <ForgotPasswordModal role="STUDENT" initialEmail={email} onClose={() => setShowForgot(false)}/>}
    </div>
  );
}
