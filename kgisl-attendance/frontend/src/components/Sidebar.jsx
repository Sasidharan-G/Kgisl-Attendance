import {
  ScanLine,
  LayoutGrid,
  Users,
  BookOpen,
  CalendarDays,
  BarChart3,
  Bell,
  Settings,
  FileClock,
  ChevronDown,
  UserPlus,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate, useLocation } from 'react-router-dom';

const FACULTY_NAV = [
  { icon: ScanLine, label: 'Attendance', path: '/faculty/dashboard' },
  { icon: LayoutGrid, label: 'Dashboard', path: '/faculty/analytics' },
  { icon: BookOpen, label: 'Courses', path: '/faculty/courses' },
  { icon: CalendarDays, label: 'Timetable', path: '/faculty/timetable' },
  { icon: Settings, label: 'Settings', path: '/faculty/settings' },
  { icon: FileClock, label: 'Logs', path: '/faculty/logs' },
  { icon: Bell, label: 'Leave / On Duty', path: '/faculty/leave' },
];
const ADMIN_NAV = [
  { icon: BookOpen, label: 'Academic Setup', path: '/admin/academic' },
  { icon: CalendarDays, label: 'Upload Timetable', path: '/admin/timetable' },
  { icon: Users, label: 'Students', path: '/admin/students' },
  { icon: UserPlus, label: 'Faculty', path: '/admin/faculty' },
  { icon: BarChart3, label: 'Attendance Reports', path: '/admin/analytics' },
  { icon: Bell, label: 'Leave / On Duty', path: '/admin/leave' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <><button onClick={() => setOpen(true)} className="app-menu-button fixed left-4 top-4 z-40 rounded-lg p-2 md:hidden"><Menu size={20}/></button>{open && <button aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-slate-950/35 backdrop-blur-sm md:hidden"/>}<aside className={`app-sidebar fixed inset-y-0 left-0 z-50 w-64 shrink-0 flex flex-col transition-transform md:sticky md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <button onClick={() => setOpen(false)} className="absolute right-3 top-3 p-2 text-slate-400 md:hidden"><X size={18}/></button>
      <div className="app-sidebar-brand px-5 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10">
            <ScanLine size={17} className="text-blue-200" />
          </div>
          <span className="font-display font-bold text-white tracking-tight">KGiSL-IIM</span>
        </div>
        <p className="mt-1 pl-11 text-[9px] tracking-[0.16em] text-slate-400 uppercase">MCA Department</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {(user?.role === 'ADMIN' ? ADMIN_NAV : FACULTY_NAV).map(({ icon: Icon, label, path, badge }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={label}
              onClick={() => { navigate(path); setOpen(false); }}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                isActive
                  ? 'app-nav-active text-white border border-white/10'
                  : 'text-slate-400 hover:bg-ink-850 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Icon size={17} className={isActive ? 'text-blue-200' : ''} />
              <span className="flex-1 text-left">{label}</span>
              {badge && (
                <span className="rounded-full bg-signal-red px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <button
        onClick={logout}
        className="app-profile m-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-signal-blue/20 text-signal-blue text-sm font-semibold">
          {user?.name?.charAt(0) ?? 'F'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-slate-200">{user?.name ?? 'Faculty'}</p>
          <p className="text-xs text-slate-500">{user?.role === 'ADMIN' ? 'Administrator' : 'Faculty'}</p>
        </div>
        <ChevronDown size={14} className="text-slate-500" />
      </button>
    </aside></>
  );
}

