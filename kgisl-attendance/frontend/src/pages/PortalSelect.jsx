import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLogin from './AdminLogin.jsx';
import StudentLogin from './StudentLogin.jsx';
import GeometricPattern from '../components/GeometricPattern.jsx';

export default function PortalSelect() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(() => {
    return !sessionStorage.getItem('hasSeenLoadingScreen');
  });
  const [portal, setPortal] = useState('STUDENT');

  useEffect(() => {
    if (!isLoading) return;

    const timer = setTimeout(() => {
      setIsLoading(false);
      sessionStorage.setItem('hasSeenLoadingScreen', 'true');
    }, 3000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  if (isLoading) {
    return (
      <div
        className="h-screen w-screen overflow-hidden flex items-center justify-center"
        style={{ backgroundColor: '#272465' }}
      >
        <style>{`
          @keyframes zoomInLogo {
            0% { transform: scale(0.5); }
            100% { transform: scale(1.5); }
          }
          @keyframes blinkLogo {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.1; }
          }
        `}</style>
        <img
          src="/loading-logo.png"
          alt="Loading..."
          style={{ animation: 'zoomInLogo 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards, blinkLogo 0.8s ease-in-out infinite' }}
          className="h-[150px] md:h-[250px] object-contain drop-shadow-2xl"
        />
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen overflow-hidden flex font-sans relative"
      style={{ backgroundColor: '#272465' }}
    >
      <GeometricPattern />

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>

      {/* Main Content Wrapper */}
      <div className="w-full h-full max-w-[1000px] lg:max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 lg:gap-32 px-4 relative pt-24 md:pt-0">
        
        {/* Mobile Logo */}
        <img
          src="/custom-logo.png"
          alt="Custom Logo"
          className="md:hidden absolute top-8 left-1/2 -translate-x-1/2 h-24 object-contain z-20 drop-shadow-xl"
        />

        {/* The Glassmorphic Card */}
        <div className="w-full max-w-[400px] bg-white/30 backdrop-blur-xl border border-white/50 rounded-[40px] overflow-hidden flex flex-col shadow-[0_20px_50px_rgba(31,38,135,0.15)] relative z-10 shrink-0">
          
          {/* Content Area */}
          <div className="px-6 pb-6 pt-10 flex flex-col items-center">
            <h2 className="text-xl font-display font-bold text-slate-900 mb-4 tracking-wide">Select Portal</h2>

            {/* Segmented Toggle for Admin/Student */}
            <div className="flex justify-center items-center mb-6 gap-2 text-xs font-bold tracking-widest uppercase bg-white/40 backdrop-blur-md shadow-inner p-1.5 rounded-full border border-white/50 w-full max-w-[280px]">
              <button 
                onClick={() => setPortal('STUDENT')}
                className={`flex-1 py-2.5 rounded-full transition-all duration-300 ${portal === 'STUDENT' ? 'bg-signal-blue text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Student
              </button>
              <button 
                onClick={() => setPortal('FACULTY')}
                className={`flex-1 py-2.5 rounded-full transition-all duration-300 ${portal === 'FACULTY' ? 'bg-signal-blue text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Faculty
              </button>
              <button onClick={() => setPortal('ADMIN')} className={`flex-1 py-2.5 rounded-full transition-all duration-300 ${portal === 'ADMIN' ? 'bg-signal-blue text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}>
                Admin
              </button>
            </div>

            {/* 3D Flip Card */}
            <div className="relative w-full flex-1 perspective-1000 min-h-[380px]">
              <div className={`w-full h-full transition-transform duration-700 ease-in-out preserve-3d grid ${portal === 'STUDENT' ? '' : 'rotate-y-180'}`}>
                
                {/* Front (Student) */}
                <div className={`row-start-1 col-start-1 w-full h-full backface-hidden flex justify-center ${portal !== 'STUDENT' ? 'pointer-events-none' : ''}`}>
                  <div className="w-full max-w-[320px]">
                    <StudentLogin />
                  </div>
                </div>

                {/* Back (Admin) */}
                <div className={`row-start-1 col-start-1 w-full h-full backface-hidden rotate-y-180 flex justify-center ${portal === 'STUDENT' ? 'pointer-events-none' : ''}`}>
                  <div className="w-full max-w-[320px]">
                    <AdminLogin portal={portal} />
                  </div>
                </div>

              </div>
            </div>
            
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-4 md:left-8 text-[10px] font-medium text-white/50 pointer-events-none z-0">
        © {new Date().getFullYear()} KGiSL IIM. All rights reserved.
      </div>
    </div>
  );
}
