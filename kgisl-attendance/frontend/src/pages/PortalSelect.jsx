import { useEffect, useState } from 'react';
import { GraduationCap, ShieldCheck, UserRoundCog } from 'lucide-react';
import AdminLogin from './AdminLogin.jsx';
import StudentLogin from './StudentLogin.jsx';
import LiquidGlassFilter from '../components/LiquidGlassFilter.jsx';

const portals = [
  { id: 'STUDENT', label: 'Student', Icon: GraduationCap },
  { id: 'FACULTY', label: 'Faculty', Icon: UserRoundCog },
  { id: 'ADMIN', label: 'Admin', Icon: ShieldCheck },
];

export default function PortalSelect() {
  const [isLoading, setIsLoading] = useState(() => !sessionStorage.getItem('hasSeenLoadingScreen'));
  const [portal, setPortal] = useState('STUDENT');

  useEffect(() => {
    if (!isLoading) return undefined;
    const timer = setTimeout(() => {
      setIsLoading(false);
      sessionStorage.setItem('hasSeenLoadingScreen', 'true');
    }, 1400);
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (isLoading) {
    return <div className="water-loading">
      <div className="water-loading-glass" />
      <img src="/loading-logo.png" alt="KGiSL-IIM" />
      <p>Smart Attendance</p>
    </div>;
  }

  return <main className="water-portal">
    <LiquidGlassFilter />
    <div className="water-vignette" aria-hidden="true" />

    <section className="water-glass-dock" aria-label="KGiSL-IIM portal selection">
      <div className="water-logo-tile">
        <img src="/custom-logo.png" alt="KGiSL-IIM" />
      </div>
      <span className="water-dock-divider" aria-hidden="true" />
      <div className="water-role-switch" role="tablist" aria-label="Choose portal">
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
    </section>

    <section className="water-login-panel" aria-label={`${portal.toLowerCase()} sign in`}>
      <div className="liquid-glass-distortion" aria-hidden="true" />
      <div className="water-panel-light" aria-hidden="true" />
      <div className="water-panel-content">
        <p className="water-panel-kicker">KGiSL-IIM · Smart Attendance</p>
        <div className="water-login-stage">
          <div className={`water-login-flip ${portal === 'STUDENT' ? '' : 'flipped'}`}>
            <div className={`water-login-face ${portal !== 'STUDENT' ? 'inactive' : ''}`}>
              <StudentLogin active={portal === 'STUDENT'} />
            </div>
            <div className={`water-login-face water-login-back ${portal === 'STUDENT' ? 'inactive' : ''}`}>
              <AdminLogin portal={portal} active={portal !== 'STUDENT'} />
            </div>
          </div>
        </div>
        <p className="water-security"><ShieldCheck size={13} />Encrypted campus access</p>
      </div>
    </section>

    <footer>© {new Date().getFullYear()} KGiSL IIM</footer>
  </main>;
}
