import { useEffect, useState } from 'react';
import { Building2, GraduationCap, ShieldCheck, Sparkles, UserRoundCog } from 'lucide-react';
import AdminLogin from './AdminLogin.jsx';
import StudentLogin from './StudentLogin.jsx';

const portals = [
  { id: 'STUDENT', label: 'Student', description: 'Mark attendance and view records', Icon: GraduationCap },
  { id: 'FACULTY', label: 'Faculty', description: 'Manage classes and attendance', Icon: UserRoundCog },
  { id: 'ADMIN', label: 'Admin', description: 'Configure and monitor the portal', Icon: ShieldCheck },
];

export default function PortalSelect() {
  const [portal, setPortal] = useState('STUDENT');
  const [showEntrance, setShowEntrance] = useState(true);
  const selectedPortal = portals.find((item) => item.id === portal);

  useEffect(() => {
    const timer = setTimeout(() => setShowEntrance(false), 5200);
    return () => clearTimeout(timer);
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
            <img className="brand-entrance-wordmark" src="/entrance-wordmark.png" alt="KGiSL-IIM" />
          </div>
          <span className="brand-entrance-sweep" />
        </div>
        <p className="brand-entrance-caption">Smart attendance · secure campus</p>
        <button type="button" className="brand-entrance-skip" onClick={() => setShowEntrance(false)}>Skip intro</button>
      </section>
    )}
    <main className={`calm-auth-shell ${showEntrance ? 'entrance-waiting' : 'entrance-ready'}`}>
      <section className="calm-auth-brand" aria-label="KGiSL IIM Smart Attendance">
        <div className="calm-brand-mark">
          <img src="/custom-logo.png" alt="KGiSL-IIM" />
        </div>

        <div className="calm-brand-copy">
          <p className="calm-eyebrow"><Sparkles size={14} /> Smart campus experience</p>
          <h1>Attendance,<br />made effortless.</h1>
          <p className="calm-intro">
            A secure and reliable attendance workspace designed for the students,
            faculty and administrators of KGiSL Institute of Information Management.
          </p>
        </div>

        <div className="calm-trust-row">
          <span><ShieldCheck size={17} /> Secure access</span>
          <span><Building2 size={17} /> MCA Department</span>
        </div>
        <p className="calm-brand-footer">© {new Date().getFullYear()} KGiSL Institute of Information Management</p>
      </section>

      <section className="calm-auth-area" aria-label={`${portal.toLowerCase()} sign in`}>
        <div className="calm-auth-card">
          <header className="calm-card-header">
            <div>
              <p className="calm-card-kicker">Welcome to the portal</p>
              <h2>Sign in to your account</h2>
              <p>Select your role and enter your credentials.</p>
            </div>
            <div className="calm-mobile-logo"><img src="/custom-logo.png" alt="KGiSL-IIM" /></div>
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
            {portal === 'STUDENT'
              ? <StudentLogin active />
              : <AdminLogin key={portal} portal={portal} active />}
          </div>

          <p className="calm-security"><ShieldCheck size={14} /> Your connection is encrypted and protected</p>
        </div>
        <p className="calm-help">Need help signing in? Contact your department administrator.</p>
      </section>
    </main>
    </>
  );
}
