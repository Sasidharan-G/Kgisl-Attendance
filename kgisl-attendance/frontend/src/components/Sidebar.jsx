import {
  ScanLine,
  LayoutGrid,
  Users,
  BookOpen,
  CalendarDays,
  BarChart3,
  Bell,
  Settings,
  UserPlus,
  Menu,
  X,
  ClipboardCheck,
  LogOut,
  Power,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate, useLocation } from 'react-router-dom';

const FACULTY_NAV = [
  { icon: ScanLine, label: 'Attendance', path: '/faculty/dashboard' },
  { icon: LayoutGrid, label: 'Dashboard', path: '/faculty/analytics' },
  { icon: Users, label: 'My Students', path: '/faculty/students' },
  { icon: CalendarDays, label: 'Academic Calendar', path: '/faculty/calendar' },
  { icon: CalendarDays, label: 'Timetable', path: '/faculty/timetable' },
  { icon: Settings, label: 'Settings', path: '/faculty/settings' },
  { icon: Bell, label: 'Leave / On Duty', path: '/faculty/leave' },
  { icon: ClipboardCheck, label: 'Corrections', path: '/faculty/corrections' },
];

const ADMIN_NAV = [
  { icon: BookOpen, label: 'Academic Setup', path: '/admin/academic' },
  { icon: CalendarDays, label: 'Academic Calendar', path: '/admin/calendar' },
  { icon: CalendarDays, label: 'Upload Timetable', path: '/admin/timetable' },
  { icon: Users, label: 'Student Database', path: '/admin/students' },
  { icon: UserPlus, label: 'Faculty', path: '/admin/faculty' },
  { icon: BarChart3, label: 'Attendance Reports', path: '/admin/analytics' },
  { icon: Bell, label: 'Leave / On Duty', path: '/admin/leave' },
  { icon: ClipboardCheck, label: 'Corrections', path: '/admin/corrections' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const navItems = user?.role === 'ADMIN' ? ADMIN_NAV : FACULTY_NAV;

  return (
    <>
      {/* Mobile Top Toggle Button */}
      <button
        onClick={() => setOpen(true)}
        className="app-menu-button fixed left-4 top-4 z-40 rounded-xl bg-slate-900 border border-slate-800 p-2 text-slate-300 md:hidden shadow-lg active:scale-95 transition-all"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile Backdrop */}
      {open && (
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-50 shrink-0 flex flex-col overflow-hidden transition-transform duration-300 ease-in-out md:sticky md:translate-x-0 w-64 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Mobile Close Button */}
        <button
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 p-2 text-slate-400 hover:text-white md:hidden"
        >
          <X size={18} />
        </button>

        {/* Clean Header Lockup (Burger icon removed per request) */}
        <div className="app-sidebar-brand sidebar-brand-reveal px-5 py-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300 shadow-inner">
              <ScanLine size={19} className="text-blue-300 animate-pulse" />
            </div>
            <div>
              <span className="font-display font-bold text-white text-base tracking-tight block">KGiSL-IIM</span>
              <p className="text-[10px] tracking-[0.14em] text-slate-400 uppercase font-semibold">MCA Department</p>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="sidebar-menu-reveal flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ icon: Icon, label, path, badge }, index) => {
            const isActive = location.pathname === path;
            return (
              <button
                key={label}
                style={{ animationDelay: `${100 + index * 60}ms` }}
                onClick={() => {
                  navigate(path);
                  setOpen(false);
                }}
                className={`sidebar-menu-item group w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-98 ${
                  isActive
                    ? 'bg-blue-600/20 text-white border border-blue-500/40 shadow-lg shadow-blue-950/50 ring-1 ring-blue-500/30'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100 hover:translate-x-1 border border-transparent'
                }`}
              >
                <Icon
                  size={18}
                  className={`transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span className="flex-1 text-left">{label}</span>
                {badge && (
                  <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-extrabold text-white shadow-sm">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Profile Card & Explicit Power Logout Button */}
        <div className="p-3 border-t border-slate-800/80">
          <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/90 p-3 shadow-card">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600/30 text-blue-300 font-bold text-sm border border-blue-500/40">
                {user?.name?.charAt(0) ?? 'F'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">{user?.name ?? 'Chithra M'}</p>
                <p className="text-[10px] text-slate-400 font-semibold">{user?.role === 'ADMIN' ? 'Administrator' : 'Faculty'}</p>
              </div>
            </div>

            {/* Redesigned Logout Button with Power Icon */}
            <button
              onClick={logout}
              title="Logout session"
              className="flex items-center gap-1 rounded-xl border border-rose-500/40 bg-rose-950/50 px-2.5 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-600 hover:text-white transition-all active:scale-95 shadow-sm shrink-0"
            >
              <Power size={13} className="text-rose-300 group-hover:text-white" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
