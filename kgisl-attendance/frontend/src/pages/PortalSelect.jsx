import { useEffect, useState } from 'react';
import { CheckCircle2, MapPin, QrCode, ShieldCheck } from 'lucide-react';
import AdminLogin from './AdminLogin.jsx';
import StudentLogin from './StudentLogin.jsx';

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
    <div className="apple-mesh" aria-hidden="true"><i/><i/><i/></div>

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
        <div className="apple-card-shine" aria-hidden="true"/>
        <div className="apple-card-brand"><img src="/custom-logo.png" alt=""/><div><strong>Smart Attendance</strong><span>Secure campus access</span></div><CheckCircle2/></div>

        <div className="apple-role-switch" role="tablist" aria-label="Choose portal">
          {portals.map((item) => <button key={item} role="tab" aria-selected={portal === item} onClick={() => setPortal(item)} className={portal === item ? 'active' : ''}>{item[0] + item.slice(1).toLowerCase()}</button>)}
        </div>

        <div className="apple-login-stage">
          <div className={`apple-login-flip ${portal === 'STUDENT' ? '' : 'flipped'}`}>
            <div className={`apple-login-face ${portal !== 'STUDENT' ? 'inactive' : ''}`}><StudentLogin/></div>
            <div className={`apple-login-face apple-login-back ${portal === 'STUDENT' ? 'inactive' : ''}`}><AdminLogin portal={portal}/></div>
          </div>
        </div>

        <p className="apple-privacy"><ShieldCheck size={13}/>Your credentials are encrypted and protected.</p>
      </div>
    </section>

    <footer>© {new Date().getFullYear()} KGiSL IIM · Smart Attendance</footer>
  </main>;
}
