import { useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, PartyPopper, GraduationCap, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';

const INITIAL_EVENTS = [
  { id: '1', date: '2026-08-15', title: 'Independence Day', type: 'HOLIDAY', description: 'National Holiday - College Closed' },
  { id: '2', date: '2026-08-22', title: 'Internal Assessment I', type: 'EXAM', description: 'MCA Semester III Internal Exams Begin' },
  { id: '3', date: '2026-08-28', title: 'TechSymposium 2026', type: 'EVENT', description: 'KGiSL Annual Technical Symposium' },
  { id: '4', date: '2026-09-05', title: 'Teachers Day Celebration', type: 'EVENT', description: 'Special Assembly & Student Events' },
  { id: '5', date: '2026-09-17', title: 'Vinayagar Chaturthi', type: 'HOLIDAY', description: 'Government Holiday' },
  { id: '6', date: '2026-10-02', title: 'Gandhi Jayanti', type: 'HOLIDAY', description: 'National Holiday' },
  { id: '7', date: '2026-10-20', title: 'Mid-Semester Examinations', type: 'EXAM', description: 'Theory & Practical Examinations' },
  { id: '8', date: '2026-11-08', title: 'Diwali Festival', type: 'HOLIDAY', description: 'Festival Holiday' },
  { id: '9', date: '2026-12-15', title: 'End Semester Practical Exams', type: 'EXAM', description: 'Autonomous Examinations' },
  { id: '10', date: '2026-12-25', title: 'Christmas', type: 'HOLIDAY', description: 'Winter Holiday' },
];

const EVENT_TYPES = {
  WORKING: { label: 'Working Day', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle2 },
  HOLIDAY: { label: 'College Holiday', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', icon: ShieldAlert },
  EXAM: { label: 'Examination', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', icon: GraduationCap },
  EVENT: { label: 'College Event', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', icon: PartyPopper },
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function AcademicCalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdminOrFaculty = user?.role === 'ADMIN' || user?.role === 'FACULTY';
  const isStudent = user?.role === 'STUDENT';

  const [currentDate, setCurrentDate] = useState(new Date(2026, 7, 1)); // August 2026
  const [events, setEvents] = useState(INITIAL_EVENTS);
  const [filterType, setFilterType] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ date: '', title: '', type: 'HOLIDAY', description: '' });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  function prevMonth() { setCurrentDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setCurrentDate(new Date(year, month + 1, 1)); }

  function handleAddEvent(e) {
    e.preventDefault();
    if (!newEvent.date || !newEvent.title) return;
    setEvents([...events, { ...newEvent, id: String(Date.now()) }]);
    setNewEvent({ date: '', title: '', type: 'HOLIDAY', description: '' });
    setShowAddModal(false);
  }

  const monthEventList = events.filter((ev) => {
    const evDate = new Date(ev.date);
    const matchesMonth = evDate.getFullYear() === year && evDate.getMonth() === month;
    const matchesType = filterType === 'ALL' || ev.type === filterType;
    return matchesMonth && matchesType;
  });

  return (
    <div className="flex min-h-screen bg-ink-950">
      {isAdminOrFaculty && <Sidebar />}
      <main className="flex-1 min-w-0 pb-12">
        {isAdminOrFaculty && <TopBar connected />}
        
        <div className={`px-4 sm:px-8 mt-6 ${isStudent ? 'max-w-6xl mx-auto' : ''}`}>
          {/* Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400">
                <CalendarIcon size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">College Academic Calendar</h2>
                <p className="text-sm text-slate-400">View official working days, holidays, examination dates & events</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isStudent && (
                <button
                  onClick={() => navigate('/student/dashboard')}
                  className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700"
                >
                  ← Back to Student Dashboard
                </button>
              )}
              {user?.role === 'ADMIN' && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition shadow-lg shadow-blue-900/30"
                >
                  <Plus size={16} /> Add Calendar Event
                </button>
              )}
            </div>
          </div>

          {/* Month Navigation & Filters */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><ChevronLeft size={20}/></button>
              <h3 className="text-lg font-bold text-white min-w-[160px] text-center">{MONTHS[month]} {year}</h3>
              <button onClick={nextMonth} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><ChevronRight size={20}/></button>
            </div>

            {/* Event Legend & Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setFilterType('ALL')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filterType === 'ALL' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              >
                All Events
              </button>
              {Object.entries(EVENT_TYPES).map(([typeKey, cfg]) => (
                <button
                  key={typeKey}
                  onClick={() => setFilterType(filterType === typeKey ? 'ALL' : typeKey)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${cfg.bg} ${cfg.text} ${cfg.border} ${filterType === typeKey ? 'ring-2 ring-blue-500' : 'opacity-80 hover:opacity-100'}`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Calendar Grid View & Event List Layout */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* 7x5 Calendar Grid */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
              <div className="grid grid-cols-7 gap-2 mb-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="py-2">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {/* Empty cells before first day */}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-20 rounded-xl bg-slate-950/20 border border-transparent" />
                ))}

                {/* Days of month */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const dayEvents = events.filter((e) => e.date === dateStr);
                  const isSunday = new Date(year, month, dayNum).getDay() === 0;

                  return (
                    <div
                      key={dayNum}
                      className={`h-20 rounded-xl border p-2 flex flex-col justify-between transition ${
                        isSunday
                          ? 'border-slate-800/40 bg-slate-950/40 opacity-60'
                          : dayEvents.length > 0
                          ? 'border-blue-500/40 bg-blue-950/20'
                          : 'border-slate-800/60 bg-slate-900/40'
                      }`}
                    >
                      <span className={`text-xs font-bold ${isSunday ? 'text-rose-400' : 'text-slate-200'}`}>{dayNum}</span>
                      <div className="space-y-1 overflow-hidden">
                        {dayEvents.map((ev) => {
                          const cfg = EVENT_TYPES[ev.type] || EVENT_TYPES.EVENT;
                          return (
                            <div key={ev.id} className={`truncate rounded px-1.5 py-0.5 text-[9px] font-bold ${cfg.bg} ${cfg.text}`}>
                              {ev.title}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Side Events List */}
            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 flex flex-col">
              <h3 className="mb-4 text-base font-bold text-white flex items-center gap-2">
                <Clock size={16} className="text-blue-400" />
                {MONTHS[month]} Schedule & Holidays
              </h3>

              <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1 flex-1">
                {monthEventList.length === 0 ? (
                  <p className="text-center py-12 text-sm text-slate-500">No special holidays or events listed for this month.</p>
                ) : (
                  monthEventList.map((ev) => {
                    const cfg = EVENT_TYPES[ev.type] || EVENT_TYPES.EVENT;
                    const Icon = cfg.icon;
                    return (
                      <div key={ev.id} className={`rounded-xl border p-4 transition ${cfg.bg} ${cfg.border}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${cfg.text}`}>
                            <Icon size={14} />
                            {cfg.label}
                          </span>
                          <span className="text-xs font-mono text-slate-400">{ev.date}</span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1">{ev.title}</h4>
                        <p className="mt-1 text-xs text-slate-300">{ev.description}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Admin Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleAddEvent} className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Add Academic Event / Holiday</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Event Date</label>
              <input
                type="date"
                required
                value={newEvent.date}
                onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Event Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Mid-Term Holiday"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Event Category</label>
              <select
                value={newEvent.type}
                onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              >
                <option value="HOLIDAY">College Holiday</option>
                <option value="EXAM">Examination</option>
                <option value="EVENT">College Event</option>
                <option value="WORKING">Working Day</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
              <textarea
                rows={2}
                placeholder="Details about holiday or event..."
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 rounded-xl border border-slate-700 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-bold text-white hover:bg-blue-500"
              >
                Add Event
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
