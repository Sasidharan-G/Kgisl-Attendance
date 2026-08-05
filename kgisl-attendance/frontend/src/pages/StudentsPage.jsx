import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import { approveBatchArchive, bulkCreateStudents, createStudent, resetStudentDevice, retrieveBatch, setStudentActive, listBatches, listStudents } from '../services/api.js';
import { Search, GraduationCap, Plus, Power, Users, X, FileUp } from 'lucide-react';
import StatePanel from '../components/StatePanel.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const emptyForm = { name: '', rollNo: '', regNo: '', email: '', password: '', batchId: '' };

export default function StudentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkBatchId, setBulkBatchId] = useState('');
  const [view, setView] = useState('current');
  const [retrieveDates, setRetrieveDates] = useState({});

  async function load() {
      try {
        const [data, batchData] = await Promise.all([listStudents(undefined, view), listBatches()]);
        setStudents(data);
        setBatches(batchData);
      } catch (err) {
        setError(err.message || 'Failed to load students');
      } finally {
        setLoading(false);
      }
  }
  useEffect(() => { setLoading(true); load(); }, [view]);

  async function approveArchive(batch) {
    if (!window.confirm(`Move ${batch.name} students to the Passed Out Database? Attendance history will be preserved.`)) return;
    try { const result = await approveBatchArchive(batch.id); setSuccess(result.message); await load(); } catch (err) { setError(err.message || 'Could not archive batch'); }
  }
  async function restoreBatch(batch) {
    const completionDate = retrieveDates[batch.id];
    if (!completionDate) return;
    try { const result = await retrieveBatch(batch.id, new Date(`${completionDate}T23:59:59`).toISOString()); setSuccess(result.message); setView('current'); } catch (err) { setError(err.message || 'Could not retrieve batch'); }
  }

  const handleAddStudent = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.rollNo.trim() || !form.regNo.trim() || !/^\S+@\S+\.\S+$/.test(form.email) || form.password.length < 6 || !form.batchId) {
      setError('Complete every field with a valid email and a password of at least 6 characters.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const student = await createStudent(form);
      setStudents((current) => [...current, student]);
      setSelectedBatch(student.batchId);
      setForm(emptyForm);
      setShowAddForm(false);
      setSuccess(`${student.name} added to ${student.batchName}`);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to add student');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveStudent = async (student) => {
    const nextActive = !student.isActive;
    if (!window.confirm(`${nextActive ? 'Reactivate' : 'Deactivate'} ${student.name} (${student.rollNo})?`)) return;
    setError(''); setSuccess('');
    try {
      await setStudentActive(student.id, nextActive);
      setStudents((current) => current.map((item) => item.id === student.id ? { ...item, isActive: nextActive } : item));
      setSuccess(`${student.name} ${nextActive ? 'reactivated' : 'deactivated'} successfully.`);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to remove student');
    }
  };
  const handleDeviceReset = async (student) => {
    if (!window.confirm(`Reset device binding for ${student.name}? Their next verified classroom scan will bind the new phone.`)) return;
    try { const result = await resetStudentDevice(student.id); setSuccess(result.message); } catch (err) { setError(err.message || 'Could not reset device'); }
  };

  async function loadCsv(file) {
    setError(''); setSuccess(''); setBulkRows([]);
    if (!file) return;
    const text = await file.text();
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
    const headers = (lines.shift() || '').split(',').map((value) => value.trim().toLowerCase());
    const required = ['name', 'rollno', 'regno', 'email', 'password'];
    if (required.some((key) => !headers.includes(key))) { setError('CSV header must be: name,rollNo,regNo,email,password'); return; }
    const rows = lines.map((line) => {
      const values = line.split(',').map((value) => value.trim());
      return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
    });
    if (!rows.length) { setError('CSV does not contain any student rows'); return; }
    if (rows.some((row) => required.some((key) => !row[key]))) { setError('Every row needs name, rollNo, regNo, email and password'); return; }
    setBulkRows(rows);
  }

  async function importStudents() {
    if (!bulkBatchId) { setError('Select the section for this CSV first'); return; }
    setSaving(true); setError(''); setSuccess('');
    try {
      const result = await bulkCreateStudents({ batchId: bulkBatchId, students: bulkRows.map((row) => ({ name: row.name, rollNo: row.rollno, regNo: row.regno, email: row.email, password: row.password })) });
      const data = await listStudents(); setStudents(data); setSelectedBatch(bulkBatchId); setBulkRows([]);
      setSuccess(`${result.created} students imported into ${result.batchName}.`);
    } catch (err) { setError(err.response?.data?.message || err.message || 'Student import failed'); }
    finally { setSaving(false); }
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filtered = students.filter((s) =>
    (!selectedBatch || s.batchId === selectedBatch) &&
    (
      s.name.toLowerCase().includes(normalizedSearch) ||
      s.rollNo.toLowerCase().includes(normalizedSearch)
    )
  );

  return (
    <div className="flex min-h-screen bg-ink-950">
      <Sidebar />

      <main className="flex-1 min-w-0 pb-10">
        <TopBar connected={true} />

        <div className="px-8 mt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-signal-red/10 border border-signal-red/20 text-signal-red">
                <GraduationCap size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Student Directory</h2>
                <p className="text-sm text-slate-400">Total Registered: {students.length}</p>
              </div>
            </div>

            <div className="flex w-full max-w-xl gap-3">
              {!isAdmin && <button onClick={() => setShowAddForm((value) => !value)} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-signal-red px-4 py-2 text-sm font-bold text-white hover:brightness-110">
                {showAddForm ? <X size={16} /> : <Plus size={16} />}
                {showAddForm ? 'Cancel' : 'Add Student'}
              </button>}
              <div className="relative w-full">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-500">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or roll number..."
                className="w-full pl-10 pr-4 py-2 bg-ink-900 border border-ink-border rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-signal-red transition"
              />
              </div>
            </div>
          </div>

          {!isAdmin && showAddForm && (
            <form onSubmit={handleAddStudent} className="mb-6 rounded-2xl border border-ink-border bg-ink-850/60 p-5">
              <div className="mb-4">
                <h3 className="font-bold text-white">Add Student</h3>
                <p className="text-xs text-slate-400">Choose the section and enter the student's login details.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[
                  ['name', 'Student Name', 'text'],
                  ['rollNo', 'Roll Number', 'text'],
                  ['regNo', 'Register Number', 'text'],
                  ['email', 'College Email', 'email'],
                  ['password', 'Initial Password', 'text'],
                ].map(([key, label, type]) => (
                  <label key={key} className="text-xs font-semibold text-slate-400">
                    {label}
                    <input required type={type} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="mt-1.5 w-full rounded-xl border border-ink-border bg-ink-900 px-3 py-2.5 text-sm text-white outline-none focus:border-signal-red" />
                  </label>
                ))}
                <label className="text-xs font-semibold text-slate-400">
                  Section
                  <select required value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })} className="mt-1.5 w-full rounded-xl border border-ink-border bg-ink-900 px-3 py-2.5 text-sm text-white outline-none focus:border-signal-red">
                    <option value="">Select section</option>
                    {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
                  </select>
                </label>
              </div>
              <button disabled={saving} className="mt-5 rounded-xl bg-signal-red px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                {saving ? 'Adding...' : 'Add Student'}
              </button>
            </form>
          )}

          {!isAdmin && <section className="mb-6 rounded-2xl border border-signal-blue/25 bg-ink-850/60 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 font-bold text-white"><FileUp size={17} className="text-signal-blue"/>Bulk Student Import</h3><p className="mt-1 text-xs text-slate-400">Upload a CSV with <code>name,rollNo,regNo,email,password</code>. Review before creating accounts.</p></div>{bulkRows.length > 0 && <button disabled={saving} onClick={importStudents} className="rounded-xl bg-signal-blue px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Importing...' : `Import ${bulkRows.length} students`}</button>}</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2"><input type="file" accept=".csv,text/csv" onChange={(event) => loadCsv(event.target.files?.[0])} className="rounded-xl border border-ink-border bg-ink-900 px-3 py-2 text-sm text-slate-300"/><select value={bulkBatchId} onChange={(event) => setBulkBatchId(event.target.value)} className="rounded-xl border border-ink-border bg-ink-900 px-3 py-2 text-sm text-white"><option value="">Select section for import</option>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}</select></div>
            {bulkRows.length > 0 && <p className="mt-3 text-xs text-signal-green">{bulkRows.length} valid-looking rows ready. Duplicate roll/register/email values are checked again by the server.</p>}
          </section>}

          {isAdmin && <div className="mb-6 flex flex-wrap gap-3"><button onClick={() => setView('current')} className={`rounded-xl px-4 py-2 text-sm font-bold ${view === 'current' ? 'bg-signal-blue text-white' : 'border border-ink-border'}`}>Current Students</button><button onClick={() => setView('archived')} className={`rounded-xl px-4 py-2 text-sm font-bold ${view === 'archived' ? 'bg-signal-blue text-white' : 'border border-ink-border'}`}>Passed Out Database</button></div>}

          {isAdmin && view === 'current' && batches.some((batch) => batch.lifecycle === 'ARCHIVE_PENDING') && <section className="mb-6 rounded-2xl border border-signal-amber/40 bg-signal-amber/10 p-5"><h3 className="font-bold text-white">Archive permission requests</h3><p className="mt-1 text-xs text-slate-300">These batches reached their configured completion date. Review before moving students.</p><div className="mt-4 space-y-3">{batches.filter((batch) => batch.lifecycle === 'ARCHIVE_PENDING').map((batch) => <div key={batch.id} className="flex items-center justify-between rounded-xl border border-ink-border p-3"><div><b>{batch.name}</b><p className="text-xs">{batch._count?.students || 0} students · Mentor: {batch.mentor?.name || 'Unassigned'}</p></div><button onClick={() => approveArchive(batch)} className="rounded-lg bg-signal-amber px-3 py-2 text-xs font-bold text-black">Approve archive</button></div>)}</div></section>}

          {isAdmin && view === 'archived' && <section className="mb-6 rounded-2xl border border-ink-border bg-ink-850/60 p-5"><h3 className="font-bold text-white">Archived batches</h3><div className="mt-4 grid gap-3 md:grid-cols-2">{batches.filter((batch) => batch.lifecycle === 'ARCHIVED').map((batch) => <div key={batch.id} className="rounded-xl border border-ink-border p-4"><b>{batch.name}</b><p className="mt-1 text-xs">Passed out: {batch.archivedAt ? new Date(batch.archivedAt).toLocaleDateString() : '—'} · {batch._count?.students || 0} students</p><label className="mt-3 block text-xs">New completion date<input type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} value={retrieveDates[batch.id] || ''} onChange={(event) => setRetrieveDates((current) => ({ ...current, [batch.id]: event.target.value }))} className="mt-1 w-full rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-white"/></label><button disabled={!retrieveDates[batch.id]} onClick={() => restoreBatch(batch)} className="mt-3 rounded-lg bg-signal-blue px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Retrieve batch</button></div>)}</div></section>}

          {error && <div className="mb-6"><StatePanel type="error" compact title="Action needs attention" description={error} /></div>}
          {success && <div className="mb-6"><StatePanel type="success" compact title="Saved successfully" description={success} /></div>}

          <div className="mb-6">
            <div className="mb-3">
              <h3 className="text-base font-bold text-white">Batch Distribution</h3>
              <p className="text-xs text-slate-400">Active department batches currently configured under MCA</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {batches.map((batch) => {
                const count = students.filter((s) => s.batchId === batch.id).length;
                if ((view === 'current' && batch.lifecycle === 'ARCHIVED') || (view === 'archived' && batch.lifecycle !== 'ARCHIVED')) return null;
                const active = selectedBatch === batch.id;
                return <button key={batch.id} onClick={() => setSelectedBatch(active ? '' : batch.id)} className={`rounded-2xl border p-5 text-left transition ${active ? 'border-signal-blue bg-signal-blue/10 ring-2 ring-signal-blue/20' : 'border-ink-border bg-ink-850/60 hover:border-signal-blue/50'}`}>
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-signal-blue/10 text-signal-blue"><Users size={18}/></div>
                  <p className="font-bold text-white">{batch.name}</p>
                  <p className="mt-1 text-sm text-slate-400">{count} Students</p>
                </button>;
              })}
            </div>
            {selectedBatch && <button onClick={() => setSelectedBatch('')} className="mt-3 text-xs font-semibold text-signal-blue hover:underline">Show all batches</button>}
          </div>

          <div className="rounded-2xl border border-ink-border bg-ink-850/60 shadow-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-border bg-ink-900/40 text-slate-400 font-semibold">
                    <th className="px-6 py-4">Roll Number</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Batch</th>
                    <th className="px-6 py-4">Attended / Total</th>
                    <th className="px-6 py-4">Attendance %</th>
                    <th className="px-6 py-4">Last Active</th>
                    <th className="px-6 py-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-border/50">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8"><StatePanel type="loading" compact title="Loading student directory" description="Fetching registered students and attendance data." /></td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-8"><StatePanel type={search ? 'search' : 'empty'} compact title={search ? 'No search results' : 'No students in this view'} description={search ? `No student matches “${search}”. Try a name or roll number.` : 'Add a student or choose another section to see records.'} actionLabel={search ? 'Clear search' : undefined} onAction={search ? () => setSearch('') : undefined} /></td>
                    </tr>
                  ) : (
                    filtered.map((s) => (
                      <tr key={s.id} className="hover:bg-ink-800/30 transition-colors">
                        <td className="px-6 py-4 font-mono text-slate-300 font-semibold">{s.rollNo}</td>
                        <td className="px-6 py-4 text-white font-medium">{s.name}</td>
                        <td className="px-6 py-4 text-slate-400">{s.batchName}</td>
                        <td className="px-6 py-4 text-slate-400">
                          {s.attendedSessions} / {s.totalSessions}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              s.attendancePercentage >= 75
                                ? 'bg-signal-green/10 text-signal-green border border-signal-green/20'
                                : s.attendancePercentage >= 50
                                ? 'bg-signal-amber/10 text-signal-amber border border-signal-amber/20'
                                : 'bg-signal-red/10 text-signal-red border border-signal-red/20'
                            }`}
                          >
                            {s.attendancePercentage}%
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                          {s.lastScanTime ? new Date(s.lastScanTime).toLocaleString() : 'Never'}
                        </td>
                        <td className="px-6 py-4">{view === 'archived' ? <span className="text-xs font-semibold text-slate-400">Passed out</span> : <div className="flex gap-3"><button onClick={() => handleDeviceReset(s)} title="Reset device binding" className="text-signal-blue hover:text-blue-300 text-xs font-semibold">Device</button><button onClick={() => handleRemoveStudent(s)} title={s.isActive ? 'Deactivate student' : 'Reactivate student'} className={s.isActive ? 'text-red-400 hover:text-red-300' : 'text-signal-green hover:text-green-300'}><Power size={17}/></button></div>}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
