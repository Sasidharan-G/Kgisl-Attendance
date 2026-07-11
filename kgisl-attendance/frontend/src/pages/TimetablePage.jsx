import { useEffect, useState } from 'react';
import { CalendarDays, Plus, Trash2 } from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createAllocation, deleteAllocation, listAllocations, listBatches, listFaculty, listRooms, listSubjects } from '../services/api.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const initial = { facultyId: '', subjectId: '', batchId: '', roomId: '', dayOfWeek: 1, startTime: '09:10', endTime: '10:00' };

export default function TimetablePage() {
  const { user } = useAuth();
  const admin = user?.role === 'ADMIN';
  const [rows, setRows] = useState([]);
  const [catalog, setCatalog] = useState({ faculty: [], subjects: [], batches: [], rooms: [] });
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');

  async function load() {
    const allocations = await listAllocations();
    setRows(allocations);
    if (admin) {
      const [faculty, subjects, batches, rooms] = await Promise.all([listFaculty(), listSubjects(), listBatches(), listRooms()]);
      setCatalog({ faculty, subjects, batches, rooms });
      setForm((f) => ({ ...f, facultyId: f.facultyId || faculty[0]?.id || '', subjectId: f.subjectId || subjects[0]?.id || '', batchId: f.batchId || batches[0]?.id || '', roomId: f.roomId || rooms[0]?.id || '' }));
    }
  }
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  async function submit(e) {
    e.preventDefault(); setError('');
    try { await createAllocation({ ...form, dayOfWeek: Number(form.dayOfWeek) }); await load(); }
    catch (e) { setError(e.message || 'Could not assign class'); }
  }

  async function remove(id) { await deleteAllocation(id); await load(); }
  const field = (key, options) => <select value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-sm text-white">{options.map((x) => <option key={x.id} value={x.id}>{x.name || x.code}</option>)}</select>;

  return <div className="flex min-h-screen bg-ink-950"><Sidebar /><main className="flex-1 min-w-0 pb-10"><TopBar connected />
    <div className="px-8 mt-6">
      <div className="flex items-center gap-3 mb-6"><CalendarDays className="text-signal-amber" /><div><h2 className="text-xl font-bold text-white">{admin ? 'Class Schedule Assignment' : 'My Assigned Timetable'}</h2><p className="text-sm text-slate-400">{admin ? 'Assign faculty, subject, class/section, room and time' : 'Only these assigned classes can start attendance sessions'}</p></div></div>
      {admin && <form onSubmit={submit} className="mb-6 grid grid-cols-2 xl:grid-cols-4 gap-3 rounded-2xl border border-ink-border bg-ink-850/60 p-5">
        {field('facultyId', catalog.faculty)}{field('subjectId', catalog.subjects)}{field('batchId', catalog.batches)}{field('roomId', catalog.rooms)}
        <select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })} className="rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-sm text-white">{DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select>
        <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-white" />
        <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-white" />
        <button className="flex items-center justify-center gap-2 rounded-lg bg-signal-blue px-4 py-2 font-semibold text-white"><Plus size={16}/>Assign Class</button>
      </form>}
      {error && <p className="mb-4 text-sm text-red-300">{error}</p>}
      <div className="overflow-x-auto rounded-2xl border border-ink-border bg-ink-850/60"><table className="w-full text-sm"><thead className="bg-ink-900 text-slate-400"><tr>{['Day','Time','Faculty','Subject','Class / Section','Room',''].map((x) => <th key={x} className="px-4 py-3 text-left">{x}</th>)}</tr></thead><tbody>{rows.map((r) => <tr key={r.id} className="border-t border-ink-border text-slate-200"><td className="px-4 py-3">{DAYS[r.dayOfWeek - 1]}</td><td className="px-4 py-3">{r.startTime} – {r.endTime}</td><td className="px-4 py-3">{r.faculty.name}</td><td className="px-4 py-3">{r.subject.code} · {r.subject.name}</td><td className="px-4 py-3">{r.batch.name}</td><td className="px-4 py-3">{r.room.name}</td><td>{admin && <button onClick={() => remove(r.id)} className="text-red-400"><Trash2 size={16}/></button>}</td></tr>)}</tbody></table>{!rows.length && <p className="p-8 text-center text-slate-500">No class schedules assigned yet.</p>}</div>
    </div></main></div>;
}
