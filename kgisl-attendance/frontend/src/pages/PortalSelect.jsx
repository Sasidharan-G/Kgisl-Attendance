import { useEffect, useState } from 'react';
import AdminLogin from './AdminLogin.jsx';
import StudentLogin from './StudentLogin.jsx';
import EtherealShadow from '../components/EtherealShadow.jsx';

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
      <div className="portal-headline" aria-label="We Teach Kreate">
        <span className="portal-we">We</span><span className="portal-words"><span>Teach</span><span>Kreate</span></span>
      </div>
      <p className="portal-copy">KGiSL Institute of Information Management (KGiSL-IIM) is a premier industry-sponsored institution in Coimbatore. Affiliated with Bharathiar University and AICTE approved, we follow an industry-integrated education model that provides strong practical exposure alongside academic learning.</p>
    </section>

    <section className="portal-panel-wrap">
      <div className="portal-panel">
        <EtherealShadow/>
        <div className="portal-toggle" role="tablist" aria-label="Choose portal">
          {['STUDENT', 'ADMIN'].map((item) => <button key={item} role="tab" aria-selected={portal === item} onClick={() => setPortal(item)} className={portal === item ? 'active' : ''}>{item[0] + item.slice(1).toLowerCase()}</button>)}
        </div>
        <div className="portal-perspective">
          <div className={`portal-flip ${portal === 'STUDENT' ? '' : 'flipped'}`}>
            <div className={`portal-face ${portal !== 'STUDENT' ? 'portal-inactive' : ''}`}><StudentLogin/></div>
            <div className={`portal-face portal-back ${portal === 'STUDENT' ? 'portal-inactive' : ''}`}><AdminLogin portal={portal}/></div>
          </div>
        </div>
        <button type="button" onClick={() => setPortal('FACULTY')} className={`faculty-entry ${portal === 'FACULTY' ? 'active' : ''}`}>{portal === 'FACULTY' ? 'Faculty portal selected' : 'Faculty sign in'}</button>
      </div>
    </section>
    <footer>© {new Date().getFullYear()} KGiSL IIM. All rights reserved.</footer>
  </main>;
}
