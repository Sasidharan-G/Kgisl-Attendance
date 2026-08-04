import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, CheckCircle2, ClipboardCheck, GraduationCap, MapPin, ShieldCheck, UserRound, UserRoundCog } from 'lucide-react';
import AdminLogin from './AdminLogin.jsx';
import StudentLogin from './StudentLogin.jsx';

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
  const selectedPortal = portals.find((item) => item.id === portal);
  const [sessionNotice, setSessionNotice] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setShowEntrance(false), 900);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    const message = sessionStorage.getItem('kgisl_session_notice');
    if (!message) return;
    setSessionNotice(message);
    sessionStorage.removeItem('kgisl_session_notice');
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
    <main className={`calm-auth-shell ${showEntrance ? 'entrance-waiting' : 'entrance-ready'}`}>
      <section className="calm-auth-brand" aria-label="KGiSL IIM Smart Attendance">
        <div className="calm-brand-mark">
          <LoginBrandLockup />
        </div>

        <div className="notice-stats" aria-label="Attendance overview">
          <article><span className="notice-icon"><CalendarDays size={23}/></span><div><b>Today</b><i>On schedule</i></div><CheckCircle2 size={19}/></article>
          <article><span className="notice-icon"><BookOpen size={23}/></span><div><b>Classes</b><i>Ready to begin</i></div><CheckCircle2 size={19}/></article>
          <article><span className="notice-icon"><UserRound size={23}/></span><div><b>Present</b><i>Attendance desk</i></div><CheckCircle2 size={19}/></article>
        </div>
        <p className="calm-brand-footer">© {new Date().getFullYear()} KGiSL Institute of Information Management</p>
      </section>

      <section className="notice-board" aria-label="Attendance workspace overview">
        <div className="notice-timetable"><span>Time table</span><div><i>MON</i><i>TUE</i><i>WED</i><i>THU</i><i>FRI</i></div></div>
        <div className="notice-live-ticket"><span className="notice-qr" aria-hidden="true"/><div><b>Live class</b><small>10:20 AM · <em>Active</em></small></div></div>
        <div className="notice-streak"><strong>92%</strong><span>Attendance<br/>streak</span></div>
        <div className="notice-flow"><span><UserRound size={18}/><b>Check in</b></span><i/><span><CheckCircle2 size={18}/><b>Verified</b></span><i/><span><ClipboardCheck size={18}/><b>Recorded</b></span></div>
        <div className="notice-map"><MapPin size={25}/><span/><span/><span/><span/></div>
      </section>

      <section className="calm-auth-area" aria-label={`${portal.toLowerCase()} sign in`}>
        <div className={`calm-auth-card notice-login-card notice-login-${portal.toLowerCase()}`}>
          <header className="calm-card-header">
            <div>
              <p className="calm-card-kicker">Welcome to the portal</p>
              <h2>Sign in to your account</h2>
              <p>Select your role and enter your credentials.</p>
            </div>
            <div className="calm-mobile-logo"><LoginBrandLockup /></div>
          </header>

          <div className="calm-role-switch" role="tablist" aria-label="Choose your role">
            {portals.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={portal === id}
                className={portal === id ? 'active' : ''}
                onClick={() => setPortal(id)}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <div className="calm-role-context">
            <selectedPortal.Icon size={18} />
            <div><strong>{selectedPortal.label} access</strong><span>{selectedPortal.description}</span></div>
          </div>

          <div className="calm-login-stage">
            {sessionNotice && <div role="alert" className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-amber-300/45 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900"><span><b>Session expired.</b> {sessionNotice}</span><button type="button" onClick={() => setSessionNotice('')} className="font-bold" aria-label="Dismiss session message">×</button></div>}
            {portal === 'STUDENT'
              ? <StudentLogin active />
              : <AdminLogin key={portal} portal={portal} active />}
          </div>

          <p className="calm-security"><ShieldCheck size={14} /> Your connection is encrypted and protected</p>
          <p className="notice-login-footer">© {new Date().getFullYear()} KGiSL Institute of Information Management</p>
        </div>
        <p className="calm-help">Need help signing in? Contact your department administrator.</p>
      </section>
    </main>
    </>
  );
}
