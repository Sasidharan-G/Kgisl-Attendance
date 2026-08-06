import { Calendar, CalendarCheck, Clock3, ScanLine, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getMyAttendance, listAttendanceCorrections, listLeaveRequests } from '../services/api.js';
import StatePanel from '../components/StatePanel.jsx';

export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getMyAttendance(), listLeaveRequests(), listAttendanceCorrections()])
      .then(([history, leaves, corrections]) => {
        setAttendance(history);
        setUpdates([
          ...leaves.map((item) => ({ id: `l-${item.id}`, label: `${item.type === 'ON_DUTY' ? 'OD' : 'Leave'} request`, status: item.status, date: item.createdAt })),
          ...corrections.map((item) => ({ id: `c-${item.id}`, label: `Attendance correction · ${item.session.subject.code}`, status: item.status, date: item.createdAt })),
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5));
      })
      .catch((err) => setError(err.message || 'Could not load your dashboard.'))
      .finally(() => setLoading(false));
  }, []);

  const shortage = attendance?.subjects.filter((item) => item.shortage) || [];
  const average = attendance?.subjects.length
    ? Math.round(attendance.subjects.reduce((sum, item) => sum + item.percentage, 0) / attendance.subjects.length)
    : 100;

  return <div className="min-h-screen bg-ink-950 px-5 py-8 text-slate-200"><main className="mx-auto max-w-5xl">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-slate-400">Welcome back</p><h1 className="text-2xl font-bold text-white">{attendance?.student?.name || 'Student Dashboard'}</h1><p className="mt-1 text-sm text-slate-500">{attendance ? `${attendance.student.rollNo} · ${attendance.student.batchName}` : 'Your academic snapshot'}</p></div><div className="flex flex-wrap items-center gap-2.5"><button onClick={() => navigate('/student/calendar')} className="flex items-center gap-2 rounded-xl border border-blue-500/40 bg-blue-950/60 px-4 py-2.5 text-sm font-bold text-blue-200 hover:bg-blue-900/80 transition shadow-sm"><Calendar size={17}/>Academic Calendar</button><button onClick={() => navigate('/student/scan')} className="flex items-center gap-2 rounded-xl bg-signal-red px-4 py-2.5 text-sm font-bold text-white shadow-sm"><ScanLine size={17}/>Mark attendance</button></div></div>
    {loading && <div className="mt-7"><StatePanel type="loading" title="Loading your dashboard" description="Fetching attendance, leave and correction updates." /></div>}
    {!loading && error && <div className="mt-7"><StatePanel type="error" title="Dashboard unavailable" description={error} actionLabel="Try again" onAction={() => window.location.reload()} /></div>}
    {!loading && !error && <>
      <div className="mt-7 grid gap-4 sm:grid-cols-3"><Card icon={<CalendarCheck/>} title="Overall attendance" value={`${average}%`} text="Across enrolled subjects"/><Card icon={<ShieldAlert/>} title="Shortage alerts" value={String(shortage.length)} text={shortage.length ? shortage.map((item) => item.code).join(', ') : 'You are on track'}/><Card icon={<Clock3/>} title="Recent sessions" value={String(attendance?.sessions?.length || 0)} text="View complete history" onClick={() => navigate('/student/attendance')}/></div>
      <div className="mt-7 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-ink-border bg-ink-850/60 p-5"><h2 className="font-bold text-white">Attendance alerts</h2>{shortage.length ? shortage.map((item) => <div key={item.code} className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3"><p className="font-semibold text-red-200">{item.code} · {item.percentage}%</p><p className="mt-1 text-xs text-slate-300">Below 75%. Attend upcoming classes consistently.</p></div>) : <StatePanel type="success" compact title="No attendance shortage" description="Your attendance is currently on track." />}<button onClick={() => navigate('/student/attendance')} className="mt-5 text-sm font-semibold text-signal-blue">View attendance history →</button></section>
        <section className="rounded-2xl border border-ink-border bg-ink-850/60 p-5"><h2 className="font-bold text-white">Request updates</h2>{updates.length ? updates.map((item) => <div key={item.id} className="mt-3 flex justify-between rounded-xl bg-ink-900 px-3 py-2 text-sm"><span>{item.label}</span><span className={item.status === 'APPROVED' ? 'text-signal-green' : item.status === 'REJECTED' ? 'text-red-300' : 'text-signal-amber'}>{item.status}</span></div>) : <StatePanel type="empty" compact title="No request updates" description="Leave and attendance correction updates will appear here." />}<div className="mt-5 flex gap-4"><button onClick={() => navigate('/student/leave')} className="text-sm font-semibold text-signal-blue">Leave / OD</button><button onClick={() => navigate('/student/attendance')} className="text-sm font-semibold text-signal-blue">Report missed attendance</button></div></section>
      </div>
    </>}
  </main></div>;
}

function Card({ icon, title, value, text, onClick }) {
  return <button type="button" onClick={onClick} className="rounded-2xl border border-ink-border bg-ink-850/60 p-5 text-left"><div className="text-signal-blue">{icon}</div><p className="mt-4 text-3xl font-bold text-white">{value}</p><p className="mt-1 font-semibold text-slate-300">{title}</p><p className="mt-1 text-xs text-slate-500">{text}</p></button>;
}
