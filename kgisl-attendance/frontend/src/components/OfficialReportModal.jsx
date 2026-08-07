import { useState } from 'react';
import { FileSpreadsheet, Printer, X, ShieldAlert, CheckCircle2, FileText, Download, Building } from 'lucide-react';

const MOCK_REPORT_STUDENTS = [
  { rollNo: '25MCA95', regNo: '711725MCA095', name: 'SASIDHARAN G R', total: 40, attended: 19, percentage: 48, shortage: true },
  { rollNo: '25MCA01', regNo: '711725MCA001', name: 'Aadhiran M', total: 40, attended: 36, percentage: 90, shortage: false },
  { rollNo: '25MCA12', regNo: '711725MCA012', name: 'Bhavani K', total: 40, attended: 34, percentage: 85, shortage: false },
  { rollNo: '25MCA20', regNo: '711725MCA020', name: 'Dinesh Kumar P', total: 40, attended: 26, percentage: 65, shortage: true },
  { rollNo: '25MCA31', regNo: '711725MCA031', name: 'Gokulakrishnan V', total: 40, attended: 38, percentage: 95, shortage: false },
  { rollNo: '25MCA44', regNo: '711725MCA044', name: 'Karthik S', total: 40, attended: 22, percentage: 55, shortage: true },
  { rollNo: '25MCA52', regNo: '711725MCA052', name: 'Madhavan R', total: 40, attended: 33, percentage: 82.5, shortage: false },
  { rollNo: '25MCA68', regNo: '711725MCA068', name: 'Naveen Kumar T', total: 40, attended: 37, percentage: 92.5, shortage: false },
  { rollNo: '25MCA75', regNo: '711725MCA075', name: 'Pooja S', total: 40, attended: 28, percentage: 70, shortage: true },
  { rollNo: '25MCA89', regNo: '711725MCA089', name: 'Rahul V', total: 40, attended: 35, percentage: 87.5, shortage: false },
];

export default function OfficialReportModal({ onClose, batchName = 'MCA-C', subjectCode = 'AIML' }) {
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' or 'DEFAULTERS'
  const todayDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const displayedStudents = MOCK_REPORT_STUDENTS.filter((s) => filterMode === 'ALL' || s.shortage);
  const defaulterCount = MOCK_REPORT_STUDENTS.filter((s) => s.shortage).length;

  const handlePrintPdf = () => {
    window.print();
  };

  const handleDownloadCsv = () => {
    const escape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['S.No', 'Roll No', 'Register No', 'Student Name', 'Total Sessions', 'Attended Sessions', 'Attendance %', 'Status'],
      ...displayedStudents.map((s, idx) => [
        idx + 1,
        s.rollNo,
        s.regNo,
        s.name,
        s.total,
        s.attended,
        `${s.percentage}%`,
        s.shortage ? 'SHORTAGE (< 75%)' : 'SAFE (>= 75%)',
      ]),
    ];

    const metadata = [
      `KGiSL INSTITUTE OF INFORMATION MANAGEMENT`,
      `OFFICIAL ATTENDANCE REPORT - ${todayDate}`,
      `Batch: ${batchName} | Subject: ${subjectCode}`,
      `Filter: ${filterMode === 'DEFAULTERS' ? 'Shortage Defaulters List (< 75%)' : 'Full Attendance Sheet'}`,
      ``,
    ];

    const csvContent = `\uFEFF${metadata.join('\n')}\n${rows.map((row) => row.map(escape).join(',')).join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Official_Attendance_${batchName}_${filterMode}_${todayDate.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl text-slate-100 overflow-hidden my-6">
        
        {/* Top Controls Bar (Hidden during Print) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950 px-6 py-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Official Attendance PDF / Excel Exporter</h2>
              <p className="text-xs text-slate-400">Formatted for A4 PDF export, HOD submission & Notice Board lists</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadCsv}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-900/80 transition"
            >
              <FileSpreadsheet size={15} /> Export Excel (.csv)
            </button>
            <button
              onClick={handlePrintPdf}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 transition shadow-lg shadow-blue-950"
            >
              <Printer size={15} /> Print / Save as PDF
            </button>
            <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter Switcher (Hidden during Print) */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 py-3 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Select Report Type:</span>
            <button
              onClick={() => setFilterMode('ALL')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${filterMode === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
            >
              Full Class Attendance Sheet ({MOCK_REPORT_STUDENTS.length})
            </button>
            <button
              onClick={() => setFilterMode('DEFAULTERS')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${filterMode === 'DEFAULTERS' ? 'bg-rose-600 text-white' : 'bg-rose-950/50 text-rose-300 border border-rose-500/30 hover:bg-rose-900'}`}
            >
              <ShieldAlert size={14} /> Shortage Defaulters List (&lt; 75%) ({defaulterCount})
            </button>
          </div>
          <span className="text-xs font-mono text-slate-400">Date: {todayDate}</span>
        </div>

        {/* PRINTABLE DOCUMENT CONTAINER */}
        <div className="p-8 bg-white text-slate-900 font-sans print:p-0 print:bg-white" id="printable-attendance-doc">
          
          {/* Official College Header */}
          <div className="border-b-2 border-slate-900 pb-4 text-center">
            <h1 className="text-xl font-black uppercase tracking-wider text-slate-950">KGiSL Institute of Information Management</h1>
            <p className="text-xs font-semibold text-slate-700">KG-Campus, Saravanampatti, Coimbatore - 641035 | Approved by AICTE, Affiliated to Bharathiar University</p>
            <p className="text-xs font-bold text-blue-900 mt-1">DEPARTMENT OF COMPUTER APPLICATIONS (MCA)</p>
          </div>

          {/* Document Title Banner */}
          <div className="my-4 flex items-center justify-between bg-slate-100 p-3 rounded-lg border border-slate-300">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-900">
                {filterMode === 'DEFAULTERS' ? '⚠️ OFFICIAL ATTENDANCE DEFAULTERS LIST (< 75%)' : '📋 OFFICIAL CLASS ACADEMIC ATTENDANCE REPORT'}
              </h2>
              <p className="text-xs text-slate-600">Batch: <span className="font-bold text-slate-900">{batchName}</span> | Subject Code: <span className="font-bold text-slate-900">{subjectCode}</span></p>
            </div>
            <div className="text-right text-xs">
              <p className="font-semibold text-slate-700">Date of Report: <span className="font-bold text-slate-900">{todayDate}</span></p>
              <p className="font-semibold text-slate-700">Total Enrolled: <span className="font-bold text-slate-900">{MOCK_REPORT_STUDENTS.length} Students</span></p>
            </div>
          </div>

          {/* Official Attendance Table */}
          <table className="w-full text-left text-xs border-collapse border border-slate-400">
            <thead>
              <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-400">
                <th className="p-2 border border-slate-400 text-center w-10">S.No</th>
                <th className="p-2 border border-slate-400">Roll No</th>
                <th className="p-2 border border-slate-400">Register No</th>
                <th className="p-2 border border-slate-400">Student Name</th>
                <th className="p-2 border border-slate-400 text-center">Total Sessions</th>
                <th className="p-2 border border-slate-400 text-center">Attended</th>
                <th className="p-2 border border-slate-400 text-center">Attendance %</th>
                <th className="p-2 border border-slate-400 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayedStudents.map((st, idx) => (
                <tr key={st.rollNo} className={`border-b border-slate-300 ${st.shortage ? 'bg-rose-50' : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="p-2 border border-slate-300 text-center font-mono">{idx + 1}</td>
                  <td className="p-2 border border-slate-300 font-mono font-bold text-slate-900">{st.rollNo}</td>
                  <td className="p-2 border border-slate-300 font-mono text-slate-700">{st.regNo}</td>
                  <td className="p-2 border border-slate-300 font-bold text-slate-900">{st.name}</td>
                  <td className="p-2 border border-slate-300 text-center font-mono">{st.total}</td>
                  <td className="p-2 border border-slate-300 text-center font-mono font-bold">{st.attended}</td>
                  <td className="p-2 border border-slate-300 text-center font-mono font-bold text-slate-950">{st.percentage}%</td>
                  <td className="p-2 border border-slate-300 text-center font-bold">
                    {st.shortage ? (
                      <span className="inline-block rounded bg-rose-200 px-2 py-0.5 text-[10px] text-rose-900 font-extrabold border border-rose-400">
                        SHORTAGE (&lt; 75%)
                      </span>
                    ) : (
                      <span className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-900 font-bold border border-emerald-300">
                        SAFE (75%+)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Official Summary & Signatures */}
          <div className="mt-8 grid grid-cols-2 gap-8 text-xs pt-4 border-t border-slate-300">
            <div>
              <p className="font-bold text-slate-900">Summary Statistics:</p>
              <ul className="mt-1 space-y-1 text-slate-700">
                <li>• Total Class Strength: <strong>{MOCK_REPORT_STUDENTS.length}</strong></li>
                <li>• Students Above 75% Criteria: <strong className="text-emerald-800">{MOCK_REPORT_STUDENTS.length - defaulterCount}</strong></li>
                <li>• Shortage Defaulters (&lt; 75%): <strong className="text-rose-800">{defaulterCount}</strong></li>
              </ul>
            </div>

            <div className="flex justify-between items-end pt-12 text-center text-slate-800 font-bold">
              <div>
                <p className="border-t border-slate-900 pt-1 px-4">Faculty In-Charge Signature</p>
              </div>
              <div>
                <p className="border-t border-slate-900 pt-1 px-4">Head of Department (HOD)</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
