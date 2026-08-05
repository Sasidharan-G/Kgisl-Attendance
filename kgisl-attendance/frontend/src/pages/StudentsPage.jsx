import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import { createStudent, setStudentActive, listBatches, listStudents } from '../services/api.js';
import { Search, GraduationCap, Plus, Power, Users, X } from 'lucide-react';

const emptyForm = { name: '', rollNo: '', regNo: '', email: '', password: '', batchId: '' };

export default function StudentsPage() {
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

  useEffect(() => {
    (async () => {
      try {
        const [data, batchData] = await Promise.all([listStudents(), listBatches()]);
        setStudents(data);
        setBatches(batchData);
      } catch (err) {
        setError(err.message || 'Failed to load students');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleAddStudent = async (event) => {
    event.preventDefault();
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
              <button onClick={() => setShowAddForm((value) => !value)} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-signal-red px-4 py-2 text-sm font-bold text-white hover:brightness-110">
                {showAddForm ? <X size={16} /> : <Plus size={16} />}
                {showAddForm ? 'Cancel' : 'Add Student'}
              </button>
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

          {showAddForm && (
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

          {error && (
            <p className="rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-2.5 text-xs text-red-300 mb-6">
              {error}
            </p>
          )}
          {success && <p className="mb-6 rounded-lg border border-signal-green/30 bg-signal-green/10 px-4 py-2.5 text-xs text-signal-green">{success}</p>}

          <div className="mb-6">
            <div className="mb-3">
              <h3 className="text-base font-bold text-white">Batch Distribution</h3>
              <p className="text-xs text-slate-400">Active department batches currently configured under MCA</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {batches.map((batch) => {
                const count = students.filter((s) => s.batchId === batch.id).length;
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
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        Loading students data...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                        No students found.
                      </td>
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
                        <td className="px-6 py-4"><button onClick={() => handleRemoveStudent(s)} title={s.isActive ? 'Deactivate student' : 'Reactivate student'} className={s.isActive ? 'text-red-400 hover:text-red-300' : 'text-signal-green hover:text-green-300'}><Power size={17}/></button></td>
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
