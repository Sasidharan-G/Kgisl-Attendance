import { BarChart3, CalendarCheck, ClipboardList, HelpCircle, LogOut, ScanLine } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const items = [
  { label: 'Overview', path: '/student/dashboard', Icon: BarChart3 },
  { label: 'Scan Attendance', path: '/student/scan', Icon: ScanLine },
  { label: 'Attendance Ledger', path: '/student/attendance', Icon: ClipboardList },
  { label: 'Leave / On Duty', path: '/student/leave', Icon: CalendarCheck },
];

export default function StudentSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  return <aside className="student-command-sidebar">
    <div className="student-command-brand"><img src="/entrance-emblem.png" alt=""/><div><strong>KGiSL Institute</strong><span>Attendance Portal</span></div></div>
    <nav>{items.map(({ label, path, Icon }) => <button key={path} type="button" className={location.pathname === path ? 'active' : ''} onClick={() => navigate(path)}><Icon size={15}/><span>{label}</span></button>)}</nav>
    <button type="button" className="student-command-manual" onClick={() => navigate('/student/scan')}><ScanLine size={14}/>Mark Attendance</button>
    <div className="student-command-bottom"><span><HelpCircle size={14}/>Help</span><button type="button" onClick={logout}><LogOut size={14}/>Logout</button><small>{user?.rollNo || user?.name}</small></div>
  </aside>;
}
