import { useEffect, useState } from 'react';
import { Calendar, CalendarCheck, Clock3, ScanLine, ShieldAlert, BookOpenCheck, Building, ChevronRight, Calculator, Radio, CheckCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getMyAttendance, listAllocations, listAttendanceCorrections, listBlockTests, listCalendarEvents, listLeaveRequests } from '../services/api.js';
import BadgesWidget from '../components/BadgesWidget.jsx';
import StatePanel from '../components/StatePanel.jsx';
import { format12HourRange } from '../utils/timeFormat.js';
import { attendanceAdvice, istNow, overallPercentage, todaysPeriods } from '../utils/studentInsights.js';

const EVENT_LABEL = { HOLIDAY: 'College Holiday', EXAM: 'Examination', EVENT: 'College Event', WORKING: 'Working Day' };
const EVENT_TONE = { HOLIDAY: 'text-rose-400', EXAM: 'text-amber-400', EVENT: 'text-emerald-400', WORKING: 'text-sky-400' };

/** Everything below is the student's own data from the server; nothing on this page is a placeholder. */
export default function StudentDashboardPage() {
  const navigate = useNavigate();
  const [attendance, setAttendance] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [events, setEvents] = useState([]);
  const [blockTests, setBlockTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    let cancelled = false;
    const today = istNow().dateKey;
    (async () => {
      try {
        // Attendance is the page's purpose: if it cannot load, say so. The widgets around it are optional, so
        // a failure there (for example the calendar) must not blank the whole dashboard.
        const [history, extras] = await Promise.all([
          getMyAttendance(),
          Promise.allSettled([listLeaveRequests(), listAttendanceCorrections(), listAllocations(), listCalendarEvents({ from: today }), listBlockTests({ from: today })]),
        ]);
        if (cancelled) return;
        const [leaves, corrections, allocations, calendar, tests] = extras.map((result) => (result.status === 'fulfilled' ? result.value : []));
        setAttendance(history);
        setTimetable(allocations);
        setEvents(calendar.slice(0, 3));
        setBlockTests(tests.slice(0, 3));
        setUpdates([
          ...leaves.map((item) => ({ id: `l-${item.id}`, label: `${item.type === 'ON_DUTY' ? 'OD' : 'Leave'} request`, status: item.status, date: item.createdAt })),
          ...corrections.map((item) => ({ id: `c-${item.id}`, label: `Attendance correction · ${item.session.subject.code}`, status: item.status, date: item.createdAt })),
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5));
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load your dashboard.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Keeps the "live period" highlight honest while the page stays open.
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const subjects = attendance?.subjects || [];
  const shortage = subjects.filter((item) => item.shortage);
  const average = overallPercentage(subjects);
  const periods = todaysPeriods(timetable, clock);
  const activePeriod = periods.find((item) => item.status === 'ACTIVE');
  const sectionName = attendance?.student?.batchName;

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
              <Card icon={<CalendarCheck/>} title="Overall attendance" value={average === null ? '—' : `${average}%`} text={average === null ? 'No class has finished yet' : 'Across enrolled subjects'}/>
              <Card icon={<ShieldAlert/>} title="Shortage alerts" value={String(shortage.length)} text={shortage.length ? shortage.map((item) => item.code).join(', ') : 'You are on track'}/>
              <Card icon={<Clock3/>} title="Recent sessions" value={String(attendance?.sessions?.length || 0)} text="View complete history" onClick={() => navigate('/student/attendance')}/>
            </div>

            {/* Streaks and badges, computed from the attendance history */}
            <div className="mt-7">
              <BadgesWidget attendancePercentage={average} sessions={attendance?.sessions || []} />
            </div>

            {/* Today's classes, from the section's real timetable */}
            <section className="mt-7 rounded-2xl border border-emerald-500/40 bg-emerald-950/20 p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                    <Radio size={20} className="animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      Today's Class Schedule
                      {activePeriod ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300 border border-emerald-500/40">
                          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                          Live {activePeriod.period} Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 px-2.5 py-0.5 text-xs font-bold text-slate-400 border border-slate-700/60">
                          <span className="h-2 w-2 rounded-full bg-slate-500" />
                          No Active Period
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-400">{sectionName ? `Timetable for ${sectionName}` : 'Your section timetable'}</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/student/scan')}
                  className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition shadow-lg shadow-emerald-900/30"
                >
                  <ScanLine size={14} /> Mark attendance
                </button>
              </div>

              {periods.length === 0 ? (
                <StatePanel type="empty" compact title="No classes scheduled today" description="Your administrator has not assigned any period for today in your section's timetable." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {periods.map((item) => {
                    const isActive = item.status === 'ACTIVE';
                    const isCompleted = item.status === 'COMPLETED';
                    return (
                      <div
                        key={item.id}
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
                            {isActive && <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold text-slate-950">LIVE</span>}
                            {isCompleted && <span className="text-[10px] font-bold text-slate-500">Done ✓</span>}
                          </div>
                          <p className="text-sm font-bold text-white">{item.subject?.code}</p>
                          <p className="text-xs text-slate-300 truncate mt-0.5">{item.subject?.name}</p>
                          {item.faculty?.name && <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.faculty.name}</p>}
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-0.5">
                          <p className="font-mono">{format12HourRange(item.startTime, item.endTime)}</p>
                          <p className="flex items-center gap-1 font-semibold text-slate-300">
                            <Building size={11} className="text-slate-400" />
                            {item.room?.name}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Smart attendance calculator, from the real present / total counts */}
            <section className="mt-7 rounded-2xl border border-blue-500/40 bg-blue-950/20 p-5 shadow-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                  <Calculator size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    Smart Attendance & Safe Bunk Calculator
                  </h2>
                  <p className="text-xs text-slate-400">Classes you can still miss, or must attend, to stay at 75% in each subject</p>
                </div>
              </div>

              {subjects.length === 0 ? (
                <StatePanel type="empty" compact title="Nothing to calculate yet" description="Subjects appear here after their first class has finished." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {subjects.map((sub) => {
                    const advice = attendanceAdvice(sub.present, sub.total);
                    const isSafe = advice.status !== 'SHORTAGE';
                    return (
                      <div
                        key={sub.code}
                        className={`rounded-xl border p-4 transition ${
                          isSafe ? 'border-emerald-500/30 bg-slate-900/90' : 'border-rose-500/40 bg-rose-950/20'
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
                        <p className="text-xs text-slate-300 mb-1 truncate">{sub.name}</p>
                        <p className="text-[11px] text-slate-500 mb-3">{sub.present} of {sub.total} classes attended</p>

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
              )}
            </section>

            {/* Block tests announced by the administrator */}
            <section className="mt-7 rounded-2xl border border-amber-500/40 bg-amber-950/20 p-5 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                    <BookOpenCheck size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      Upcoming Block Tests
                      {sectionName && (
                        <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold text-amber-300 border border-amber-500/30">
                          {sectionName}
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-400">Examination schedule and hall allocation</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/student/calendar')}
                  className="flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-amber-200 transition"
                >
                  View Full Timetable <ChevronRight size={14} />
                </button>
              </div>

              {blockTests.length === 0 ? (
                <StatePanel type="empty" compact title="No block tests announced" description="When your administrator publishes a block-test timetable it appears here." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {blockTests.map((bt) => (
                    <div key={bt.id} className="rounded-xl border border-amber-500/30 bg-slate-900/90 p-3.5 space-y-1.5 shadow-sm">
                      <div className="flex items-center justify-between text-xs">
                        <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono font-bold text-amber-300">{bt.date}</span>
                        <span className="font-mono text-[10px] text-slate-400">{format12HourRange(bt.startTime, bt.endTime)}</span>
                      </div>
                      <h3 className="text-sm font-bold text-white">{bt.subjectCode} · {bt.subjectName}</h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Building size={12} className="text-amber-400" />
                        Hall: <span className="text-slate-200 font-semibold">{bt.room}</span>
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Academic calendar & request updates */}
            <div className="mt-7 grid gap-6 lg:grid-cols-2">
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
                {events.length === 0 ? (
                  <StatePanel type="empty" compact title="Nothing scheduled" description="No upcoming holidays or events have been published." />
                ) : (
                  <div className="space-y-2.5">
                    {events.map((h) => (
                      <div key={h.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2.5 text-xs">
                        <div>
                          <p className="font-bold text-white">{h.title}</p>
                          {h.description && <p className="text-slate-400 mt-0.5">{h.description}</p>}
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-bold text-blue-400">{h.date}</span>
                          <span className={`block text-[10px] font-bold ${EVENT_TONE[h.type] || 'text-slate-400'}`}>{EVENT_LABEL[h.type] || h.type}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Attendance alerts & requests */}
              <section className="rounded-2xl border border-ink-border bg-ink-850/60 p-5">
                <h2 className="font-bold text-white">Attendance Alerts & Requests</h2>
                {shortage.length ? shortage.map((item) => (
                  <div key={item.code} className="mt-3 rounded-xl border border-red-400/20 bg-red-500/10 p-3">
                    <p className="font-semibold text-red-200">{item.code} · {item.percentage}%</p>
                    <p className="mt-1 text-xs text-slate-300">Below 75%. Attend upcoming classes consistently.</p>
                  </div>
                )) : <StatePanel type="success" compact title="No attendance shortage" description="Your attendance is currently on track." />}

                {updates.length > 0 && (
                  <ul className="mt-4 space-y-1.5 text-xs text-slate-300">
                    {updates.map((update) => (
                      <li key={update.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/60 px-3 py-2">
                        <span className="truncate">{update.label}</span>
                        <span className="font-bold text-signal-blue">{update.status}</span>
                      </li>
                    ))}
                  </ul>
                )}

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
