import { Wifi, MapPin, ShieldCheck, Bell } from 'lucide-react';
import { useLocation } from 'react-router-dom';

function StatusPill({ icon: Icon, label, value, tone = 'green' }) {
  const toneClasses = {
    green: 'text-signal-green',
    blue: 'text-signal-blue',
  }[tone];

  return (
    <div className="flex items-center gap-2 rounded-lg border border-ink-border bg-ink-850/60 px-3 py-1.5">
      <Icon size={15} className={toneClasses} />
      <div className="leading-tight">
        <p className="text-[10px] text-slate-500">{label}</p>
        <p className={`text-xs font-medium ${toneClasses}`}>{value}</p>
      </div>
    </div>
  );
}

const TITLE_MAP = {
  '/faculty/dashboard': 'Attendance',
  '/faculty/analytics': 'Dashboard',
  '/faculty/students': 'Students Database',
  '/faculty/courses': 'Courses Catalog',
  '/faculty/timetable': 'Timetable',
  '/faculty/reports': 'Reports & Analytics',
  '/faculty/notifications': 'Notifications Hub',
  '/faculty/settings': 'System Settings',
  '/faculty/logs': 'System Logs',
  '/faculty/add-faculty': 'Add Faculty Management',
};

export default function TopBar({ connected, sessionActive = false }) {
  const location = useLocation();
  const title = TITLE_MAP[location.pathname] || 'Smart Attendance';

  return (
    <header className="flex items-center justify-between px-8 py-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">{title}</h1>
        <p className="text-sm text-slate-500">Smart. Secure. Seamless.</p>
      </div>

      <div className="flex items-center gap-3">
        <StatusPill icon={Wifi} label="Live Connection" value={connected ? 'Connected' : 'Offline'} tone={connected ? 'green' : 'blue'} />
        <StatusPill icon={MapPin} label="Geofence" value={sessionActive ? 'Enforced' : 'Standby'} tone={sessionActive ? 'green' : 'blue'} />
        <StatusPill
          icon={ShieldCheck}
          label="Session Security"
          value={connected ? 'Active' : 'Reconnecting…'}
          tone={connected ? 'green' : 'blue'}
        />
      </div>
    </header>
  );
}

