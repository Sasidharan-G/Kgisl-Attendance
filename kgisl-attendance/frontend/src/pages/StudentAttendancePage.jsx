import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createAttendanceCorrection, getMyAttendance } from '../services/api.js';
import StatePanel from '../components/StatePanel.jsx';

export default function StudentAttendancePage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { getMyAttendance().then(setData).catch((err) => setError(err.message || 'Could not load attendance history.')).finally(() => setLoading(false)); }, []);
  async function requestCorrection(session) {
    const reason = window.prompt(`Why should ${session.subjectCode} attendance be corrected?`);
    if (reason === null) return;
    if (reason.trim().length < 5) { setError('Please enter a clear correction reason with at least 5 characters.'); return; }
    setError(''); setSuccess('');
    try { await createAttendanceCorrection({ sessionId: session.sessionId, reason: reason.trim() }); setSuccess('Correction request submitted. Its status will appear on your dashboard.'); }
    catch (err) { setError(err.message || 'Could not submit request'); }
  }

  return <div className="min-h-screen bg-ink-950 px-5 py-8 text-slate-200"><main className="mx-auto max-w-6xl">
    <button onClick={() => navigate('/student/dashboard')} className="mb-6 flex items-center gap-2 text-sm text-signal-blue"><ArrowLeft size={16}/>Dashboard</button>
    <h1 className="text-2xl font-bold text-white">My Attendance</h1><p className="mt-1 text-sm text-slate-400">{data ? `${data.student.rollNo} · ${data.student.batchName}` : 'Attendance history and correction requests'}</p>
    {loading && <div className="mt-7"><StatePanel type="loading" title="Loading attendance history" description="Fetching subject totals and recent sessions." /></div>}
    {!loading && error && !data && <div className="mt-7"><StatePanel type="error" title="Attendance unavailable" description={error} actionLabel="Try again" onAction={() => window.location.reload()} /></div>}
    {data && error && <div className="mt-5"><StatePanel type="error" compact title="Request could not be submitted" description={error} /></div>}
    {success && <div className="mt-5"><StatePanel type="success" compact title="Request submitted" description={success} /></div>}
    {data && <>
      {data.subjects.length ? <div className="mt-7 grid gap-4 md:grid-cols-3">{data.subjects.map((subject) => <div key={subject.code} className={`rounded-2xl border p-5 ${subject.shortage ? 'border-signal-red/30 bg-signal-red/10' : 'border-ink-border bg-ink-850/60'}`}><div className="flex justify-between"><BookOpen className="text-signal-blue" size={20}/>{subject.shortage && <ShieldAlert className="text-signal-red" size={20}/>}</div><h2 className="mt-3 font-bold text-white">{subject.code} · {subject.name}</h2><p className={`mt-2 text-3xl font-bold ${subject.shortage ? 'text-signal-red' : 'text-signal-green'}`}>{subject.percentage}%</p><p className="mt-1 text-xs text-slate-400">{subject.present} present · {subject.absent} absent · {subject.total} sessions</p></div>)}</div> : <div className="mt-7"><StatePanel type="empty" title="No attendance subjects yet" description="Your subjects will appear after the academic setup is assigned." /></div>}
      <div className="mt-7 overflow-x-auto rounded-2xl border border-ink-border bg-ink-850/60">{data.sessions.length ? <table className="w-full min-w-[720px] text-sm"><thead><tr>{['Date','Subject','Faculty','Status','Check-in',''].map((label) => <th key={label} className="px-4 py-3 text-left text-slate-400">{label}</th>)}</tr></thead><tbody>{data.sessions.map((session) => <tr key={session.sessionId} className="border-t border-ink-border"><td className="px-4 py-3">{new Date(session.startedAt).toLocaleString('en-IN')}</td><td className="px-4 py-3 font-bold text-white">{session.subjectCode}</td><td className="px-4 py-3">{session.facultyName}</td><td className={session.status === 'PRESENT' ? 'px-4 py-3 font-bold text-signal-green' : 'px-4 py-3 font-bold text-signal-red'}>{session.status}</td><td className="px-4 py-3">{session.scanTime ? new Date(session.scanTime).toLocaleTimeString('en-IN') : '—'}</td><td className="px-4 py-3">{session.status === 'ABSENT' && <button onClick={() => requestCorrection(session)} className="text-xs font-semibold text-signal-blue">Report issue</button>}</td></tr>)}</tbody></table> : <StatePanel type="empty" compact title="No completed sessions" description="Attendance records will appear after your first class session." />}</div>
    </>}
  </main></div>;
}
