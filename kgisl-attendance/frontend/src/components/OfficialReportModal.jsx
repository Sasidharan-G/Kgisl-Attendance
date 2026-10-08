import { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Printer, X, ShieldAlert, FileText, Loader2 } from 'lucide-react';
import { getAttendanceReport, listBatches, listSubjects } from '../services/api.js';

/**
 * Official cumulative attendance report built from live session data:
 * attended = PRESENT / LATE / ON_DUTY sessions of ended sessions, shortage below 75 %.
 */
export default function OfficialReportModal({ onClose }) {
  const [batches, setBatches] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [batchId, setBatchId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' or 'DEFAULTERS'
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const todayDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  useEffect(() => {
    let cancelled = false;
    Promise.all([listBatches(), listSubjects()])
      .then(([batchRows, subjectRows]) => {
        if (cancelled) return;
        setBatches(batchRows);
        setSubjects(subjectRows);
        if (batchRows.length > 0) setBatchId(batchRows[0].id);
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'Could not load sections.'); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!batchId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    getAttendanceReport({ batchId, ...(subjectId ? { subjectId } : {}) })
      .then((data) => { if (!cancelled) setReport(data); })
      .catch((err) => { if (!cancelled) { setReport(null); setError(err.message || 'Could not load the attendance report.'); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [batchId, subjectId]);

  const students = report?.students ?? [];
  const defaulterCount = useMemo(() => students.filter((s) => s.shortage).length, [students]);
  const displayedStudents = useMemo(() => students.filter((s) => filterMode === 'ALL' || s.shortage), [students, filterMode]);
  const subjectLabel = report?.subjectCode ? `${report.subjectCode} - ${report.subjectName}` : 'All subjects';

  const handleDownloadCsv = () => {
    if (!report) return;
    const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['S.No', 'Roll No', 'Register No', 'Student Name', 'Total Sessions', 'Attended Sessions', 'Attendance %', 'Status'],
      ...displayedStudents.map((s, idx) => [idx + 1, s.rollNo, s.regNo, s.name, s.total, s.attended, `${s.percentage}%`, s.shortage ? 'SHORTAGE (< 75%)' : 'SAFE (>= 75%)']),
    ];
    const metadata = [
      'KGiSL-IIM OFFICIAL ATTENDANCE REPORT',
      `Generated: ${todayDate}`,
      `Section: ${report.batchName} | Subject: ${subjectLabel} | Sessions held: ${report.totalSessions}`,
      `Filter: ${filterMode === 'DEFAULTERS' ? 'Shortage Defaulters List (< 75%)' : 'Full Attendance Sheet'}`,
      '',
    ];
    const csvContent = `﻿${metadata.join('\n')}\n${rows.map((row) => row.map(escape).join(',')).join('\n')}`;
    const url = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_${report.batchName}_${report.subjectCode ?? 'ALL'}_${filterMode}_${todayDate.replace(/\s+/g, '_')}.csv`.replace(/\s+/g, '-');
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectClass = 'rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-100';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl text-slate-100 overflow-hidden my-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-6 py-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400"><FileText size={20} /></div>
            <div>
              <h2 className="text-base font-bold text-white">Official Attendance Report</h2>
              <p className="text-xs text-slate-400">Live data · A4 PDF, Excel and defaulters list</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDownloadCsv} disabled={!report || students.length === 0} className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-3.5 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-900/80 disabled:opacity-40">
              <FileSpreadsheet size={15} /> Export Excel (.csv)
            </button>
            <button onClick={() => window.print()} disabled={!report || students.length === 0} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-950 transition hover:bg-blue-500 disabled:opacity-40">
              <Printer size={15} /> Print / Save as PDF
            </button>
            <button onClick={onClose} aria-label="Close report" className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={18} /></button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-900/80 px-6 py-3 print:hidden">
          <label className="flex items-center gap-2 text-xs text-slate-400">Section
            <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className={selectClass}>
              {batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.name}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-400">Subject
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} className={selectClass}>
              <option value="">All subjects</option>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} - {subject.name}</option>)}
            </select>
          </label>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setFilterMode('ALL')} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${filterMode === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}>
              Full sheet ({students.length})
            </button>
            <button onClick={() => setFilterMode('DEFAULTERS')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${filterMode === 'DEFAULTERS' ? 'bg-rose-600 text-white' : 'bg-rose-950/50 text-rose-300 hover:bg-rose-900/60'}`}>
              <ShieldAlert size={14} /> Shortage &lt; 75% ({defaulterCount})
            </button>
          </div>
        </div>

        {error && <p className="m-6 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300 print:hidden">{error}</p>}
        {loading && <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-400 print:hidden"><Loader2 size={16} className="animate-spin" />Loading live attendance…</div>}

        {!loading && report && (
          <div className="bg-white p-8 font-sans text-slate-900 print:p-0" id="printable-attendance-doc">
            <div className="border-b-2 border-slate-900 pb-4 text-center">
              <h1 className="text-xl font-black uppercase tracking-wider text-slate-950">KGiSL Institute of Information Management</h1>
              <p className="mt-1 text-xs font-bold text-blue-900">DEPARTMENT OF COMPUTER APPLICATIONS (MCA)</p>
            </div>

            <div className="my-4 flex items-center justify-between rounded-lg border border-slate-300 bg-slate-100 p-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                  {filterMode === 'DEFAULTERS' ? 'Official attendance defaulters list (< 75%)' : 'Official class attendance report'}
                </h2>
                <p className="text-xs text-slate-600">Section: <b className="text-slate-900">{report.batchName}</b> | Subject: <b className="text-slate-900">{subjectLabel}</b> | Sessions held: <b className="text-slate-900">{report.totalSessions}</b></p>
              </div>
              <div className="text-right text-xs">
                <p className="font-semibold text-slate-700">Date of report: <b className="text-slate-900">{todayDate}</b></p>
                <p className="font-semibold text-slate-700">Total enrolled: <b className="text-slate-900">{students.length} students</b></p>
              </div>
            </div>

            {displayedStudents.length === 0 ? (
              <p className="border border-slate-300 p-6 text-center text-sm text-slate-600">
                {students.length === 0 ? 'No active students are enrolled in this section.' : 'No students are below the 75% criteria.'}
              </p>
            ) : (
              <table className="w-full border-collapse border border-slate-400 text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-400 bg-slate-200 font-bold text-slate-950">
                    <th className="w-10 border border-slate-400 p-2 text-center">S.No</th>
                    <th className="border border-slate-400 p-2">Roll No</th>
                    <th className="border border-slate-400 p-2">Register No</th>
                    <th className="border border-slate-400 p-2">Student Name</th>
                    <th className="border border-slate-400 p-2 text-center">Sessions</th>
                    <th className="border border-slate-400 p-2 text-center">Attended</th>
                    <th className="border border-slate-400 p-2 text-center">Attendance %</th>
                    <th className="border border-slate-400 p-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedStudents.map((st, idx) => (
                    <tr key={st.rollNo} className={`border-b border-slate-300 ${st.shortage ? 'bg-red-50 text-red-900' : idx % 2 === 0 ? 'bg-white text-slate-900' : 'bg-slate-50 text-slate-900'}`}>
                      <td className="border border-slate-300 p-2 text-center font-mono">{idx + 1}</td>
                      <td className="border border-slate-300 p-2 font-mono font-bold">{st.rollNo}</td>
                      <td className="border border-slate-300 p-2 font-mono">{st.regNo}</td>
                      <td className="border border-slate-300 p-2 font-bold">{st.name}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono">{st.total}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono font-bold">{st.attended}</td>
                      <td className="border border-slate-300 p-2 text-center font-mono font-bold">{st.percentage}%</td>
                      <td className="border border-slate-300 p-2 text-center font-bold">
                        {st.shortage
                          ? <span className="inline-block rounded border border-red-400 bg-red-100 px-2 py-0.5 text-[10px] font-extrabold text-red-700">SHORTAGE (&lt; 75%)</span>
                          : <span className="inline-block rounded border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">SAFE (75%+)</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="mt-8 grid grid-cols-2 gap-8 border-t border-slate-300 pt-4 text-xs">
              <div>
                <p className="font-bold text-slate-900">Summary</p>
                <ul className="mt-1 space-y-1 text-slate-700">
                  <li>• Class strength: <strong>{students.length}</strong></li>
                  <li>• At or above 75%: <strong className="text-emerald-800">{students.length - defaulterCount}</strong></li>
                  <li>• Shortage (&lt; 75%): <strong className="text-rose-800">{defaulterCount}</strong></li>
                </ul>
                <p className="mt-2 text-[10px] text-slate-500">Attended = Present, Late or On-Duty in ended sessions.</p>
              </div>
              <div className="flex items-end justify-between pt-12 text-center font-bold text-slate-800">
                <p className="border-t border-slate-900 px-4 pt-1">Faculty In-Charge Signature</p>
                <p className="border-t border-slate-900 px-4 pt-1">Head of Department (HOD)</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
