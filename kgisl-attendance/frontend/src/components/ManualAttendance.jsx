import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { markManualAttendance } from '../services/api';

export default function ManualAttendance({ sessionId }) {
  const [rollNo, setRollNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!sessionId) return;
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      await markManualAttendance(sessionId, rollNo);
      setSuccess(`Marked present for ${rollNo}`);
      setRollNo('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to mark attendance');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-ink-border bg-ink-850/60 shadow-card p-6 flex flex-col mt-6">
      <div className="w-full flex items-center mb-4 gap-2">
        <UserPlus size={16} className="text-slate-400" />
        <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Manual Entry</h3>
      </div>
      
      <p className="text-[10px] text-slate-500 mb-4">
        For students unable to scan the QR, enter their Roll Number to manually mark them present.
      </p>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={rollNo}
          onChange={(e) => setRollNo(e.target.value.toUpperCase())}
          placeholder="Roll No (e.g. 24MX101)"
          className="flex-1 rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-signal-blue focus:outline-none"
          required
          disabled={!sessionId || loading}
        />
        <button
          type="submit"
          disabled={!sessionId || loading || !rollNo}
          className="rounded-lg bg-signal-blue px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {loading ? '...' : 'Mark'}
        </button>
      </form>

      {error && <p className="mt-2 text-[10px] text-signal-red">{error}</p>}
      {success && <p className="mt-2 text-[10px] text-signal-green">{success}</p>}
    </div>
  );
}
