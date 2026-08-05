import { useEffect, useState } from 'react';
import { GraduationCap, ShieldCheck, UserRoundCog } from 'lucide-react';
import AdminLogin from './AdminLogin.jsx';
import StudentLogin from './StudentLogin.jsx';

const portals = [
  { id: 'STUDENT', label: 'Student', description: 'Attendance, records and requests', Icon: GraduationCap },
  { id: 'FACULTY', label: 'Faculty', description: 'Classes, approvals and attendance', Icon: UserRoundCog },
  { id: 'ADMIN', label: 'Admin', description: 'Campus administration access', Icon: ShieldCheck },
];

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

      <main className={`stitch-access-shell ${showEntrance ? 'entrance-waiting' : 'entrance-ready'}`}>
        <div className="stitch-liquid-light" aria-hidden="true" />
        <section className="stitch-access-sheet">
          <section className="stitch-access-welcome">
            <header><p>KGISL COMMAND</p><h1>Welcome</h1><span>Select your role to access the portal.</span></header>
            <div className="stitch-role-grid" role="tablist" aria-label="Choose your role">
              {portals.map(({ id, label, Icon }) => (
                <button key={id} type="button" role="tab" aria-selected={portal === id} className={portal === id ? 'active' : ''} onClick={() => setPortal(id)}>
                  <Icon size={21} /><span>{label}</span>
                </button>
              ))}
            </div>
            <div className="stitch-access-brand"><img src="/entrance-emblem.png" alt="" /><strong>KGISL<span>Attendance</span></strong></div>
          </section>

          <section className="stitch-signin-panel" aria-label={`${portal.toLowerCase()} sign in`}>
            <header><h2>Sign In</h2><p>{selectedPortal.label} access · {selectedPortal.description}</p></header>
            <div className="stitch-login-stage">
              {sessionNotice && <div role="alert" className="lux-session-notice"><span><b>Session expired.</b> {sessionNotice}</span><button type="button" onClick={() => setSessionNotice('')} aria-label="Dismiss session message">×</button></div>}
              {portal === 'STUDENT' ? <StudentLogin active /> : <AdminLogin key={portal} portal={portal} active />}
            </div>
            <p className="stitch-security"><ShieldCheck size={13} /> Secure institutional access</p>
          </section>
        </section>
        <p className="stitch-access-footer">© {new Date().getFullYear()} KGiSL Institute of Information Management</p>
      </main>
    </>
  );
}
