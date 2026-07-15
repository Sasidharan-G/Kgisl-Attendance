import { useEffect, useState } from 'react';
import { CheckCircle2, MapPin, QrCode, ShieldCheck } from 'lucide-react';
import AdminLogin from './AdminLogin.jsx';
import StudentLogin from './StudentLogin.jsx';
import LiquidGlassFilter from '../components/LiquidGlassFilter.jsx';

const portals = ['STUDENT', 'FACULTY', 'ADMIN'];

export default function PortalSelect() {
  const [isLoading, setIsLoading] = useState(() => !sessionStorage.getItem('hasSeenLoadingScreen'));
  const [portal, setPortal] = useState('STUDENT');

  useEffect(() => {
    if (!isLoading) return undefined;
    const timer = setTimeout(() => {
      setIsLoading(false);
      sessionStorage.setItem('hasSeenLoadingScreen', 'true');
    }, 2200);
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (isLoading) {
    return <div className="apple-loading">
      <div className="apple-loading-orb"/>
      <img src="/loading-logo.png" alt="KGiSL-IIM"/>
      <p>Smart Attendance</p>
    </div>;
  }

  return <main className="apple-portal">
    <LiquidGlassFilter/>
    <div className="apple-mesh" aria-hidden="true"><i/><i/><i/></div>
    <div className="sea-waves" aria-hidden="true">
      <svg viewBox="0 0 1440 320" preserveAspectRatio="none"><path fill="rgba(255,255,255,.24)" d="M0,160L48,165.3C96,171,192,181,288,176C384,171,480,149,576,144C672,139,768,149,864,170.7C960,192,1056,224,1152,224C1248,224,1344,192,1392,176L1440,160L1440,320L0,320Z"/><path fill="rgba(255,255,255,.48)" d="M0,224L60,202.7C120,181,240,139,360,149.3C480,160,600,224,720,229.3C840,235,960,181,1080,170.7C1200,160,1320,192,1380,208L1440,224L1440,320L0,320Z"/><path fill="rgba(255,255,255,.88)" d="M0,256L80,245.3C160,235,320,213,480,218.7C640,224,800,256,960,261.3C1120,267,1280,245,1360,234.7L1440,224L1440,320L0,320Z"/></svg>
    </div>

    <section className="apple-brand">
      <img src="/custom-logo.png" alt="KGiSL-IIM" className="apple-logo"/>
      <p className="apple-kicker">KGiSL Institute of Information Management</p>
      <h1>Attendance,<br/><span>beautifully simple.</span></h1>
      <p className="apple-intro">A secure campus experience that combines live QR verification, precise geofencing and real-time academic insights.</p>
      <div className="apple-features">
        <span><QrCode/>Dynamic QR</span>
        <span><MapPin/>Campus verified</span>
        <span><ShieldCheck/>Secure by design</span>
      </div>
    </section>

    <section className="apple-login-wrap">
      <div className="apple-glass-card">
        <div className="liquid-glass-distortion" aria-hidden="true"/>
        <div className="apple-card-shine" aria-hidden="true"/>
        <div className="apple-card-brand"><img src="/custom-logo.png" alt=""/><div><strong>Smart Attendance</strong><span>Secure campus access</span></div><CheckCircle2/></div>

        <div className="apple-role-switch" role="tablist" aria-label="Choose portal">
          {portals.map((item) => <button key={item} role="tab" aria-selected={portal === item} onClick={() => setPortal(item)} className={portal === item ? 'active' : ''}>{item[0] + item.slice(1).toLowerCase()}</button>)}
        </div>

        <div className="apple-login-stage">
          <div className={`apple-login-flip ${portal === 'STUDENT' ? '' : 'flipped'}`}>
            <div className={`apple-login-face ${portal !== 'STUDENT' ? 'inactive' : ''}`}><StudentLogin active={portal === 'STUDENT'}/></div>
            <div className={`apple-login-face apple-login-back ${portal === 'STUDENT' ? 'inactive' : ''}`}><AdminLogin portal={portal} active={portal !== 'STUDENT'}/></div>
          </div>
        </div>

        <p className="apple-privacy"><ShieldCheck size={13}/>Your credentials are encrypted and protected.</p>
      </div>
    </section>

    <footer>© {new Date().getFullYear()} KGiSL IIM · Smart Attendance</footer>
  </main>;
}
