import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, User, Loader, CheckCircle2 } from 'lucide-react';
import { loginAdmin, loginFaculty, verifyAdminOtp } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import ForgotPasswordModal from '../components/ForgotPasswordModal.jsx';
import GoogleSignIn from '../components/GoogleSignIn.jsx';
import confetti from 'canvas-confetti';

export default function AdminLogin({ portal = 'ADMIN', active = true }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [otpRequired, setOtpRequired] = useState(false);
  const [otp, setOtp] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const fireConfetti = () => {
    try {
      confetti({ particleCount: 60, spread: 360, origin: { y: 0.6 } });
    } catch {
      /* ignore */
    }
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Enter a valid registered email address.');
      return;
    }
    if (!password) {
      setError('Enter your password to continue.');
      return;
    }

    setLoading(true);
    try {
      const res = portal === 'ADMIN' ? await loginAdmin(email, password) : await loginFaculty(email, password);
      if (portal === 'ADMIN' && res.mfaRequired) {
        setOtpRequired(true);
        return;
      }
      login(res.token, res.refreshToken, res.user);
      setIsSuccess(true);
      fireConfetti();
      setTimeout(() => {
        setIsSuccess(false);
        navigate(portal === 'ADMIN' ? '/admin/timetable' : '/faculty/dashboard');
      }, 1600);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await verifyAdminOtp(email, otp);
      login(res.token, res.refreshToken, res.user);
      setIsSuccess(true);
      fireConfetti();
      setTimeout(() => {
        setIsSuccess(false);
        navigate('/admin/timetable');
      }, 1200);
    } catch (err) {
      setError(err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-6">
      <form onSubmit={otpRequired ? verifyOtp : handleSubmit} className="space-y-5">
        {otpRequired ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-300">
              A 6-digit sign-in code was sent to <strong className="text-white">{email}</strong>.
            </p>
            <div className="relative pt-1">
              <div className="flex items-center border-b border-slate-600/80 focus-within:border-blue-500 py-2 transition-colors">
                <Lock className="h-5 w-5 text-slate-300 mr-3 shrink-0" />
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit OTP code"
                  className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-400 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Email Address Underline Input matching mockup */}
            <div className="relative pt-1">
              <div className="flex items-center border-b border-slate-600/80 focus-within:border-blue-500 py-2 transition-colors">
                <User className="h-5 w-5 text-slate-300 mr-3 shrink-0" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Password Underline Input matching mockup */}
            <div className="relative pt-1">
              <div className="flex items-center border-b border-slate-600/80 focus-within:border-blue-500 py-2 transition-colors">
                <Lock className="h-5 w-5 text-slate-300 mr-3 shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-200 transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link on Left matching mockup */}
            {portal === 'FACULTY' && (
              <div className="flex items-center justify-start text-xs pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
            )}
          </>
        )}

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Primary Blue Pill Sign In Button matching mockup */}
        <button
          type="submit"
          disabled={loading || isSuccess}
          className="group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-[0.98] py-3.5 text-base font-bold text-white shadow-lg shadow-blue-600/40 transition-all disabled:opacity-50 mt-2"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader size={18} className="animate-spin text-white" />
              Verifying Credentials...
            </span>
          ) : isSuccess ? (
            <span className="flex items-center gap-2 text-emerald-300 font-bold">
              <CheckCircle2 size={18} />
              Welcome Back!
            </span>
          ) : (
            <>
              Sign In
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      {/* Social Google OAuth Divider matching mockup */}
      {active && portal !== 'ADMIN' && (
        <div className="space-y-4 pt-1">
          <div className="flex items-center gap-3">
            <hr className="flex-1 border-slate-700/60" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">OR CONTINUE WITH</span>
            <hr className="flex-1 border-slate-700/60" />
          </div>
          <GoogleSignIn role={portal} onError={setError} />
        </div>
      )}

      {showForgot && <ForgotPasswordModal role="FACULTY" initialEmail={email} onClose={() => setShowForgot(false)} />}
    </div>
  );
}
