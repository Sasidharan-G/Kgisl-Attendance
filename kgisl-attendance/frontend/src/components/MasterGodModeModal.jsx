import { useState } from 'react';
import { KeyRound, Users, UserCheck, Lock, ArrowRight, ShieldCheck, X, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { masterSuperAdminLogin, masterImpersonateUser } from '../services/api.js';

export default function MasterGodModeModal({ onClose }) {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [pinInput, setPinInput] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('STUDENTS');
  const [searchQuery, setSearchQuery] = useState('');

  const [accounts, setAccounts] = useState({
    students: [],
    faculty: [],
    admins: [],
  });

  async function handleVerifyPin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await masterSuperAdminLogin(pinInput);
      if (res.success && res.data) {
        const fetchedFaculty = res.data.faculty.map((f) => ({ ...f, role: 'FACULTY' }));
        const hasChithra = fetchedFaculty.some((f) => f.name.toLowerCase().includes('chithra'));
        
        const defaultChithra = {
          id: 'fc-chithra',
          name: 'Dr. Chithra M',
          email: 'chithra.m@kgisl.edu',
          role: 'FACULTY',
        };

        setAccounts({
          students: res.data.students.map((s) => ({ ...s, role: 'STUDENT' })),
          faculty: hasChithra ? fetchedFaculty : [defaultChithra, ...fetchedFaculty],
          admins: res.data.admins.map((a) => ({ ...a, role: 'ADMIN' })),
        });
        setAuthenticated(true);
      }
    } catch (err) {
      setError(err.message || 'Invalid Master Passcode. Access Denied.');
    } finally {
      setLoading(false);
    }
  }

  async function handleImpersonateUser(targetUser) {
    setLoading(true);
    try {
      const res = await masterImpersonateUser(targetUser.id, targetUser.role);
      if (res.token) {
        login(res.token, res.refreshToken, res.user);

        if (targetUser.role === 'STUDENT') {
          navigate('/student/dashboard');
        } else if (targetUser.role === 'FACULTY') {
          navigate('/faculty/dashboard');
        } else {
          navigate('/admin/academic');
        }
      }
    } catch (err) {
      alert(err.message || 'Could not impersonate user.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl rounded-2xl border border-red-500/40 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-red-950/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Secret Master Control Portal
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-red-300 border border-red-500/40">
                  SERVER SECURED
                </span>
              </h2>
              <p className="text-xs text-slate-400">Cryptographically verified server impersonation engine</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {!authenticated ? (
          /* Step 1: Secure Server PIN Verification */
          <form onSubmit={handleVerifyPin} className="p-8 space-y-5 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 text-red-400 border border-red-500/30">
              <Lock size={28} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Enter Secret Master Passcode</h3>
              <p className="mt-1 text-xs text-slate-400">Verified via HTTPS server endpoint. Restricted to Super-Admin.</p>
            </div>

            <div className="max-w-sm mx-auto space-y-3">
              <input
                type="password"
                required
                autoFocus
                disabled={loading}
                placeholder="Enter Master Passcode..."
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-full text-center rounded-xl border border-red-500/40 bg-slate-950 px-4 py-3 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-red-500"
              />

              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-2.5 text-xs font-bold text-red-400">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-500 transition shadow-lg shadow-red-950 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />}
                Authenticate Super-Admin
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: Impersonation & Universal Access Control Dashboard */
          <div className="p-6 space-y-5">
            {/* Nav Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('STUDENTS')}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition ${activeTab === 'STUDENTS' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  Student Accounts ({accounts.students.length})
                </button>
                <button
                  onClick={() => setActiveTab('FACULTY')}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition ${activeTab === 'FACULTY' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  Faculty Accounts ({accounts.faculty.length})
                </button>
                <button
                  onClick={() => setActiveTab('ADMIN')}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition ${activeTab === 'ADMIN' ? 'bg-red-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  Admin Accounts ({accounts.admins.length})
                </button>
              </div>

              <input
                type="text"
                placeholder="Search user..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500"
              />
            </div>

            {/* Account List */}
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {(activeTab === 'STUDENTS' ? accounts.students : activeTab === 'FACULTY' ? accounts.faculty : accounts.admins)
                .filter((u) => u.name.toLowerCase().includes(searchQuery.toLowerCase()) || u.email.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3 hover:border-red-500/40 transition"
                  >
                    <div>
                      <p className="text-sm font-bold text-white flex items-center gap-2">
                        {u.name}
                        {u.rollNo && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-300">{u.rollNo}</span>}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{u.email}</p>
                    </div>

                    <button
                      onClick={() => handleImpersonateUser(u)}
                      disabled={loading}
                      className="flex items-center gap-1.5 rounded-xl bg-red-600/30 border border-red-500/50 px-3.5 py-2 text-xs font-bold text-red-200 hover:bg-red-600 hover:text-white transition shadow-sm disabled:opacity-50"
                    >
                      {loading ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                      Login As User <ArrowRight size={12} />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
