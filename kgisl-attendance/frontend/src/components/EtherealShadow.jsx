import { useId } from 'react';

export default function EtherealShadow() {
  const filterId = `ethereal-${useId().replace(/:/g, '')}`;
  return <div className="ethereal-card-bg" aria-hidden="true">
    <svg className="ethereal-svg" preserveAspectRatio="none" viewBox="0 0 500 800">
      <defs>
        <filter id={filterId} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.022" numOctaves="3" seed="7" result="noise">
            <animate attributeName="baseFrequency" dur="18s" values="0.008 0.022;0.014 0.012;0.008 0.022" repeatCount="indefinite"/>
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="86" xChannelSelector="R" yChannelSelector="B"/>
          <feGaussianBlur stdDeviation="16"/>
        </filter>
        <radialGradient id={`${filterId}-light`} cx="34%" cy="22%" r="88%">
          <stop offset="0" stopColor="#d4d4d8" stopOpacity=".95"/>
          <stop offset=".42" stopColor="#737373" stopOpacity=".8"/>
          <stop offset="1" stopColor="#171717" stopOpacity=".98"/>
        </radialGradient>
      </defs>
      <rect x="-80" y="-100" width="660" height="1000" fill={`url(#${filterId}-light)`} filter={`url(#${filterId})`}/>
    </svg>
    <div className="ethereal-grain"/>
  </div>;
}
