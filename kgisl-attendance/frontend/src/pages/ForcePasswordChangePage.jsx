import { useState } from 'react';
import { KeyRound, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { changePassword } from '../services/api.js';

const RULES = [
  ['At least 10 characters', (value) => value.length >= 10],
  ['An uppercase and a lowercase letter', (value) => /[A-Z]/.test(value) && /[a-z]/.test(value)],
  ['A number', (value) => /[0-9]/.test(value)],
];

/** Shown instead of the app while the account still uses the initial password it was issued with. */
export default function ForcePasswordChangePage() {
  const { user, logout, replaceTokens } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const rulesMet = RULES.every(([, test]) => test(newPassword));
  const matches = confirmPassword !== '' && newPassword === confirmPassword;
  const canSubmit = currentPassword && rulesMet && matches && !saving;

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      replaceTokens(result.data.token, result.data.refreshToken);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not update the password.');
    } finally {
      setSaving(false);
    }
  }

  const inputClass = 'mt-1 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-sky-500/15 text-sky-300"><KeyRound size={22} /></div>
          <div>
            <h1 className="text-lg font-bold text-white">Set a new password</h1>
            <p className="text-xs text-slate-400">{user?.name ? `${user.name}, your` : 'Your'} account still uses the initial password. Choose a private one to continue.</p>
          </div>
        </div>

        <label className="mt-5 block text-xs font-semibold text-slate-300">Current (initial) password
          <input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className={inputClass} />
        </label>
        <label className="mt-3 block text-xs font-semibold text-slate-300">New password
          <input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className={inputClass} />
        </label>
        <label className="mt-3 block text-xs font-semibold text-slate-300">Confirm new password
          <input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={inputClass} />
        </label>

        <ul className="mt-3 space-y-1 text-[11px]">
          {RULES.map(([label, test]) => <li key={label} className={test(newPassword) ? 'text-emerald-400' : 'text-slate-500'}>{test(newPassword) ? '✓' : '○'} {label}</li>)}
          <li className={matches ? 'text-emerald-400' : 'text-slate-500'}>{matches ? '✓' : '○'} Both passwords match</li>
        </ul>

        {error && <p role="alert" className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-200">{error}</p>}

        <button type="submit" disabled={!canSubmit} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 py-3 text-sm font-bold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-40">
          {saving && <Loader2 size={15} className="animate-spin" />}Save new password
        </button>
        <button type="button" onClick={logout} className="mt-3 flex w-full items-center justify-center gap-2 text-xs text-slate-400 hover:text-white"><LogOut size={13} />Sign out</button>
      </form>
    </div>
  );
}
