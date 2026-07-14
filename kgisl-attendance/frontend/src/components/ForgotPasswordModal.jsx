import { useState } from 'react';
import { KeyRound, Mail, X } from 'lucide-react';
import { confirmPasswordReset, requestPasswordReset } from '../services/api.js';

export default function ForgotPasswordModal({ role, initialEmail = '', onClose }) {
  const [step, setStep] = useState('request');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault(); setLoading(true); setError(''); setMessage('');
    try {
      if (step === 'request') {
        const result = await requestPasswordReset(email, role);
        setMessage(result.message); setStep('confirm');
      } else {
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        await confirmPasswordReset(email, role, code, password);
        setMessage('Password reset successfully. You can now sign in.'); setStep('done');
      }
    } catch (err) { setError(err.message || 'Password reset failed.'); }
    finally { setLoading(false); }
  }

  return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
    <div className="relative w-full max-w-md rounded-3xl bg-white p-6 text-slate-900 shadow-2xl">
      <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 text-slate-500 hover:bg-slate-100"><X size={18}/></button>
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-signal-blue"><KeyRound/></div>
      <h2 className="text-xl font-bold">Reset {role === 'FACULTY' ? 'Faculty' : 'Student'} Password</h2>
      <p className="mt-1 text-sm text-slate-500">A 6-digit code will be sent to your registered email and expires in 10 minutes.</p>
      {message && <p className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-700">{message}</p>}
      {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {step !== 'done' && <form onSubmit={submit} className="mt-5 space-y-3">
        <label className="block text-xs font-semibold text-slate-600">Registered email<input type="email" required disabled={step === 'confirm'} value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 disabled:bg-slate-100"/></label>
        {step === 'confirm' && <>
          <label className="block text-xs font-semibold text-slate-600">6-digit code<input inputMode="numeric" required pattern="\d{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 tracking-[0.35em]"/></label>
          <label className="block text-xs font-semibold text-slate-600">New password<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"/><span className="mt-1 block font-normal text-slate-400">Minimum 8 characters with uppercase, lowercase and number.</span></label>
          <label className="block text-xs font-semibold text-slate-600">Confirm password<input type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3"/></label>
        </>}
        <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-signal-blue py-3 font-bold text-white disabled:opacity-50"><Mail size={17}/>{loading ? 'Please wait...' : step === 'request' ? 'Send Reset Code' : 'Reset Password'}</button>
        {step === 'confirm' && <button type="button" onClick={() => { setStep('request'); setCode(''); setMessage(''); }} className="w-full text-sm font-semibold text-signal-blue">Use another email or resend code</button>}
      </form>}
      {step === 'done' && <button onClick={onClose} className="mt-5 w-full rounded-xl bg-signal-blue py-3 font-bold text-white">Back to Sign In</button>}
    </div>
  </div>;
}
