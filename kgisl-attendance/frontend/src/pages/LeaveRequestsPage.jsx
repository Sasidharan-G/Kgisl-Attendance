import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarCheck, Check, X } from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { createLeaveRequest, listLeaveRequests, reviewLeaveRequest } from '../services/api.js';

export default function LeaveRequestsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ type: 'LEAVE', fromDate: '', toDate: '', reason: '' });
  const [message, setMessage] = useState('');
  const load = () => listLeaveRequests().then(setRequests).catch((err) => setMessage(err.message));
  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault(); setMessage('');
    try { await createLeaveRequest(form); setForm({ type: 'LEAVE', fromDate: '', toDate: '', reason: '' }); setMessage('Request submitted successfully.'); await load(); }
    catch (err) { setMessage(err.message || 'Could not submit request'); }
  };
  const review = async (request, status) => {
    const reviewNote = window.prompt(`${status === 'APPROVED' ? 'Approve' : 'Reject'} ${request.student.name}: enter review note`);
    if (!reviewNote) return;
    try { await reviewLeaveRequest(request.id, { status, reviewNote }); await load(); }
    catch (err) { setMessage(err.message || 'Could not review request'); }
  };

  const content = <main className="flex-1 min-w-0 pb-10"><TopBar connected={true}/><div className="mx-auto mt-6 max-w-6xl px-8">
    <div className="mb-6 flex items-center justify-between"><div><h2 className="flex items-center gap-2 text-xl font-bold text-white"><CalendarCheck className="text-signal-blue"/>Leave & On-Duty Requests</h2><p className="mt-1 text-sm text-slate-400">Submit and track approvals; approved dates update attendance records.</p></div>{user.role === 'STUDENT' && <button onClick={() => navigate('/student/attendance')} className="text-sm text-signal-blue">Back to attendance</button>}</div>
    {message && <p className="mb-5 rounded-xl border border-signal-blue/20 bg-signal-blue/10 p-3 text-sm text-slate-200">{message}</p>}
    {user.role === 'STUDENT' && <form onSubmit={submit} className="mb-6 grid gap-3 rounded-2xl border border-ink-border bg-ink-850/60 p-5 md:grid-cols-4"><select value={form.type} onChange={(e) => setForm({...form,type:e.target.value})} className="rounded-xl border border-ink-border bg-ink-900 p-3 text-white"><option value="LEAVE">Leave</option><option value="ON_DUTY">On Duty</option></select><input required type="date" value={form.fromDate} onChange={(e) => setForm({...form,fromDate:e.target.value})} className="rounded-xl border border-ink-border bg-ink-900 p-3 text-white"/><input required type="date" value={form.toDate} onChange={(e) => setForm({...form,toDate:e.target.value})} className="rounded-xl border border-ink-border bg-ink-900 p-3 text-white"/><input required minLength={5} placeholder="Reason" value={form.reason} onChange={(e) => setForm({...form,reason:e.target.value})} className="rounded-xl border border-ink-border bg-ink-900 p-3 text-white"/><button className="rounded-xl bg-signal-blue px-4 py-2 font-bold text-white md:col-span-4">Submit Request</button></form>}
    <div className="overflow-x-auto rounded-2xl border border-ink-border bg-ink-850/60"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="text-slate-400">{['Student','Type','Dates','Reason','Status','Review'].map((item)=><th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody>{requests.map((request)=><tr key={request.id} className="border-t border-ink-border"><td className="px-4 py-3 text-white">{request.student?.name || user.name}<br/><span className="text-xs text-slate-500">{request.student?.rollNo}</span></td><td className="px-4 py-3 text-slate-300">{request.type.replace('_',' ')}</td><td className="px-4 py-3 text-slate-400">{new Date(request.fromDate).toLocaleDateString()} – {new Date(request.toDate).toLocaleDateString()}</td><td className="px-4 py-3 text-slate-300">{request.reason}</td><td className="px-4 py-3 font-bold text-signal-blue">{request.status}</td><td className="px-4 py-3">{user.role !== 'STUDENT' && request.status === 'PENDING' ? <div className="flex gap-2"><button onClick={()=>review(request,'APPROVED')} className="text-signal-green"><Check/></button><button onClick={()=>review(request,'REJECTED')} className="text-signal-red"><X/></button></div> : <span className="text-xs text-slate-500">{request.reviewNote || '—'}</span>}</td></tr>)}</tbody></table>{!requests.length && <p className="p-8 text-center text-slate-500">No requests found.</p>}</div>
  </div></main>;
  return <div className="flex min-h-screen bg-ink-950">{user.role !== 'STUDENT' && <Sidebar/>}{content}</div>;
}
