import React, { useState, useEffect } from 'react';

export default function SplashScreen({ onComplete }) {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Start fading out after 2 seconds
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 2000);

    // Completely unmount after 2.5 seconds
    const completeTimer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 2500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#272465] transition-opacity duration-500 ease-in-out ${isFading ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
    >
      <style>
        {`
          @keyframes zoomBlink {
            0% { transform: scale(0.5); opacity: 0; filter: drop-shadow(0 0 0px rgba(255,255,255,0)); }
            20% { transform: scale(0.7); opacity: 1; filter: drop-shadow(0 0 20px rgba(255,255,255,0.8)); }
            40% { transform: scale(0.8); opacity: 0.2; filter: drop-shadow(0 0 5px rgba(255,255,255,0.2)); }
            60% { transform: scale(0.9); opacity: 1; filter: drop-shadow(0 0 30px rgba(255,255,255,1)); }
            80% { transform: scale(1.0); opacity: 0.3; filter: drop-shadow(0 0 10px rgba(255,255,255,0.3)); }
            100% { transform: scale(1.1); opacity: 1; filter: drop-shadow(0 0 40px rgba(255,255,255,0.6)); }
          }
          .animate-zoomBlink {
            animation: zoomBlink 2s ease-out forwards;
          }
        `}
      </style>

      <div className="relative flex flex-col items-center justify-center h-full w-full">
        {/* Animated Logo */}
        <img 
          src="/custom-logo.png" 
          alt="KGiSL Logo" 
          className="h-40 md:h-48 lg:h-56 object-contain animate-zoomBlink"
        />
      </div>
    </div>
  );
}
