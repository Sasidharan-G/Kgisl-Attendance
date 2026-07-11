import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import { LayoutGrid, BarChart3, TrendingUp, Users, Calendar } from 'lucide-react';
import { listAllocations, listBatches, listHistory, listStudents } from '../services/api.js';

export default function AnalyticsDashboard() {
  const [data, setData] = useState({ history: [], students: [], batches: [], allocations: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([listHistory(), listStudents(), listBatches(), listAllocations()])
      .then(([history, students, batches, allocations]) => setData({ history, students, batches, allocations }))
      .catch((err) => setError(err.message || 'Could not load live analytics'))
      .finally(() => setLoading(false));
  }, []);

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
        <div className="lg:col-span-2 rounded-2xl border border-ink-border bg-ink-850/60 p-6 shadow-card"><h3 className="text-base font-bold text-white mb-6">Attendance Trends by Subject</h3><div className="space-y-4">{metrics.trends.map((item) => <div key={item.code}><div className="flex justify-between text-xs font-semibold mb-1"><span className="text-slate-300">{item.code} · {item.name}</span><span className={item.percentage >= 75 ? 'text-signal-green' : item.percentage >= 50 ? 'text-signal-amber' : 'text-signal-red'}>{item.percentage}%</span></div><div className="h-2 bg-ink-900 rounded-full overflow-hidden"><div className={item.percentage >= 75 ? 'h-full bg-signal-green' : item.percentage >= 50 ? 'h-full bg-signal-amber' : 'h-full bg-signal-red'} style={{ width: `${item.percentage}%` }}/></div></div>)}{!loading && !metrics.trends.length && <p className="py-8 text-center text-sm text-slate-500">Attendance sessions complete aana piragu subject trends inga varum.</p>}</div></div>
        <div className="rounded-2xl border border-ink-border bg-ink-850/60 p-6 shadow-card"><h3 className="text-base font-bold text-white mb-2">Batch Distribution</h3><p className="text-xs text-slate-400 mb-6">Live section-wise student counts</p><div className="space-y-4">{data.batches.map((batch) => <div key={batch.id} className="flex justify-between items-center text-sm p-3 bg-ink-900/60 rounded-xl border border-ink-border/50"><span className="text-slate-200 font-semibold">{batch.name}</span><span className="text-slate-400">{data.students.filter((student) => student.batchId === batch.id).length} Students</span></div>)}</div></div>
      </div>
    </div></main></div>;
}
