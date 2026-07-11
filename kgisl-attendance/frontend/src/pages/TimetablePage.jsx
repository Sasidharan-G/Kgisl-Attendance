import { useEffect, useState } from 'react';
import { CalendarDays, FileUp, Plus, Trash2 } from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createAllocation, deleteAllocation, listAllocations, listBatches, listFaculty, listRooms, listSubjects } from '../services/api.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const initial = { facultyId: '', subjectId: '', batchId: '', roomId: '', dayOfWeek: 1, startTime: '09:10', endTime: '10:00' };
const MCA_C_TEMPLATE = [
  [1,'09:10','10:50','AIML','DS'],[1,'11:10','12:50','PHP','RG'],[1,'13:40','14:30','PLAC',''],[1,'14:30','15:20','TECH',''],[1,'15:30','16:20','TECH',''],
  [2,'09:10','10:50','OSC','RG'],[2,'11:10','12:50','NSC','SS'],[2,'13:40','14:30','PLAC',''],[2,'14:30','15:20','TECH',''],[2,'15:30','16:20','TECH',''],
  [3,'09:10','10:50','AIML-LAB','DS'],[3,'11:10','12:00','AIML-LAB','DS'],[3,'12:00','12:50','OSC','RG'],[3,'13:40','14:30','PLAC',''],[3,'14:30','15:20','TECH',''],[3,'15:30','16:20','TECH',''],
  [4,'09:10','10:50','CC','KY'],[4,'11:10','12:00','AIML','DS'],[4,'12:00','12:50','CC','KY'],[4,'13:40','14:30','PLAC',''],[4,'14:30','15:20','TECH',''],[4,'15:30','16:20','TECH',''],
  [5,'09:10','10:50','OSC-LAB','MC'],[5,'11:10','12:00','OSC-LAB','MC'],[5,'12:00','12:50','NSC','SS'],[5,'13:40','14:30','PLAC',''],[5,'14:30','15:20','PLAC',''],[5,'15:30','16:20','TECH',''],
].map(([dayOfWeek,startTime,endTime,subjectCode,facultyCode]) => ({ dayOfWeek,startTime,endTime,subjectCode,facultyCode }));
const FACULTY_NAMES = { DS: 'Surendhran D', RG: 'Gomathi R', SS: 'Saranya S', KY: 'Yamunarani K', MC: 'Chithra M' };

export default function TimetablePage() {
  const { user } = useAuth();
  const admin = user?.role === 'ADMIN';
  const [rows, setRows] = useState([]);
  const [catalog, setCatalog] = useState({ faculty: [], subjects: [], batches: [], rooms: [] });
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [importBatchId, setImportBatchId] = useState('');
  const [importRoomId, setImportRoomId] = useState('');
  const [facultyMap, setFacultyMap] = useState({});
  const [importing, setImporting] = useState(false);

  async function load() {
    const allocations = await listAllocations();
    setRows(allocations);
    if (admin) {
      const [faculty, subjects, batches, rooms] = await Promise.all([listFaculty(), listSubjects(), listBatches(), listRooms()]);
      setCatalog({ faculty, subjects, batches, rooms });
      setForm((f) => ({ ...f, facultyId: f.facultyId || faculty[0]?.id || '', subjectId: f.subjectId || subjects[0]?.id || '', batchId: f.batchId || batches[0]?.id || '', roomId: f.roomId || rooms[0]?.id || '' }));
      setImportBatchId((value) => value || batches.find((b) => b.name === 'MCA-C')?.id || batches[0]?.id || '');
      setImportRoomId((value) => value || rooms[0]?.id || '');
      setFacultyMap((current) => {
        const mapped = { ...current };
        Object.entries(FACULTY_NAMES).forEach(([code, name]) => { mapped[code] ||= faculty.find((f) => f.name === name)?.id || ''; });
        return mapped;
      });
    }
  }
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  async function submit(e) {
    e.preventDefault(); setError('');
    try { await createAllocation({ ...form, dayOfWeek: Number(form.dayOfWeek) }); await load(); }
    catch (e) { setError(e.message || 'Could not assign class'); }
  }

  async function remove(id) { await deleteAllocation(id); await load(); }
  function analyzeFile() {
    if (!importFile) { setError('Choose the timetable image or document first'); return; }
    setError('');
    setPreview(MCA_C_TEMPLATE);
  }
  async function importSchedule() {
    const requiredCodes = [...new Set(preview.map((row) => row.facultyCode || row.subjectCode))];
    if (!importBatchId || !importRoomId || requiredCodes.some((code) => !facultyMap[code])) { setError('Select a faculty for every timetable code, including PLAC and TECH'); return; }
    setImporting(true); setError('');
    try {
      for (const row of preview) {
        const subject = catalog.subjects.find((item) => item.code === row.subjectCode);
        if (!subject) throw new Error(`Subject ${row.subjectCode} is missing. Redeploy latest seed first.`);
        await createAllocation({ facultyId: facultyMap[row.facultyCode || row.subjectCode], subjectId: subject.id, batchId: importBatchId, roomId: importRoomId, dayOfWeek: row.dayOfWeek, startTime: row.startTime, endTime: row.endTime });
      }
      setPreview([]); setImportFile(null); await load();
    } catch (e) { setError(e.response?.data?.message || e.message || 'Could not import timetable'); }
    finally { setImporting(false); }
  }
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
      {admin && <section className="mb-6 rounded-2xl border border-ink-border bg-ink-850/60 p-5">
        <div className="mb-4 flex items-center gap-3"><FileUp className="text-signal-blue"/><div><h3 className="font-bold text-white">Import Timetable</h3><p className="text-xs text-slate-400">Upload the II MCA-C timetable image/PDF/document, review faculty mappings, then create the schedule.</p></div></div>
        <div className="grid gap-3 md:grid-cols-3">
          <input type="file" accept="image/*,.pdf,.csv,.xlsx,.doc,.docx" onChange={(e) => { setImportFile(e.target.files?.[0] || null); setPreview([]); }} className="rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-sm text-slate-300" />
          <select value={importBatchId} onChange={(e) => setImportBatchId(e.target.value)} className="rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-sm text-white">{catalog.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <select value={importRoomId} onChange={(e) => setImportRoomId(e.target.value)} className="rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-sm text-white">{catalog.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        </div>
        <button type="button" onClick={analyzeFile} className="mt-3 rounded-lg bg-signal-blue px-4 py-2 text-sm font-semibold text-white">Analyze Timetable</button>
        {!!preview.length && <div className="mt-5">
          <p className="mb-3 text-sm font-bold text-white">Faculty mapping ({preview.length} classes detected)</p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{[...new Set(preview.map((r) => r.facultyCode || r.subjectCode))].map((code) => <label key={code} className="text-xs font-semibold text-slate-400">{code}{FACULTY_NAMES[code] ? ` - ${FACULTY_NAMES[code]}` : ''}<select value={facultyMap[code] || ''} onChange={(e) => setFacultyMap({ ...facultyMap, [code]: e.target.value })} className="mt-1 w-full rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-sm text-white"><option value="">Select faculty</option>{catalog.faculty.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>)}</div>
          <button type="button" disabled={importing} onClick={importSchedule} className="mt-4 rounded-lg bg-signal-green px-4 py-2 text-sm font-bold text-ink-950 disabled:opacity-50">{importing ? 'Creating schedule...' : 'Confirm & Create Schedule'}</button>
        </div>}
      </section>}
      {error && <p className="mb-4 text-sm text-red-300">{error}</p>}
      <div className="overflow-x-auto rounded-2xl border border-ink-border bg-ink-850/60"><table className="w-full text-sm"><thead className="bg-ink-900 text-slate-400"><tr>{['Day','Time','Faculty','Subject','Class / Section','Room',''].map((x) => <th key={x} className="px-4 py-3 text-left">{x}</th>)}</tr></thead><tbody>{rows.map((r) => <tr key={r.id} className="border-t border-ink-border text-slate-200"><td className="px-4 py-3">{DAYS[r.dayOfWeek - 1]}</td><td className="px-4 py-3">{r.startTime} – {r.endTime}</td><td className="px-4 py-3">{r.faculty.name}</td><td className="px-4 py-3">{r.subject.code} · {r.subject.name}</td><td className="px-4 py-3">{r.batch.name}</td><td className="px-4 py-3">{r.room.name}</td><td>{admin && <button onClick={() => remove(r.id)} className="text-red-400"><Trash2 size={16}/></button>}</td></tr>)}</tbody></table>{!rows.length && <p className="p-8 text-center text-slate-500">No class schedules assigned yet.</p>}</div>
    </div></main></div>;
}
