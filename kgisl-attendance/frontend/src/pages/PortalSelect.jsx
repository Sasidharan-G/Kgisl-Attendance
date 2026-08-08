import { useEffect, useState } from 'react';
import { Building2, GraduationCap, ShieldCheck, Sparkles, UserRoundCog } from 'lucide-react';
import AdminLogin from './AdminLogin.jsx';
import StudentLogin from './StudentLogin.jsx';
import StatePanel from '../components/StatePanel.jsx';
import MasterGodModeModal from '../components/MasterGodModeModal.jsx';
import { GradientBackground } from '../components/ui/sign-up.jsx';

const portals = [
  { id: 'STUDENT', label: 'Student', description: 'Mark attendance and view records', Icon: GraduationCap },
  { id: 'FACULTY', label: 'Faculty', description: 'Manage classes and attendance', Icon: UserRoundCog },
  { id: 'ADMIN', label: 'Admin', description: 'Configure and monitor the portal', Icon: ShieldCheck },
];

function LoginBrandLockup() {
  return (
    <div className="login-brand-lockup" aria-label="KGiSL-IIM — KGiSL Institute of Information Management">
      <div className="login-brand-words">
        <strong>{Array.from('KGiSL-IIM').map((letter, index) => <span key={`${letter}-${index}`}>{letter}</span>)}</strong>
        <small>KGiSL Institute of Information Management</small>
      </div>
      <img src="/entrance-emblem.png" alt="" />
    </div>
  );
}

export default function PortalSelect() {
  const [portal, setPortal] = useState('STUDENT');
  const [showEntrance, setShowEntrance] = useState(true);
  const [sessionNotice, setSessionNotice] = useState(() => sessionStorage.getItem('kgisl_session_notice') || '');
  const [showMasterGodMode, setShowMasterGodMode] = useState(false);
  const selectedPortal = portals.find((item) => item.id === portal);

  useEffect(() => {
    if (sessionNotice) { sessionStorage.removeItem('kgisl_session_notice'); setShowEntrance(false); }
    const timer = setTimeout(() => setShowEntrance(false), 3600);
    return () => clearTimeout(timer);
  }, []);

  // Secret Keyboard Listener (Ctrl + Shift + K)
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'K' || e.key === 'k')) {
        e.preventDefault();
        setShowMasterGodMode((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
    {showEntrance && (
      <section className="brand-entrance" aria-label="KGiSL-IIM" onClick={() => setShowEntrance(false)}>
        <div className="brand-entrance-aura" />
        <div className="brand-entrance-particles" />
        <div className="brand-entrance-lockup">
          <img className="brand-entrance-emblem" src="/entrance-emblem.png" alt="" />
          <div className="brand-entrance-wordmark-mask">
            <h2 className="brand-entrance-title" aria-label="KGiSL-IIM">
              {Array.from('KGiSL-IIM').map((letter, index) => (
                <span key={`${letter}-${index}`} style={{ '--letter': index }}>{letter}</span>
              ))}
            </h2>
            <p className="brand-entrance-institute">KGiSL Institute of Information Management</p>
          </div>
          <div className="brand-entrance-speed-lines" aria-hidden="true"><i /><i /><i /></div>
          <span className="brand-entrance-sweep" />
        </div>
        <div className="brand-entrance-copy">
          <span className="brand-entrance-copy-line" aria-hidden="true" />
          <div>
            <p>KGiSL Institute of Information Management</p>
            <strong>Smart Attendance <b>&middot;</b> Secure Campus</strong>
          </div>
        </div>
        <button type="button" className="brand-entrance-skip" onClick={() => setShowEntrance(false)}>Skip intro</button>
      </section>
    )}

    {/* Dynamic Animated SVG Gradient Background */}
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden bg-slate-950">
      <GradientBackground />
    </div>

    <main className={`calm-auth-shell relative z-10 ${showEntrance ? 'entrance-waiting' : 'entrance-ready'}`}>
      {/* Left Side KGiSL Branding */}
      <section className="calm-auth-brand" aria-label="KGiSL IIM Smart Attendance">
        <div className="calm-brand-mark">
          <LoginBrandLockup />
        </div>

        <div className="calm-brand-copy">
          <p className="calm-eyebrow"><Sparkles size={14} /> Smart campus experience</p>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl text-white">Attendance,<br />made effortless.</h1>
          <p className="calm-intro text-slate-300">
            A secure and reliable attendance workspace designed for the students,
            faculty and administrators of KGiSL Institute of Information Management.
          </p>
        </div>

        <div className="calm-trust-row">
          <span className="bg-slate-900/60 border border-slate-800 backdrop-blur-md px-3 py-1.5 rounded-xl"><ShieldCheck size={17} /> Secure access</span>
          <span className="bg-slate-900/60 border border-slate-800 backdrop-blur-md px-3 py-1.5 rounded-xl"><Building2 size={17} /> MCA Department</span>
        </div>
        <p className="calm-brand-footer text-slate-400">© {new Date().getFullYear()} KGiSL Institute of Information Management</p>
      </section>

      {/* Right Side Glass Mirror Authentication Card */}
      <section className="calm-auth-area" aria-label={`${portal.toLowerCase()} sign in`}>
        <div className="calm-auth-card backdrop-blur-xl bg-slate-900/75 border border-slate-700/60 shadow-2xl rounded-3xl p-6 sm:p-8">
          <header className="calm-card-header mb-5">
            <div>
              <p className="calm-card-kicker text-blue-400 font-semibold text-xs tracking-wider uppercase">Welcome to the portal</p>
              <h2 className="text-2xl font-bold text-white mt-1">Sign in to your account</h2>
              <p className="text-xs text-slate-400 mt-1">Select your role and enter your credentials.</p>
            </div>
            <div className="calm-mobile-logo"><LoginBrandLockup /></div>
          </header>

          {sessionNotice && <div className="mb-4"><StatePanel type="permission" compact title="Session expired" description={sessionNotice} actionLabel="Dismiss" onAction={() => setSessionNotice('')} /></div>}

          {/* Role Switcher Tabs */}
          <div className="calm-role-switch mb-5 flex rounded-2xl bg-slate-950/80 p-1 border border-slate-800" role="tablist" aria-label="Choose your role">
            {portals.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={portal === id}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  portal === id
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
                onClick={() => setPortal(id)}
              >
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="calm-role-context mb-4 flex items-center gap-2 rounded-xl bg-slate-950/40 p-2.5 border border-slate-800/60 text-xs text-slate-300">
            <selectedPortal.Icon size={16} className="text-blue-400 shrink-0" />
            <div><strong className="text-slate-100">{selectedPortal.label} Access</strong> — <span>{selectedPortal.description}</span></div>
          </div>

          {/* Login Input Forms */}
          <div className="calm-login-stage">
            {portal === 'STUDENT'
              ? <StudentLogin active />
              : <AdminLogin key={portal} portal={portal} active />}
          </div>

          <p className="calm-security mt-5 flex items-center justify-center gap-1.5 text-[11px] text-slate-400"><ShieldCheck size={14} className="text-emerald-400" /> Your connection is encrypted & protected</p>
        </div>
        <p className="calm-help mt-3 text-center text-xs text-slate-400">Need help signing in? Contact your department administrator.</p>
      </section>
    </main>

    {/* Secret Master God-Mode Portal Modal */}
    {showMasterGodMode && (
      <MasterGodModeModal onClose={() => setShowMasterGodMode(false)} />
    )}
    </>
  );
}
