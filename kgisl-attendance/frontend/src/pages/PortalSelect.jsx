import { useEffect, useState } from 'react';
import { Sparkles, ShieldCheck, ScanLine } from 'lucide-react';
import AdminLogin from './AdminLogin.jsx';
import StudentLogin from './StudentLogin.jsx';

export default function PortalSelect() {
  const [isLoading, setIsLoading] = useState(() => !sessionStorage.getItem('hasSeenLoadingScreen'));
  const [portal, setPortal] = useState('STUDENT');

  useEffect(() => {
    if (!isLoading) return undefined;
    const timer = setTimeout(() => {
      setIsLoading(false);
      sessionStorage.setItem('hasSeenLoadingScreen', 'true');
    }, 2400);
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (isLoading) {
    return <div className="loading-reveal">
      <div className="loading-aura"/>
      <img src="/loading-logo.png" alt="KGiSL-IIM" className="loading-brand"/>
      <p>Smart Attendance</p>
    </div>;
  }

  return <main className="portal-shell">
    <div className="portal-grid" aria-hidden="true"/>
    <section className="portal-story">
      <div className="portal-brand-chip"><ScanLine size={16}/>KGiSL-IIM · MCA Department</div>
      <div className="portal-headline" aria-label="We Teach Kreate">
        <span>We</span><span>Teach</span><span>Kreate</span>
      </div>
      <p className="portal-copy">A secure, real-time attendance experience built for modern classrooms. Dynamic QR verification, precise geofencing and live academic insights work together in one seamless platform.</p>
      <div className="portal-trust"><span><ShieldCheck size={16}/>Secure by design</span><span><Sparkles size={16}/>Fast and seamless</span></div>
    </section>

    <section className="portal-panel-wrap">
      <div className="ethereal-shadow" aria-hidden="true"/>
      <div className="portal-panel">
        <div className="portal-panel-header"><div><p className="portal-eyebrow">Welcome back</p><h1>Select your portal</h1></div><img src="/custom-logo.png" alt="KGiSL-IIM"/></div>
        <div className="portal-toggle" role="tablist" aria-label="Choose portal">
          {['STUDENT', 'FACULTY', 'ADMIN'].map((item) => <button key={item} role="tab" aria-selected={portal === item} onClick={() => setPortal(item)} className={portal === item ? 'active' : ''}>{item[0] + item.slice(1).toLowerCase()}</button>)}
        </div>
        <div className="portal-perspective">
          <div className={`portal-flip ${portal === 'STUDENT' ? '' : 'flipped'}`}>
            <div className={`portal-face ${portal !== 'STUDENT' ? 'portal-inactive' : ''}`}><StudentLogin/></div>
            <div className={`portal-face portal-back ${portal === 'STUDENT' ? 'portal-inactive' : ''}`}><AdminLogin portal={portal}/></div>
          </div>
        </div>
      </div>
    </section>
    <footer>© {new Date().getFullYear()} KGiSL IIM. All rights reserved.</footer>
  </main>;
}
