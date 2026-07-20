import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import { LayoutGrid, BarChart3, TrendingUp, Users, Calendar, Download, Search, FileSpreadsheet, Printer } from 'lucide-react';
import { correctAttendance, getSessionAttendance, listAllocations, listBatches, listHistory, listStudents } from '../services/api.js';

export default function AnalyticsDashboard() {
  const [data, setData] = useState({ history: [], students: [], batches: [], allocations: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ date: '', batchId: '', sessionId: '', status: 'ALL' });
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    Promise.all([listHistory(), listStudents(), listBatches(), listAllocations()])
      .then(([history, students, batches, allocations]) => setData({ history, students, batches, allocations }))
      .catch((err) => setError(err.message || 'Could not load live analytics'))
      .finally(() => setLoading(false));
  }, []);

  const filteredSessions = useMemo(() => data.history.filter((session) => {
    const localDate = new Date(session.startedAt).toLocaleDateString('en-CA');
    return (!filters.date || localDate === filters.date) && (!filters.batchId || session.batchId === filters.batchId);
  }), [data.history, filters.date, filters.batchId]);

  useEffect(() => {
    if (!filters.sessionId || !filteredSessions.some((item) => item.sessionId === filters.sessionId)) {
      setFilters((current) => ({ ...current, sessionId: filteredSessions[0]?.sessionId || '' }));
      setReport(null);
    }
  }, [filteredSessions, filters.sessionId]);

  const loadReport = async () => {
    if (!filters.sessionId) return;
    setReportLoading(true); setError('');
    try { setReport(await getSessionAttendance(filters.sessionId)); }
    catch (err) { setError(err.message || 'Could not load attendance report'); }
    finally { setReportLoading(false); }
  };

  const visibleStudents = useMemo(() => report?.students.filter((student) => filters.status === 'ALL' || student.attendanceStatus === filters.status) || [], [report, filters.status]);

  const downloadCsv = () => {
    if (!report) return;
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['S.No', 'Roll No', 'Register No', 'Student Name', 'Email', 'Attendance', 'Check-in Time', 'Location Verified'],
      ...visibleStudents.map((student, index) => [index + 1, student.rollNo, student.regNo, student.name, student.email, student.attendanceStatus, student.scanTime ? new Date(student.scanTime).toLocaleString('en-IN') : '', student.locationVerified ? 'Yes' : 'No']),
    ];
    const metadata = [`Faculty: ${report.facultyName}`, `Section: ${report.batchName}`, `Subject: ${report.subjectCode} - ${report.subjectName}`, `Session: ${new Date(report.startedAt).toLocaleString('en-IN')} - ${report.endedAt ? new Date(report.endedAt).toLocaleTimeString('en-IN') : 'Active'}`];
    const csv = `\uFEFF${metadata.map(escape).join('\n')}\n\n${rows.map((row) => row.map(escape).join(',')).join('\n')}`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `attendance-${report.batchName}-${new Date(report.startedAt).toLocaleDateString('en-CA')}-${report.subjectCode}.csv`.replace(/\s+/g, '-');
    link.click(); URL.revokeObjectURL(url);
  };

  const changeAttendance = async (student) => {
    const nextStatus = window.prompt(`Status for ${student.name}: PRESENT, ABSENT, LATE, ON_DUTY, or LEAVE`, student.attendanceStatus)?.trim().toUpperCase();
    if (!['PRESENT', 'ABSENT', 'LATE', 'ON_DUTY', 'LEAVE'].includes(nextStatus)) return;
    const reason = window.prompt(`Change ${student.name} to ${nextStatus}. Enter reason:`);
    if (!reason) return;
    try { await correctAttendance(report.sessionId, { rollNo: student.rollNo, status: nextStatus, reason }); await loadReport(); }
    catch (err) { setError(err.message || 'Attendance correction failed'); }
  };

  const metrics = useMemo(() => {
    const totalExpected = data.history.reduce((sum, item) => sum + item.totalStudents, 0);
    const totalPresent = data.history.reduce((sum, item) => sum + item.present, 0);
    const average = totalExpected ? Math.round((totalPresent / totalExpected) * 1000) / 10 : 0;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const sessionsThisWeek = data.history.filter((item) => new Date(item.startedAt) >= weekStart).length;
    const grouped = data.history.reduce((result, item) => {
      const current = result[item.subjectCode] || { name: item.subjectName, present: 0, total: 0 };
      current.present += item.present; current.total += item.totalStudents; result[item.subjectCode] = current;
      return result;
    }, {});
    const trends = Object.entries(grouped).map(([code, item]) => ({ code, name: item.name, percentage: item.total ? Math.round((item.present / item.total) * 100) : 0 }));
    return { average, sessionsThisWeek, trends };
  }, [data]);

  return <div className="flex min-h-screen bg-ink-950"><Sidebar /><main className="flex-1 min-w-0 pb-10"><TopBar connected={!loading && !error} />
    <div className="px-8 mt-6">
      <div className="flex items-center gap-3 mb-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-signal-blue/10 border border-signal-blue/20 text-signal-blue"><LayoutGrid size={20}/></div><div><h2 className="text-xl font-bold text-white">Department Analytics</h2><p className="text-sm text-slate-400">Live database-backed class and attendance insights</p></div></div>
      {error && <p className="mb-5 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          ['Average Attendance', loading ? '...' : `${metrics.average}%`, 'Across completed sessions', TrendingUp, 'green'],
          ['Active Students', loading ? '...' : data.students.length, 'Students enrolled in database', Users, 'blue'],
          ['Sessions This Week', loading ? '...' : metrics.sessionsThisWeek, 'Faculty sessions in last 7 days', Calendar, 'amber'],
          ['Assigned Classes', loading ? '...' : data.allocations.length, 'Current timetable allocations', BarChart3, 'red'],
        ].map(([title,value,subtitle,Icon,tone]) => <div key={title} className="rounded-2xl border border-ink-border bg-ink-850/60 p-5 shadow-card"><div className="flex justify-between items-center text-slate-400"><span className="text-xs font-semibold uppercase tracking-wider">{title}</span><Icon size={18} className={`text-signal-${tone}`}/></div><p className="text-3xl font-bold text-white mt-2">{value}</p><p className="text-xs text-slate-500 mt-1">{subtitle}</p></div>)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 rounded-2xl border border-ink-border bg-ink-850/60 p-6 shadow-card"><h3 className="text-base font-bold text-white mb-6">Attendance Trends by Subject</h3><div className="space-y-4">{metrics.trends.map((item) => <div key={item.code}><div className="flex justify-between text-xs font-semibold mb-1"><span className="text-slate-300">{item.code} · {item.name}</span><span className={item.percentage >= 75 ? 'text-signal-green' : item.percentage >= 50 ? 'text-signal-amber' : 'text-signal-red'}>{item.percentage}%</span></div><div className="h-2 bg-ink-900 rounded-full overflow-hidden"><div className={item.percentage >= 75 ? 'h-full bg-signal-green' : item.percentage >= 50 ? 'h-full bg-signal-amber' : 'h-full bg-signal-red'} style={{ width: `${item.percentage}%` }}/></div></div>)}{!loading && !metrics.trends.length && <p className="py-8 text-center text-sm text-slate-500">Subject trends will appear after attendance sessions are completed.</p>}</div></div>
        <div className="rounded-2xl border border-ink-border bg-ink-850/60 p-6 shadow-card"><h3 className="text-base font-bold text-white mb-2">Batch Distribution</h3><p className="text-xs text-slate-400 mb-6">Live section-wise student counts</p><div className="space-y-4">{data.batches.map((batch) => <div key={batch.id} className="flex justify-between items-center text-sm p-3 bg-ink-900/60 rounded-xl border border-ink-border/50"><span className="text-slate-200 font-semibold">{batch.name}</span><span className="text-slate-400">{data.students.filter((student) => student.batchId === batch.id).length} Students</span></div>)}</div></div>
      </div>
      <section className="mt-8 rounded-2xl border border-ink-border bg-ink-850/60 p-6 shadow-card">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><FileSpreadsheet className="text-signal-green" size={20}/><h3 className="text-base font-bold text-white">Section & Period Attendance Report</h3></div><p className="mt-1 text-xs text-slate-400">Select a date, section and session/period to download present and absent details.</p></div>{report && <div className="flex gap-2"><button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl border border-signal-blue/30 px-4 py-2 text-sm font-bold text-signal-blue"><Printer size={16}/>Print / Save PDF</button><button onClick={downloadCsv} className="flex items-center gap-2 rounded-xl bg-signal-green px-4 py-2 text-sm font-bold text-ink-950"><Download size={16}/>Download CSV ({visibleStudents.length})</button></div>}</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="text-xs font-semibold text-slate-400">Date<input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value, sessionId: '' })} className="mt-1.5 w-full rounded-xl border border-ink-border bg-ink-900 px-3 py-2.5 text-white"/></label>
          <label className="text-xs font-semibold text-slate-400">Section<select value={filters.batchId} onChange={(e) => setFilters({ ...filters, batchId: e.target.value, sessionId: '' })} className="mt-1.5 w-full rounded-xl border border-ink-border bg-ink-900 px-3 py-2.5 text-white"><option value="">All sections</option>{data.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-400 xl:col-span-2">Period / Session<select value={filters.sessionId} onChange={(e) => { setFilters({ ...filters, sessionId: e.target.value }); setReport(null); }} className="mt-1.5 w-full rounded-xl border border-ink-border bg-ink-900 px-3 py-2.5 text-white"><option value="">No session found</option>{filteredSessions.map((session) => <option key={session.sessionId} value={session.sessionId}>{new Date(session.startedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} · {session.subjectCode} · {session.batchName}</option>)}</select></label>
          <button disabled={!filters.sessionId || reportLoading} onClick={loadReport} className="mt-5 flex items-center justify-center gap-2 rounded-xl bg-signal-blue px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"><Search size={16}/>{reportLoading ? 'Loading...' : 'View Report'}</button>
        </div>
        {report && <><div className="my-5 flex flex-wrap items-center gap-3"><span className="rounded-lg border border-signal-green/20 bg-signal-green/10 px-3 py-1.5 text-xs font-bold text-signal-green">Present: {report.students.filter((s) => s.attendanceStatus === 'PRESENT').length}</span><span className="rounded-lg border border-signal-red/20 bg-signal-red/10 px-3 py-1.5 text-xs font-bold text-signal-red">Absent: {report.students.filter((s) => s.attendanceStatus === 'ABSENT').length}</span><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="ml-auto rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-xs text-white"><option value="ALL">Present + Absent</option><option value="PRESENT">Present only</option><option value="ABSENT">Absent only</option></select></div>
          <div className="overflow-x-auto rounded-xl border border-ink-border"><table className="w-full min-w-[950px] text-left text-sm"><thead><tr className="text-slate-400">{['Roll No','Register No','Student','Email','Status','Check-in Time','Location','Correction'].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody>{visibleStudents.map((student) => <tr key={student.rollNo} className="border-t border-ink-border"><td className="px-4 py-3 font-mono text-slate-300">{student.rollNo}</td><td className="px-4 py-3 font-mono text-slate-400">{student.regNo}</td><td className="px-4 py-3 font-semibold text-white">{student.name}</td><td className="px-4 py-3 text-slate-400">{student.email}</td><td className="px-4 py-3"><span className={student.attendanceStatus === 'PRESENT' ? 'rounded-full bg-signal-green/10 px-2 py-1 text-xs font-bold text-signal-green' : 'rounded-full bg-signal-red/10 px-2 py-1 text-xs font-bold text-signal-red'}>{student.attendanceStatus}</span></td><td className="px-4 py-3 text-slate-300">{student.scanTime ? new Date(student.scanTime).toLocaleString('en-IN') : '—'}</td><td className="px-4 py-3 text-slate-400">{student.locationVerified ? 'Verified' : '—'}</td><td className="px-4 py-3"><button onClick={() => changeAttendance(student)} className="rounded-lg border border-signal-blue/30 px-2 py-1 text-xs font-semibold text-signal-blue">Mark {student.attendanceStatus === 'PRESENT' ? 'Absent' : 'Present'}</button></td></tr>)}</tbody></table></div></>}
      </section>
    </div></main></div>;
}
