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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate, useLocation } from 'react-router-dom';

const FACULTY_NAV = [
  { icon: ScanLine, label: 'Attendance', path: '/faculty/dashboard' },
  { icon: LayoutGrid, label: 'Dashboard', path: '/faculty/analytics' },
  { icon: BookOpen, label: 'Courses', path: '/faculty/courses' },
  { icon: CalendarDays, label: 'Timetable', path: '/faculty/timetable' },
  { icon: Settings, label: 'Settings', path: '/faculty/settings' },
  { icon: FileClock, label: 'Logs', path: '/faculty/logs' },
];
const ADMIN_NAV = [
  { icon: CalendarDays, label: 'Class Schedule', path: '/admin/timetable' },
  { icon: Users, label: 'Students', path: '/admin/students' },
  { icon: UserPlus, label: 'Faculty', path: '/admin/faculty' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside className="w-64 shrink-0 border-r border-ink-border bg-ink-900 flex flex-col">
      <div className="px-6 py-6 border-b border-ink-border">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-signal-red">
            <ScanLine size={16} className="text-white" />
          </div>
          <span className="font-display font-bold text-white tracking-tight">KGiSL-IIM</span>
        </div>
        <p className="mt-1 text-[10px] tracking-[0.2em] text-slate-500 uppercase">MCA Department</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {(user?.role === 'ADMIN' ? ADMIN_NAV : FACULTY_NAV).map(({ icon: Icon, label, path, badge }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={label}
              onClick={() => navigate(path)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                isActive
                  ? 'bg-signal-red/10 text-white border border-signal-red/25'
                  : 'text-slate-400 hover:bg-ink-850 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Icon size={17} className={isActive ? 'text-signal-red' : ''} />
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
        className="m-3 flex items-center gap-3 rounded-lg border border-ink-border px-3 py-2.5 text-left hover:bg-ink-850"
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
    </aside>
  );
}

