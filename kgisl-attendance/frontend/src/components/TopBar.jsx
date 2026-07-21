import { useEffect, useState } from 'react';
import { Wifi, MapPin, ShieldCheck, Search, Moon, Sun } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

function StatusPill({ icon: Icon, label, value, tone = 'green' }) {
  const toneClasses = {
    green: 'text-signal-green',
    blue: 'text-signal-blue',
  }[tone];

  return (
    <div className="app-status-pill flex items-center gap-2 rounded-xl px-3 py-1.5">
      <Icon size={15} className={toneClasses} />
      <div className="leading-tight">
        <p className="text-[10px] text-slate-500">{label}</p>
        <p className="text-xs font-semibold text-slate-700">{value}</p>
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
  '/admin/analytics': 'Attendance Reports',
  '/admin/academic': 'Academic Setup',
  '/admin/timetable': 'Upload Timetable',
  '/admin/students': 'Students',
  '/admin/faculty': 'Faculty',
  '/admin/leave': 'Leave / On Duty',
  '/faculty/leave': 'Leave / On Duty',
};

const SEARCH_PAGES = {
  ADMIN: [
    { label: 'Academic Setup', description: 'Manage batches and subjects', path: '/admin/academic' },
    { label: 'Upload Timetable', description: 'Create and view timetable entries', path: '/admin/timetable' },
    { label: 'Students', description: 'Search and manage students', path: '/admin/students' },
    { label: 'Faculty', description: 'Add and manage faculty', path: '/admin/faculty' },
    { label: 'Attendance Reports', description: 'View attendance analytics', path: '/admin/analytics' },
    { label: 'Leave / On Duty', description: 'Review leave requests', path: '/admin/leave' },
  ],
  FACULTY: [
    { label: 'Attendance', description: 'Start or manage an attendance session', path: '/faculty/dashboard' },
    { label: 'Dashboard', description: 'View attendance analytics', path: '/faculty/analytics' },
    { label: 'Courses', description: 'View assigned courses', path: '/faculty/courses' },
    { label: 'Timetable', description: 'View your class timetable', path: '/faculty/timetable' },
    { label: 'Settings', description: 'Manage workspace settings', path: '/faculty/settings' },
    { label: 'Logs', description: 'View system logs', path: '/faculty/logs' },
    { label: 'Leave / On Duty', description: 'Review leave requests', path: '/faculty/leave' },
  ],
};

export default function TopBar({ connected, sessionActive = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const title = TITLE_MAP[location.pathname] || 'Smart Attendance';
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('kgisl_workspace_theme') !== 'light');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const query = search.trim().toLowerCase();
  const results = query
    ? (SEARCH_PAGES[user?.role] || []).filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(query))
    : [];

  const goToResult = (path) => {
    navigate(path);
    setSearch('');
    setSearchOpen(false);
  };

  useEffect(() => {
    document.body.classList.toggle('workspace-dark', darkMode);
    localStorage.setItem('kgisl_workspace_theme', darkMode ? 'dark' : 'light');
    return () => document.body.classList.remove('workspace-dark');
  }, [darkMode]);

  return (
    <header className="app-topbar flex items-center justify-between gap-3 px-4 py-4 pl-16 sm:px-6 md:px-8 md:py-5 md:pl-8">
      <div>
        <h1 className="font-display text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        <p className="hidden text-sm text-slate-500 sm:block">Manage your academic workspace</p>
      </div>

      <div className="hidden items-center gap-3 sm:flex">
        <div className="relative hidden lg:block">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input
            type="search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => { if (event.key === 'Enter' && results[0]) goToResult(results[0].path); if (event.key === 'Escape') setSearchOpen(false); }}
            aria-label="Search workspace"
            placeholder="Search workspace"
            className="w-44 rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-500 xl:w-56"
          />
          {searchOpen && query && (
            <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
              {results.length ? results.map((item) => (
                <button key={item.path} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => goToResult(item.path)} className="block w-full px-4 py-3 text-left hover:bg-slate-50">
                  <span className="block text-sm font-semibold text-slate-800">{item.label}</span>
                  <span className="block text-xs text-slate-500">{item.description}</span>
                </button>
              )) : <p className="px-4 py-3 text-xs text-slate-500">No matching workspace results.</p>}
            </div>
          )}
        </div>
        <StatusPill icon={Wifi} label="Live Connection" value={connected ? 'Connected' : 'Offline'} tone={connected ? 'green' : 'blue'} />
        <StatusPill icon={MapPin} label="Geofence" value={sessionActive ? 'Enforced' : 'Standby'} tone={sessionActive ? 'green' : 'blue'} />
        <StatusPill
          icon={ShieldCheck}
          label="Session Security"
          value={connected ? 'Active' : 'Reconnecting…'}
          tone={connected ? 'green' : 'blue'}
        />
        <button
          type="button"
          onClick={() => setDarkMode((current) => !current)}
          className="app-theme-toggle grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          title={darkMode ? 'Light mode' : 'Dark mode'}
        >
          {darkMode ? <Sun size={17}/> : <Moon size={17}/>}
        </button>
      </div>
    </header>
  );
}

