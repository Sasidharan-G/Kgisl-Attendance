import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Eye, EyeOff, LockKeyhole, Mail, Loader, CheckCircle2 } from 'lucide-react';
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
    <div className="w-full space-y-5">
      <form onSubmit={otpRequired ? verifyOtp : handleSubmit} className="space-y-4">
        {otpRequired ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-300">
              A 6-digit sign-in code was sent to <strong className="text-white">{email}</strong>.
            </p>
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">Sign-in Code</label>
              <div className="flex items-center rounded-2xl border border-slate-700/80 bg-slate-900/90 px-3.5 py-2.5 shadow-md backdrop-blur-md focus-within:border-blue-500 transition-all">
                <LockKeyhole className="h-5 w-5 text-slate-400 mr-2.5 shrink-0" />
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit OTP code"
                  className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Glass Email Input Pill */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">Email Address</label>
              <div className="flex items-center rounded-2xl border border-slate-700/80 bg-slate-900/90 px-3.5 py-2.5 shadow-md backdrop-blur-md focus-within:border-blue-500 transition-all">
                <Mail className="h-5 w-5 text-slate-400 mr-2.5 shrink-0" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@kgisl.edu"
                  className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Glass Password Input Pill */}
            <div className="relative">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 pl-1">Password</label>
              <div className="flex items-center rounded-2xl border border-slate-700/80 bg-slate-900/90 px-3.5 py-2.5 shadow-md backdrop-blur-md focus-within:border-blue-500 transition-all">
                <LockKeyhole className="h-5 w-5 text-slate-400 mr-2.5 shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
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

            {/* Form Options */}
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" className="rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500" />
                <span>Remember me</span>
              </label>
              {portal === 'FACULTY' && (
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
                >
                  Forgot password?
                </button>
              )}
            </div>
          </>
        )}

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Glass Action Submit Button */}
        <button
          type="submit"
          disabled={loading || isSuccess}
          className="group relative flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-semibold text-white shadow-xl shadow-blue-950/50 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] transition-all disabled:opacity-50"
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
              {otpRequired ? 'Verify OTP Code' : `Sign In as ${portal === 'ADMIN' ? 'Admin' : 'Faculty'}`}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      {/* Social Google OAuth Divider */}
      {active && portal !== 'ADMIN' && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-3">
            <hr className="flex-1 border-slate-800" />
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">or continue with</span>
            <hr className="flex-1 border-slate-800" />
          </div>
          <GoogleSignIn role={portal} onError={setError} />
        </div>
      )}

      {showForgot && <ForgotPasswordModal role="FACULTY" initialEmail={email} onClose={() => setShowForgot(false)} />}
    </div>
  );
}
