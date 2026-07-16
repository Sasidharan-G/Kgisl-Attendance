import { type FormEvent, useState } from 'react';
import { ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { correctAttendance } from '../services/api.js';

type ManualStatus = 'PRESENT' | 'ABSENT';

type ManualAttendanceProps = {
  sessionId?: string | null;
  onUpdated?: () => void | Promise<void>;
};

export default function ManualAttendance({ sessionId, onUpdated }: ManualAttendanceProps) {
  const [rollNo, setRollNo] = useState('');
  const [status, setStatus] = useState<ManualStatus>('PRESENT');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanRollNo = rollNo.trim().toUpperCase();
    const cleanReason = reason.trim();
    if (!sessionId || !cleanRollNo || cleanReason.length < 3) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await correctAttendance(sessionId, { rollNo: cleanRollNo, status, reason: cleanReason });
      setSuccess(`${cleanRollNo} manually marked ${status.toLowerCase()}. Audit reason saved.`);
      setRollNo('');
      setReason('');
      await onUpdated?.();
      window.setTimeout(() => setSuccess(''), 4_000);
    } catch (submitError) {
      const typed = submitError as { message?: string };
      setError(typed.message ?? 'Manual attendance update failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-ink-border bg-ink-850/60 p-4 shadow-card sm:p-6">
      <div className="mb-4 flex items-start gap-2">
        <ShieldCheck size={17} className="mt-0.5 shrink-0 text-slate-400"/>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Faculty Manual Override</h3>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">Alpha/Beta fail aana Present mark pannalaam. Proxy/fraud confirm aana Absent override pannalaam. Ella change-um audit aagum.</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-ink-900 p-1">
        <button type="button" disabled={loading} onClick={() => setStatus('PRESENT')} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-semibold transition ${status === 'PRESENT' ? 'bg-emerald-500/20 text-emerald-300 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><UserCheck size={14}/>Mark Present</button>
        <button type="button" disabled={loading} onClick={() => setStatus('ABSENT')} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-semibold transition ${status === 'ABSENT' ? 'bg-red-500/20 text-red-300 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><UserX size={14}/>Override Absent</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="text" value={rollNo} onChange={(event) => setRollNo(event.target.value.toUpperCase())} placeholder="Roll No (e.g. 24MX101)" className="w-full rounded-lg border border-ink-border bg-ink-900 px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:border-signal-blue focus:outline-none" required disabled={!sessionId || loading}/>
        <div>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={200} rows={2} placeholder={status === 'ABSENT' ? 'Mandatory reason (e.g. Student verified outside class)' : 'Mandatory reason (e.g. Phone microphone unsupported)'} className={`w-full resize-none rounded-lg border bg-ink-900 px-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none ${status === 'ABSENT' ? 'border-red-400/30 focus:border-red-400' : 'border-ink-border focus:border-signal-blue'}`} required disabled={!sessionId || loading}/>
          <div className="mt-1 flex justify-between text-[9px] text-slate-600"><span>Reason mandatory · audit log-la save aagum</span><span>{reason.length}/200</span></div>
        </div>
        <button type="submit" disabled={!sessionId || loading || !rollNo.trim() || reason.trim().length < 3} className={`w-full rounded-lg py-2.5 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${status === 'ABSENT' ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
          {loading ? 'Saving…' : status === 'ABSENT' ? 'Confirm Absent Override' : 'Confirm Manual Present'}
        </button>
      </form>

      {error && <p className="mt-3 rounded-lg border border-red-400/20 bg-red-400/10 p-2 text-[10px] text-red-300">{error}</p>}
      {success && <p className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-2 text-[10px] text-emerald-300">{success}</p>}
    </section>
  );
}
