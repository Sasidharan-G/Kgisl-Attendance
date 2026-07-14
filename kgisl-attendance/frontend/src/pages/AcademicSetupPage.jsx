import { useEffect, useState } from 'react';
import { BookOpen, Pencil, Plus, Save, X } from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import { createBatch, listBatches, updateBatch } from '../services/api.js';

const empty = { name: '', department: 'Computer Applications', programme: 'MCA', semester: 1, academicYear: '2026-2027' };

export default function AcademicSetupPage() {
  const [batches, setBatches] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const load = () => listBatches().then(setBatches).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, semester: Number(form.semester) };
      if (editing) await updateBatch(editing, payload); else await createBatch(payload);
      setForm(empty); setEditing(''); await load();
    } catch (e) { setError(e.message || 'Could not save academic section'); }
    finally { setSaving(false); }
  }
  function edit(row) { setEditing(row.id); setForm({ name: row.name, department: row.department, programme: row.programme, semester: row.semester, academicYear: row.academicYear }); }
  const field = (key, label, props = {}) => <label className="space-y-1 text-xs text-slate-400"><span>{label}</span><input required value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-full rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-sm text-white" {...props}/></label>;

  return <div className="flex min-h-screen bg-ink-950"><Sidebar/><main className="min-w-0 flex-1 pb-10"><TopBar connected/><div className="mx-auto mt-6 max-w-6xl px-6">
    <div className="mb-6 flex items-center gap-3"><BookOpen className="text-signal-blue"/><div><h1 className="text-xl font-bold text-white">Academic Setup</h1><p className="text-sm text-slate-400">Department, programme, semester, academic year and class sections</p></div></div>
    {error && <p className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    <form onSubmit={submit} className="mb-6 grid gap-3 rounded-2xl border border-ink-border bg-ink-850/60 p-5 md:grid-cols-3">
      {field('name', 'Class / Section name', { placeholder: 'MCA - II Year A' })}{field('department', 'Department')}{field('programme', 'Programme')}{field('semester', 'Semester', { type: 'number', min: 1, max: 12 })}{field('academicYear', 'Academic year', { pattern: '\\d{4}-\\d{4}', placeholder: '2026-2027' })}
      <div className="flex items-end gap-2"><button disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-signal-blue px-4 py-2 font-semibold text-white disabled:opacity-50">{editing ? <Save size={16}/> : <Plus size={16}/>} {saving ? 'Saving...' : editing ? 'Update section' : 'Add section'}</button>{editing && <button type="button" onClick={() => { setEditing(''); setForm(empty); }} className="rounded-lg border border-ink-border p-2.5 text-slate-300"><X size={16}/></button>}</div>
    </form>
    <div className="overflow-x-auto rounded-2xl border border-ink-border"><table className="w-full text-left text-sm"><thead className="bg-ink-850 text-xs uppercase text-slate-500"><tr><th className="p-4">Section</th><th className="p-4">Department</th><th className="p-4">Programme</th><th className="p-4">Semester</th><th className="p-4">Academic year</th><th className="p-4"></th></tr></thead><tbody className="divide-y divide-ink-border bg-ink-900/60">{batches.map((row) => <tr key={row.id} className="text-slate-300"><td className="p-4 font-semibold text-white">{row.name}</td><td className="p-4">{row.department}</td><td className="p-4">{row.programme}</td><td className="p-4">{row.semester}</td><td className="p-4">{row.academicYear}</td><td className="p-4"><button onClick={() => edit(row)} className="rounded-lg border border-ink-border p-2 hover:text-white" aria-label={`Edit ${row.name}`}><Pencil size={15}/></button></td></tr>)}</tbody></table></div>
  </div></main></div>;
}
