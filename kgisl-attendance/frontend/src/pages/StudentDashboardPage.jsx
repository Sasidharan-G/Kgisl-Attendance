import { useEffect, useState } from 'react';
import { Calendar, CalendarCheck, Clock3, ScanLine, ShieldAlert, BookOpenCheck, Building, PartyPopper, ChevronRight, Calculator, Radio, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getMyAttendance, listAttendanceCorrections, listLeaveRequests } from '../services/api.js';
import StatePanel from '../components/StatePanel.jsx';

const TODAY_DAILY_SCHEDULE = [
  { period: 'Period 1', time: '09:10 AM – 10:00 AM', subjectCode: 'AIML', subjectName: 'Artificial Intelligence & ML', room: 'MCA Lab 1', status: 'COMPLETED' },
  { period: 'Period 2', time: '10:10 AM – 11:00 AM', subjectCode: 'PHP', subjectName: 'Open Source Scripting - PHP', room: 'Hall 204', status: 'ACTIVE' },
  { period: 'Period 3', time: '11:10 AM – 12:00 PM', subjectCode: 'OSC', subjectName: 'Open Source Concepts', room: 'Hall 204', status: 'UPCOMING' },
  { period: 'Period 4', time: '01:40 PM – 02:30 PM', subjectCode: 'NSC', subjectName: 'Network Security & Cryptography', room: 'MCA Lab 2', status: 'UPCOMING' },
  { period: 'Period 5', time: '02:40 PM – 03:30 PM', subjectCode: 'CC', subjectName: 'Cloud Computing Architecture', room: 'Hall 201', status: 'UPCOMING' },
];

const UPCOMING_BLOCK_TESTS = [
  { id: 'bt1', subjectCode: 'AIML', subjectName: 'Artificial Intelligence & ML', date: '2026-08-24', day: 'Monday', time: '09:30 AM – 12:30 PM', room: 'MCA Lab / Hall 1' },
  { id: 'bt2', subjectCode: 'PHP', subjectName: 'Open Source Scripting - PHP', date: '2026-08-25', day: 'Tuesday', time: '09:30 AM – 12:30 PM', room: 'Exam Hall 2' },
  { id: 'bt3', subjectCode: 'OSC', subjectName: 'Open Source Concepts', date: '2026-08-26', day: 'Wednesday', time: '09:30 AM – 12:30 PM', room: 'Exam Hall 2' },
  { id: 'bt4', subjectCode: 'NSC', subjectName: 'Network Security & Cryptography', date: '2026-08-27', day: 'Thursday', time: '09:30 AM – 12:30 PM', room: 'MCA Lab' },
  { id: 'bt5', subjectCode: 'CC', subjectName: 'Cloud Computing Architecture', date: '2026-08-28', day: 'Friday', time: '09:30 AM – 12:30 PM', room: 'Exam Hall 1' },
];

const UPCOMING_HOLIDAYS = [
  { id: 'h1', date: '2026-08-15', title: 'Independence Day', type: 'HOLIDAY', desc: 'National Holiday' },
  { id: 'h2', date: '2026-08-28', title: 'TechSymposium 2026', type: 'EVENT', desc: 'Annual Tech Fest' },
  { id: 'h3', date: '2026-09-17', title: 'Vinayagar Chaturthi', type: 'HOLIDAY', desc: 'Government Holiday' },
];

function calculateAttendanceAdvice(attended = 0, total = 0) {
  if (total === 0) return { status: 'SAFE', text: 'No classes held yet.' };
  const currentPct = (attended / total) * 100;

  if (currentPct >= 75) {
    const maxBunk = Math.floor((attended - 0.75 * total) / 0.75);
    if (maxBunk > 0) {
      return { status: 'SAFE', count: maxBunk, text: `Safe: You can safely miss ${maxBunk} class${maxBunk > 1 ? 'es' : ''} and stay above 75%.` };
    }
    return { status: 'MARGIN', count: 0, text: `On the 75% margin. Attend next class to stay safe.` };
  } else {
    const needed = Math.ceil((0.75 * total - attended) / 0.25);
    return { status: 'SHORTAGE', count: needed, text: `Shortage: Must attend next ${needed} consecutive class${needed > 1 ? 'es' : ''} to reach 75%.` };
  }
}

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

  return (
    <div className="student-workspace min-h-screen px-4 sm:px-8 py-8">
      <main className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs sm:text-sm text-slate-400">Welcome back</p>
            <h1 className="text-xl sm:text-2xl font-bold text-white">{attendance?.student?.name || 'Student Dashboard'}</h1>
            <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-slate-500">{attendance ? `${attendance.student.rollNo} · ${attendance.student.batchName}` : 'Your academic snapshot'}</p>
          </div>
          <div className="flex w-full sm:w-auto flex-wrap items-center gap-2.5">
            <button onClick={() => navigate('/student/calendar')} className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl border border-blue-500/40 bg-blue-950/60 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-blue-200 hover:bg-blue-900/80 transition shadow-sm">
              <Calendar size={16}/>Academic Calendar
            </button>
            <button onClick={() => navigate('/student/scan')} className="flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-xl bg-signal-red px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm">
              <ScanLine size={16}/>Mark attendance
            </button>
          </div>
        </div>

        {loading && <div className="mt-7"><StatePanel type="loading" title="Loading your dashboard" description="Fetching attendance, daily schedule and calculator details." /></div>}
        {!loading && error && <div className="mt-7"><StatePanel type="error" title="Dashboard unavailable" description={error} actionLabel="Try again" onAction={() => window.location.reload()} /></div>}

        {!loading && !error && (
          <>
            {/* Top Cards */}
            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <Card icon={<CalendarCheck/>} title="Overall attendance" value={`${average}%`} text="Across enrolled subjects"/>
              <Card icon={<ShieldAlert/>} title="Shortage alerts" value={String(shortage.length)} text={shortage.length ? shortage.map((item) => item.code).join(', ') : 'You are on track'}/>
              <Card icon={<Clock3/>} title="Recent sessions" value={String(attendance?.sessions?.length || 0)} text="View complete history" onClick={() => navigate('/student/attendance')}/>
            </div>

            {/* FEATURE 2: Today's Daily Schedule & Live Class Indicator */}
            <section className="mt-7 rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                    <Radio size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      Today's Class Schedule
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-500/40">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                        Live Period 2 Active
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">Real-time daily class timetable & ongoing session tracker</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/student/scan')}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-900/30"
                >
                  <ScanLine size={14} /> Scan Today's QR
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {TODAY_DAILY_SCHEDULE.map((item) => {
                  const isActive = item.status === 'ACTIVE';
                  const isCompleted = item.status === 'COMPLETED';

                  return (
                    <div
                      key={item.period}
                      className={`rounded-xl border p-3.5 flex flex-col justify-between transition ${
                        isActive
                          ? 'border-emerald-500 bg-emerald-950/60 shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500/40'
                          : isCompleted
                          ? 'border-slate-800 bg-slate-900/40 opacity-70'
                          : 'border-slate-800 bg-slate-900/90'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {item.period}
                          </span>
                          {isActive && (
                            <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold text-slate-950">
                              LIVE
                            </span>
                          )}
                          {isCompleted && (
                            <span className="text-[10px] font-bold text-slate-500">Done ✓</span>
                          )}
                        </div>
                        <p className="text-sm font-bold text-white">{item.subjectCode}</p>
                        <p className="text-xs text-slate-300 truncate mt-0.5">{item.subjectName}</p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-0.5">
                        <p className="font-mono">{item.time}</p>
                        <p className="flex items-center gap-1 font-semibold text-slate-300">
                          <Building size={11} className="text-slate-400" />
                          {item.room}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* FEATURE 1: Smart Attendance Calculator ("Classes Needed / Safe Classes") */}
            <section className="mt-7 rounded-2xl border border-blue-500/40 bg-blue-950/20 p-5 shadow-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                  <Calculator size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    Smart Attendance & Safe Bunk Calculator
                  </h2>
                  <p className="text-xs text-slate-400">Instant calculation of safe classes to miss or mandatory classes needed to reach 75%</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {attendance?.subjects?.map((sub) => {
                  const advice = calculateAttendanceAdvice(sub.attended || 16, sub.total || 20);
                  const isSafe = advice.status === 'SAFE';

                  return (
                    <div
                      key={sub.code}
                      className={`rounded-xl border p-4 transition ${
                        isSafe
                          ? 'border-emerald-500/30 bg-slate-900/90'
                          : 'border-rose-500/40 bg-rose-950/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white">{sub.code}</span>
                        <span className={`rounded-lg px-2.5 py-0.5 text-xs font-bold font-mono ${
                          sub.percentage >= 75 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        }`}>
                          {sub.percentage}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mb-3 truncate">{sub.name}</p>

                      <div className={`rounded-lg p-2.5 text-xs font-semibold flex items-start gap-2 ${
                        isSafe ? 'bg-emerald-950/50 text-emerald-200 border border-emerald-500/20' : 'bg-rose-950/60 text-rose-200 border border-rose-500/30'
                      }`}>
                        {isSafe ? <CheckCircle size={15} className="shrink-0 text-emerald-400 mt-0.5" /> : <AlertTriangle size={15} className="shrink-0 text-rose-400 mt-0.5" />}
                        <span>{advice.text}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Block Test Timetable Widget */}
            <section className="mt-7 rounded-2xl border border-amber-500/40 bg-amber-950/20 p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                    <BookOpenCheck size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      Upcoming Block Test Timetable
                      <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-300 border border-amber-500/30">
                        MCA-C · Semester III
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">Next examination schedule & hall allocation</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/student/calendar')}
                  className="flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-amber-200 transition"
                >
                  View Full Timetable <ChevronRight size={14} />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {UPCOMING_BLOCK_TESTS.slice(0, 3).map((bt) => (
                  <div key={bt.id} className="rounded-xl border border-amber-500/30 bg-slate-900/90 p-3.5 space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between text-xs">
                      <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono font-bold text-amber-300">{bt.date} ({bt.day})</span>
                      <span className="font-mono text-[10px] text-slate-400">{bt.time}</span>
                    </div>
                    <h3 className="text-sm font-bold text-white">{bt.subjectCode} · {bt.subjectName}</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <Building size={12} className="text-amber-400" />
                      Hall: <span className="text-slate-200 font-semibold">{bt.room}</span>
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Academic Calendar & Request Updates */}
            <div className="mt-7 grid gap-6 lg:grid-cols-2">
              {/* Upcoming Holidays & Events Card */}
              <section className="rounded-2xl border border-blue-500/30 bg-blue-950/20 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-white flex items-center gap-2">
                    <Calendar size={18} className="text-blue-400" />
                    College Academic Calendar & Holidays
                  </h2>
                  <button onClick={() => navigate('/student/calendar')} className="text-xs font-bold text-blue-300 hover:text-blue-200">
                    Full Calendar →
                  </button>
                </div>
                <div className="space-y-2.5">
                  {UPCOMING_HOLIDAYS.map((h) => (
                    <div key={h.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-xs">
                      <div>
                        <p className="font-bold text-white">{h.title}</p>
                        <p className="text-slate-400 mt-0.5">{h.desc}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-blue-400">{h.date}</span>
                        <span className={`block text-[10px] font-bold ${h.type === 'HOLIDAY' ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {h.type === 'HOLIDAY' ? 'College Holiday' : 'College Event'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Attendance Alerts & Requests */}
              <section className="rounded-2xl border border-ink-border bg-ink-850/60 p-5">
                <h2 className="font-bold text-white">Attendance Alerts & Requests</h2>
                {shortage.length ? shortage.map((item) => (
                  <div key={item.code} className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3">
                    <p className="font-semibold text-red-200">{item.code} · {item.percentage}%</p>
                    <p className="mt-1 text-xs text-slate-300">Below 75%. Attend upcoming classes consistently.</p>
                  </div>
                )) : <StatePanel type="success" compact title="No attendance shortage" description="Your attendance is currently on track." />}

                <div className="mt-5 flex gap-4 border-t border-slate-800 pt-4">
                  <button onClick={() => navigate('/student/leave')} className="text-sm font-semibold text-signal-blue">Apply Leave / OD</button>
                  <button onClick={() => navigate('/student/attendance')} className="text-sm font-semibold text-signal-blue">View Attendance History</button>
                </div>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Card({ icon, title, value, text, onClick }) {
  return (
    <button type="button" onClick={onClick} className="rounded-2xl border border-ink-border bg-ink-850/60 p-5 text-left transition hover:border-slate-700">
      <div className="text-signal-blue">{icon}</div>
      <p className="mt-4 text-3xl font-bold text-white">{value}</p>
      <p className="mt-1 font-semibold text-slate-300">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{text}</p>
    </button>
  );
}
