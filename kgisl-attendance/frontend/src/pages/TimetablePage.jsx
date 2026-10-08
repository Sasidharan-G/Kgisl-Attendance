import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, FileUp, Plus, Trash2 } from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createAllocation, deleteAllocation, listAllocations, listBatches, listFaculty, listRooms, listSubjects } from '../services/api.js';
import { format12Hour, format12HourRange } from '../utils/timeFormat.js';
import { TIMETABLE_CSV_TEMPLATE, parseTimetableCsv } from '../utils/timetableCsv.js';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const initial = { facultyId: '', subjectId: '', batchId: '', roomId: '', dayOfWeek: 1, startTime: '09:10', endTime: '10:00' };
const WEEK_SLOTS = [
  { label: '1', start: '09:10', end: '10:00' },
  { label: '2', start: '10:00', end: '10:50' },
  { label: 'Break', break: true, time: format12HourRange('10:50', '11:10') },
  { label: '3', start: '11:10', end: '12:00' },
  { label: '4', start: '12:00', end: '12:50' },
  { label: 'Lunch', lunch: true, time: format12HourRange('12:50', '13:40') },
  { label: '5', start: '13:40', end: '14:30' },
  { label: '6', start: '14:30', end: '15:20' },
  { label: 'Break', break: true, time: format12HourRange('15:20', '15:30') },
  { label: '7', start: '15:30', end: '16:20' },
];

export default function TimetablePage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const admin = user?.role === 'ADMIN';
  const [rows, setRows] = useState([]);
  const [catalog, setCatalog] = useState({ faculty: [], subjects: [], batches: [], rooms: [] });
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [importFile, setImportFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [importBatchId, setImportBatchId] = useState('');
  const [importRoomId, setImportRoomId] = useState('');
  const [importErrors, setImportErrors] = useState([]);
  const [importNotice, setImportNotice] = useState('');
  const [importing, setImporting] = useState(false);
  const query = (searchParams.get('search') || '').trim().toLowerCase();

  async function load() {
    const allocations = await listAllocations(admin ? undefined : 'section');
    setRows(allocations);
    if (admin) {
      const [faculty, subjects, batches, rooms] = await Promise.all([listFaculty(), listSubjects(), listBatches(), listRooms()]);
      setCatalog({ faculty, subjects, batches, rooms });
      setForm((f) => ({ ...f, facultyId: f.facultyId || faculty[0]?.id || '', subjectId: f.subjectId || subjects[0]?.id || '', batchId: f.batchId || batches[0]?.id || '', roomId: f.roomId || rooms[0]?.id || '' }));
      setImportRoomId((value) => value || rooms[0]?.id || '');
    }
  }
  useEffect(() => { load().catch((e) => setError(e.message)); }, []);

  async function submit(e) {
    e.preventDefault(); setError('');
    try { await createAllocation({ ...form, dayOfWeek: Number(form.dayOfWeek) }); await load(); }
    catch (e) { setError(e.message || 'Could not assign class'); }
  }

  async function remove(id) { await deleteAllocation(id); await load(); }
  async function analyzeFile() {
    setImportNotice('');
    if (!importFile) { setError('Choose the timetable CSV file first'); return; }
    if (!importBatchId) { setError('Select the class / section before analyzing the timetable'); return; }
    setError('');
    try {
      const text = await importFile.text();
      const { rows: parsed, errors } = parseTimetableCsv(text, { subjects: catalog.subjects, faculty: catalog.faculty });
      setPreview(parsed);
      setImportErrors(errors);
      if (parsed.length === 0 && errors.length === 0) setError('No classes were found in the file.');
    } catch {
      setError('Could not read that file. Upload a .csv file.');
    }
  }
  function downloadTemplate() {
    const url = URL.createObjectURL(new Blob([TIMETABLE_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'timetable-template.csv'; link.click();
    URL.revokeObjectURL(url);
  }
  async function importSchedule() {
    if (!importBatchId || !importRoomId || preview.length === 0) { setError('Choose the section and room, then analyze a file first'); return; }
    setImporting(true); setError(''); setImportNotice('');
    const failed = [];
    let created = 0;
    for (const row of preview) {
      try {
        await createAllocation({ facultyId: row.facultyId, subjectId: row.subjectId, batchId: importBatchId, roomId: importRoomId, dayOfWeek: row.dayOfWeek, startTime: row.startTime, endTime: row.endTime });
        created += 1;
      } catch (e) {
        failed.push(`Line ${row.line}: ${e.response?.data?.message || e.message || 'could not be created'}`);
      }
    }
    setImporting(false);
    setPreview([]); setImportFile(null); setImportErrors(failed.map((message) => ({ line: '', message })));
    setImportNotice(`${created} of ${created + failed.length} classes created.`);
    await load();
  }
  const field = (key, options) => <select value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-sm text-white">{options.map((x) => <option key={x.id} value={x.id}>{x.name || x.code}</option>)}</select>;
  const filteredRows = rows.filter((row) => !query || [DAYS[row.dayOfWeek - 1], row.startTime, row.endTime, row.faculty?.name, row.subject?.code, row.subject?.name, row.batch?.name, row.room?.name].filter(Boolean).join(' ').toLowerCase().includes(query));

  return <div className="flex min-h-screen bg-ink-950"><Sidebar /><main className="flex-1 min-w-0 pb-10"><TopBar connected />
    <div className="px-8 mt-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><CalendarDays className="text-signal-amber" /><div><h2 className="text-xl font-bold text-white">{admin ? 'Timetable Upload & Assignment' : 'My Assigned Timetable'}</h2><p className="text-sm text-slate-400">{admin ? 'Upload a timetable to automatically assign faculty sessions, or add a class manually' : 'Only these assigned classes can start attendance sessions'}</p></div></div>{admin && <button type="button" onClick={() => document.getElementById('timetable-import')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="flex items-center gap-2 rounded-lg bg-signal-blue px-4 py-2 text-sm font-semibold text-white"><FileUp size={16}/>Upload Timetable</button>}</div>
      {query && <p className="mb-4 rounded-lg border border-signal-blue/30 bg-signal-blue/10 px-3 py-2 text-xs text-signal-blue">Showing {filteredRows.length} matching timetable {filteredRows.length === 1 ? 'entry' : 'entries'} for “{searchParams.get('search')}”.</p>}
      {admin && <form onSubmit={submit} className="mb-6 grid grid-cols-2 xl:grid-cols-4 gap-3 rounded-2xl border border-ink-border bg-ink-850/60 p-5">
        {field('facultyId', catalog.faculty)}{field('subjectId', catalog.subjects)}{field('batchId', catalog.batches)}
        <select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })} className="rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-sm text-white">{DAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select>
        <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-white" />
        <input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} className="rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-white" />
        <button className="flex items-center justify-center gap-2 rounded-lg bg-signal-blue px-4 py-2 font-semibold text-white"><Plus size={16}/>Assign Class</button>
      </form>}
      {admin && <section id="timetable-import" className="mb-6 scroll-mt-4 rounded-2xl border border-signal-blue/30 bg-ink-850/60 p-5">
        <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><FileUp className="text-signal-blue"/><div><h3 className="font-bold text-white">Import Timetable (CSV)</h3><p className="text-xs text-slate-400">Columns: day, start, end, subjectCode, facultyEmail. Subjects and faculty must already exist.</p></div></div><button type="button" onClick={downloadTemplate} className="rounded-lg border border-ink-border px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-ink-900">Download template</button></div>
        <div className="grid gap-3 md:grid-cols-3">
          <input type="file" accept=".csv,text/csv" onChange={(e) => { setImportFile(e.target.files?.[0] || null); setPreview([]); setImportErrors([]); setImportNotice(''); }} className="rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-sm text-white" />
          <select required value={importBatchId} onChange={(e) => { setImportBatchId(e.target.value); setPreview([]); }} className="rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-sm text-white"><option value="">Select class / section</option>{catalog.batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          <select value={importRoomId} onChange={(e) => setImportRoomId(e.target.value)} className="rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-sm text-white">{catalog.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        </div>
        <button type="button" onClick={() => void analyzeFile()} className="mt-3 rounded-lg bg-signal-blue px-4 py-2 text-sm font-semibold text-white">Analyze Timetable</button>
        {importNotice && <p className="mt-3 text-sm font-semibold text-signal-green">{importNotice}</p>}
        {importErrors.length > 0 && <ul className="mt-3 space-y-1 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-xs text-red-200">{importErrors.map((item, index) => <li key={index}>{item.line ? `Line ${item.line}: ` : ''}{item.message}</li>)}</ul>}
        {!!preview.length && <div className="mt-5">
          <p className="mb-3 text-sm font-bold text-white">{preview.length} classes ready to create{importErrors.length ? ` · ${importErrors.length} line(s) skipped` : ''}</p>
          <div className="max-h-64 overflow-auto rounded-lg border border-ink-border"><table className="w-full text-left text-xs text-slate-300"><thead className="bg-ink-900 text-slate-400"><tr>{['Day','Time','Subject','Faculty'].map((x) => <th key={x} className="px-3 py-2">{x}</th>)}</tr></thead><tbody>{preview.map((row) => <tr key={row.line} className="border-t border-ink-border"><td className="px-3 py-2">{DAYS[row.dayOfWeek - 1]}</td><td className="px-3 py-2">{format12HourRange(row.startTime, row.endTime)}</td><td className="px-3 py-2">{row.subjectCode}</td><td className="px-3 py-2">{row.facultyName}</td></tr>)}</tbody></table></div>
          <button type="button" disabled={importing} onClick={() => void importSchedule()} className="mt-4 rounded-lg bg-signal-green px-4 py-2 text-sm font-bold text-ink-950 disabled:opacity-50">{importing ? 'Creating schedule...' : 'Confirm & Create Schedule'}</button>
        </div>}
      </section>}
      {error && <p className="mb-4 text-sm text-red-300">{error}</p>}
      {!admin && <section className="mb-6 rounded-2xl border border-ink-border bg-ink-850/60 p-5 shadow-card">
        <div className="mb-5"><h3 className="text-base font-bold text-white">Weekly Class Timetable</h3><p className="mt-1 text-xs text-slate-400">Full section schedule with all periods, breaks and lunch.</p></div>
        <div className="overflow-x-auto rounded-xl border border-ink-border"><table className="min-w-[1180px] w-full border-collapse text-center text-xs"><thead><tr className="bg-ink-900/70"><th className="border-r border-ink-border px-4 py-4 text-left text-slate-300">Day</th>{WEEK_SLOTS.map((slot, index) => <th key={`${slot.label}-${index}`} className={`border-r border-ink-border px-3 py-3 ${slot.break || slot.lunch ? 'bg-signal-blue/5 text-signal-blue' : 'text-slate-300'}`}><span className="block font-bold">{slot.label}</span><span className="mt-1 block text-[9px] font-normal text-slate-500">{slot.time || format12HourRange(slot.start, slot.end)}</span></th>)}</tr></thead><tbody>{DAYS.slice(0, 5).map((day, dayIndex) => <tr key={day} className="border-t border-ink-border"><th className="border-r border-ink-border bg-ink-900/45 px-4 py-5 text-left font-bold text-white">{day}</th>{WEEK_SLOTS.map((slot, slotIndex) => {
          if (slot.break || slot.lunch) return <td key={slotIndex} className="border-r border-ink-border bg-signal-blue/5 px-2 py-4 font-semibold uppercase tracking-wider text-signal-blue [writing-mode:vertical-rl]">{slot.label}</td>;
          const allocation = filteredRows.find((row) => row.dayOfWeek === dayIndex + 1 && row.startTime <= slot.start && row.endTime >= slot.end);
          return <td key={slotIndex} className="border-r border-ink-border px-2 py-3">{allocation ? <div className="rounded-lg border border-signal-blue/15 bg-signal-blue/5 p-2"><p className="font-bold text-white">{allocation.subject.code}</p><p className="mt-1 text-[9px] text-slate-400">{allocation.faculty.name}</p><p className="mt-1 text-[9px] font-semibold text-signal-blue">{allocation.batch.name}</p></div> : <span className="text-slate-700">—</span>}</td>;
        })}</tr>)}</tbody></table></div>{!rows.length && <p className="p-6 text-center text-sm text-slate-500">The full timetable will appear here after the administrator confirms the import.</p>}
      </section>}
      {admin && <div className="overflow-x-auto rounded-2xl border border-ink-border bg-ink-850/60"><table className="w-full text-sm"><thead className="bg-ink-900 text-slate-400"><tr>{['Day','Time','Faculty','Subject','Class / Section','Room',''].map((x) => <th key={x} className="px-4 py-3 text-left">{x}</th>)}</tr></thead><tbody>{filteredRows.map((r) => <tr key={r.id} className="border-t border-ink-border text-slate-200"><td className="px-4 py-3">{DAYS[r.dayOfWeek - 1]}</td><td className="px-4 py-3">{format12HourRange(r.startTime, r.endTime)}</td><td className="px-4 py-3">{r.faculty.name}</td><td className="px-4 py-3">{r.subject.code} · {r.subject.name}</td><td className="px-4 py-3">{r.batch.name}</td><td className="px-4 py-3">{r.room.name}</td><td><button onClick={() => remove(r.id)} className="text-red-400"><Trash2 size={16}/></button></td></tr>)}</tbody></table>{!rows.length && <p className="p-8 text-center text-slate-500">No class schedules assigned yet.</p>}{query && !filteredRows.length && <p className="p-8 text-center text-slate-500">No class schedules match your search.</p>}</div>}
    </div></main></div>;
}
