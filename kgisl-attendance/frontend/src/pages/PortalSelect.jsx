import { useEffect, useState } from 'react';
import { GraduationCap, ShieldCheck, UserRoundCog } from 'lucide-react';
import AdminLogin from './AdminLogin.jsx';
import StudentLogin from './StudentLogin.jsx';

const portals = [
  { id: 'STUDENT', label: 'Student', description: 'Attendance, records and requests', Icon: GraduationCap },
  { id: 'FACULTY', label: 'Faculty', description: 'Classes, approvals and attendance', Icon: UserRoundCog },
  { id: 'ADMIN', label: 'Admin', description: 'Campus administration access', Icon: ShieldCheck },
];

function LoginBrandLockup() {
  return (
    <div className="lux-brand-lockup" aria-label="KGiSL-IIM — KGiSL Institute of Information Management">
      <img src="/entrance-emblem.png" alt="KGiSL-IIM emblem" />
      <div><strong>KGiSL-IIM</strong><span>Institute of Information Management</span></div>
    </div>
  );
}

export default function PortalSelect() {
  const [portal, setPortal] = useState('STUDENT');
  const [showEntrance, setShowEntrance] = useState(true);
  const [sessionNotice, setSessionNotice] = useState('');
  const selectedPortal = portals.find((item) => item.id === portal);

  useEffect(() => {
    // Restored to the original full intro timing; no short-cut auto-dismiss.
    const timer = setTimeout(() => setShowEntrance(false), 6800);
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
        <section className="brand-entrance" aria-label="KGiSL-IIM introduction" onClick={() => setShowEntrance(false)}>
          <div className="brand-entrance-aura" />
          <div className="brand-entrance-particles" />
          <div className="brand-entrance-lockup">
            <img className="brand-entrance-emblem" src="/entrance-emblem.png" alt="" />
            <div className="brand-entrance-wordmark-mask"><h2 className="brand-entrance-title">KGiSL-IIM</h2><p className="brand-entrance-institute">KGiSL Institute of Information Management</p></div>
            <div className="brand-entrance-speed-lines" aria-hidden="true"><i /><i /><i /></div>
            <span className="brand-entrance-sweep" />
          </div>
          <div className="brand-entrance-copy"><span className="brand-entrance-copy-line" aria-hidden="true" /><div><p>KGiSL Institute of Information Management</p><strong>Smart Attendance <b>·</b> Secure Campus</strong></div></div>
          <button type="button" className="brand-entrance-skip" onClick={() => setShowEntrance(false)}>Skip intro</button>
        </section>
      )}

      <main className={`lux-login-shell ${showEntrance ? 'entrance-waiting' : 'entrance-ready'}`}>
        <div className="lux-gold-halo lux-gold-halo-one" aria-hidden="true" />
        <div className="lux-gold-halo lux-gold-halo-two" aria-hidden="true" />
        <div className="lux-arch-lines" aria-hidden="true" />

        <section className="lux-login-layout">
          <div className="lux-login-intro"><LoginBrandLockup /><p className="lux-eyebrow">SMART ATTENDANCE SYSTEM</p><h1>One secure place<br />for every campus day.</h1><p className="lux-intro-copy">A refined attendance experience for students, faculty and campus administration.</p></div>

          <section className="lux-glass-card" aria-label={`${portal.toLowerCase()} sign in`}>
            <span className="lux-card-sheen" aria-hidden="true" />
            <header className="lux-card-header"><p>WELCOME BACK</p><h2>Sign in to continue</h2><span>Select your access portal below.</span></header>

            <div className="lux-role-switch" role="tablist" aria-label="Choose your role">
              {portals.map(({ id, label, Icon }) => <button key={id} type="button" role="tab" aria-selected={portal === id} className={portal === id ? 'active' : ''} onClick={() => setPortal(id)}><Icon size={16} /><span>{label}</span></button>)}
            </div>

            <div className="lux-role-context"><selectedPortal.Icon size={17} /><div><strong>{selectedPortal.label} portal</strong><span>{selectedPortal.description}</span></div></div>

            <div className="lux-login-stage">
              {sessionNotice && <div role="alert" className="lux-session-notice"><span><b>Session expired.</b> {sessionNotice}</span><button type="button" onClick={() => setSessionNotice('')} aria-label="Dismiss session message">×</button></div>}
              {portal === 'STUDENT' ? <StudentLogin active /> : <AdminLogin key={portal} portal={portal} active />}
            </div>
            <p className="lux-security"><ShieldCheck size={14} /> Encrypted and protected campus access</p>
          </section>
        </section>
        <p className="lux-footer">© {new Date().getFullYear()} KGiSL Institute of Information Management</p>
      </main>
    </>
  );
}
