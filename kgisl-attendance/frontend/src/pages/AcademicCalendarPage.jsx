import { useCallback, useEffect, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, PartyPopper, GraduationCap, ShieldAlert, CheckCircle2, Clock, FileUp, Check, BookOpenCheck, Building, Trash2, Download } from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import StatePanel from '../components/StatePanel.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import {
  createCalendarEvent,
  deleteBlockTest,
  deleteCalendarEvent,
  importBlockTests,
  importCalendarEvents,
  listBatches,
  listBlockTests,
  listCalendarEvents,
} from '../services/api.js';
import { BLOCK_TEST_CSV_TEMPLATE, CALENDAR_CSV_TEMPLATE, parseBlockTestCsv, parseCalendarCsv } from '../utils/calendarCsv.js';
import { format12HourRange } from '../utils/timeFormat.js';

const EVENT_TYPES = {
  WORKING: { label: 'Working Day', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: CheckCircle2 },
  HOLIDAY: { label: 'College Holiday', bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30', icon: ShieldAlert },
  EXAM: { label: 'Examination', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', icon: GraduationCap },
  EVENT: { label: 'College Event', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', icon: PartyPopper },
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function weekdayOf(dateKey) {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' });
}

function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The academic calendar and the block-test timetable are stored on the server, so everything an administrator
 * publishes is what faculty and students see. (Both used to be hard-coded in the browser: nothing entered here was
 * saved, and a fake "Analyze document" button always inserted the same sample rows whatever file was chosen.)
 */
export default function AcademicCalendarPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';
  const isAdminOrFaculty = isAdmin || user?.role === 'FACULTY';
  const isStudent = user?.role === 'STUDENT';

  const [currentDate, setCurrentDate] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
  const [events, setEvents] = useState([]);
  const [blockTests, setBlockTests] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEvent, setNewEvent] = useState({ date: '', title: '', type: 'HOLIDAY', description: '' });
  const [saving, setSaving] = useState(false);

  // CSV import state (calendar and block tests work the same way: choose, preview, confirm).
  const [calendarFile, setCalendarFile] = useState(null);
  const [calendarPreview, setCalendarPreview] = useState(null);
  const [blockTestFile, setBlockTestFile] = useState(null);
  const [blockTestPreview, setBlockTestPreview] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [eventRows, testRows, batchRows] = await Promise.all([
        listCalendarEvents(),
        listBlockTests(),
        isAdmin ? listBatches() : Promise.resolve([]),
      ]);
      setEvents(eventRows);
      setBlockTests(testRows);
      setBatches(batchRows);
    } catch (err) {
      setLoadError(err.message || 'Could not load the academic calendar.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  function prevMonth() { setCurrentDate(new Date(year, month - 1, 1)); }
  function nextMonth() { setCurrentDate(new Date(year, month + 1, 1)); }

  function announce(message) {
    setNotice(message);
    setActionError('');
    window.setTimeout(() => setNotice(''), 5000);
  }

  async function handleAddEvent(event) {
    event.preventDefault();
    if (!newEvent.date || newEvent.title.trim().length < 2) return;
    setSaving(true);
    setActionError('');
    try {
      await createCalendarEvent({ ...newEvent, title: newEvent.title.trim(), description: newEvent.description.trim() });
      setNewEvent({ date: '', title: '', type: 'HOLIDAY', description: '' });
      setShowAddModal(false);
      announce('Event saved. Everyone can see it now.');
      await load();
    } catch (err) {
      setActionError(err.message || 'Could not save the event.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteEvent(ev) {
    if (!window.confirm(`Remove "${ev.title}" (${ev.date}) from the calendar?`)) return;
    try {
      await deleteCalendarEvent(ev.id);
      announce('Event removed.');
      await load();
    } catch (err) {
      setActionError(err.message || 'Could not remove the event.');
    }
  }

  async function handleDeleteBlockTest(test) {
    if (!window.confirm(`Remove the ${test.subjectCode} block test on ${test.date}?`)) return;
    try {
      await deleteBlockTest(test.id);
      announce('Block test removed.');
      await load();
    } catch (err) {
      setActionError(err.message || 'Could not remove the block test.');
    }
  }

  async function analyzeCalendar() {
    if (!calendarFile) return;
    setCalendarPreview(parseCalendarCsv(await calendarFile.text()));
  }

  async function confirmCalendar() {
    if (!calendarPreview?.rows.length) return;
    setSaving(true);
    try {
      const rows = calendarPreview.rows.map(({ date, title, type, description }) => ({ date, title, type, description }));
      const result = await importCalendarEvents(rows);
      setCalendarPreview(null);
      setCalendarFile(null);
      announce(`${result.added} event${result.added === 1 ? '' : 's'} added${result.skipped ? `, ${result.skipped} already existed` : ''}.`);
      await load();
    } catch (err) {
      setActionError(err.message || 'Could not import the calendar.');
    } finally {
      setSaving(false);
    }
  }

  async function analyzeBlockTests() {
    if (!blockTestFile) return;
    setBlockTestPreview(parseBlockTestCsv(await blockTestFile.text(), { batches }));
  }

  async function confirmBlockTests() {
    if (!blockTestPreview?.rows.length) return;
    setSaving(true);
    try {
      const rows = blockTestPreview.rows.map(({ date, startTime, endTime, subjectCode, subjectName, room, batchId }) => ({ date, startTime, endTime, subjectCode, subjectName, room, batchId }));
      const result = await importBlockTests(rows);
      setBlockTestPreview(null);
      setBlockTestFile(null);
      announce(`${result.added} block test${result.added === 1 ? '' : 's'} published${result.skipped ? `, ${result.skipped} already existed` : ''}.`);
      await load();
    } catch (err) {
      setActionError(err.message || 'Could not import the block tests.');
    } finally {
      setSaving(false);
    }
  }

  const monthEventList = events.filter((ev) => ev.date.startsWith(monthKey) && (filterType === 'ALL' || ev.type === filterType));

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
                <h2 className="text-xl font-bold text-white">College Academic Calendar & Block Test Schedule</h2>
                <p className="text-sm text-slate-400">Working days, holidays, block-test timetables and examinations published by the administrator</p>
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
              {isAdmin && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition shadow-lg shadow-blue-900/30"
                >
                  <Plus size={16} /> Add Calendar Event
                </button>
              )}
            </div>
          </div>

          {notice && <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-4 py-2.5 text-sm font-semibold text-emerald-200" role="status"><Check size={16} className="text-emerald-400" />{notice}</div>}
          {actionError && <div className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-sm text-red-200" role="alert">{actionError}</div>}
          {loading && <div className="mb-6"><StatePanel type="loading" title="Loading the calendar" description="Fetching holidays, events and block tests." /></div>}
          {!loading && loadError && <div className="mb-6"><StatePanel type="error" title="Calendar unavailable" description={loadError} actionLabel="Try again" onAction={load} /></div>}

          {/* Block test timetable */}
          <section className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
                  <BookOpenCheck size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Block Test Timetable & Exam Schedule</h3>
                  <p className="text-xs text-slate-400">{isStudent ? 'Tests for your section and tests that apply to everyone' : 'Dates, time sessions and assigned exam halls'}</p>
                </div>
              </div>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => document.getElementById('block-test-upload')?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 transition"
                >
                  <FileUp size={14} /> Import Block Test Timetable (CSV)
                </button>
              )}
            </div>

            {blockTests.length === 0 && !loading ? (
              <StatePanel type="empty" compact title="No block tests published" description={isAdmin ? 'Import a CSV below to publish the block-test timetable.' : 'The administrator has not published a block-test timetable yet.'} />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/80">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950 text-slate-400 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3">Date & Day</th>
                      <th className="px-4 py-3">Time Session</th>
                      <th className="px-4 py-3">Subject & Code</th>
                      <th className="px-4 py-3">Exam Hall / Room</th>
                      <th className="px-4 py-3">Class</th>
                      {isAdmin && <th className="px-4 py-3" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 text-slate-200">
                    {blockTests.map((bt) => (
                      <tr key={bt.id} className="hover:bg-slate-800/40 transition">
                        <td className="px-4 py-3 font-semibold text-white">
                          <div className="flex items-center gap-2">
                            <span className="rounded-lg bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-300 font-mono">{bt.date}</span>
                            <span className="text-xs text-slate-400">({weekdayOf(bt.date)})</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-amber-200">{format12HourRange(bt.startTime, bt.endTime)}</td>
                        <td className="px-4 py-3 font-bold text-white">
                          <span className="text-blue-400 mr-2">{bt.subjectCode}</span>
                          <span>· {bt.subjectName}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-300">
                          <span className="inline-flex items-center gap-1"><Building size={12} className="text-slate-400" />{bt.room}</span>
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-blue-400">{bt.batchName || 'All sections'}</td>
                        {isAdmin && (
                          <td className="px-4 py-3 text-right">
                            <button type="button" onClick={() => handleDeleteBlockTest(bt)} title="Remove block test" className="rounded-lg p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 size={15} /></button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {isAdmin && (
              <CsvImporter
                id="block-test-upload"
                tone="amber"
                title="Import block-test timetable from CSV"
                hint="Columns: date, start, end, subjectCode, subjectName, room, section (leave section blank for every section)"
                file={blockTestFile}
                onFile={(file) => { setBlockTestFile(file); setBlockTestPreview(null); }}
                onAnalyze={analyzeBlockTests}
                onTemplate={() => downloadText('block-test-template.csv', BLOCK_TEST_CSV_TEMPLATE)}
                preview={blockTestPreview}
                onConfirm={confirmBlockTests}
                saving={saving}
                renderRow={(row) => (
                  <>
                    <p className="font-bold text-amber-300">{row.subjectCode} · {row.subjectName}</p>
                    <p className="mt-1 text-slate-300">{row.date} ({weekdayOf(row.date)}) · {format12HourRange(row.startTime, row.endTime)}</p>
                    <p className="text-slate-400 text-[10px] mt-0.5">Hall: {row.room} · {row.batchName || 'All sections'}</p>
                  </>
                )}
              />
            )}
          </section>

          {/* Academic calendar import */}
          {isAdmin && (
            <section className="mb-6 rounded-2xl border border-blue-500/30 bg-blue-950/20 p-5 shadow-card">
              <CsvImporter
                id="calendar-upload"
                tone="blue"
                title="Import academic calendar from CSV"
                hint="Columns: date, title, type (HOLIDAY, EXAM, EVENT or WORKING), description. Dates as 2026-10-20 or 20-10-2026."
                file={calendarFile}
                onFile={(file) => { setCalendarFile(file); setCalendarPreview(null); }}
                onAnalyze={analyzeCalendar}
                onTemplate={() => downloadText('academic-calendar-template.csv', CALENDAR_CSV_TEMPLATE)}
                preview={calendarPreview}
                onConfirm={confirmCalendar}
                saving={saving}
                renderRow={(row) => {
                  const cfg = EVENT_TYPES[row.type] || EVENT_TYPES.EVENT;
                  return (
                    <>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className={`font-bold ${cfg.text}`}>{cfg.label}</span>
                        <span className="font-mono text-slate-400">{row.date}</span>
                      </div>
                      <p className="text-xs font-bold text-white">{row.title}</p>
                      {row.description && <p className="text-[10px] text-slate-400 mt-1">{row.description}</p>}
                    </>
                  );
                }}
                topBorder={false}
              />
            </section>
          )}

          {/* Month navigation & filters */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
            <div className="flex items-center gap-3">
              <button onClick={prevMonth} aria-label="Previous month" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><ChevronLeft size={20}/></button>
              <h3 className="text-lg font-bold text-white min-w-[160px] text-center">{MONTHS[month]} {year}</h3>
              <button onClick={nextMonth} aria-label="Next month" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><ChevronRight size={20}/></button>
            </div>

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

          {/* Calendar grid & event list */}
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5">
              <div className="grid grid-cols-7 gap-2 mb-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="py-2">{d}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-20 rounded-xl bg-slate-950/20 border border-transparent" />
                ))}

                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dateStr = `${monthKey}-${String(dayNum).padStart(2, '0')}`;
                  const dayEvents = events.filter((e) => e.date === dateStr && (filterType === 'ALL' || e.type === filterType));
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

            <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 flex flex-col">
              <h3 className="mb-4 text-base font-bold text-white flex items-center gap-2">
                <Clock size={16} className="text-blue-400" />
                {MONTHS[month]} Schedule & Holidays
              </h3>

              <div className="space-y-3 overflow-y-auto max-h-[500px] pr-1 flex-1">
                {monthEventList.length === 0 ? (
                  <p className="text-center py-12 text-sm text-slate-500">No holidays or events listed for this month.</p>
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
                          <span className="flex items-center gap-2 text-xs font-mono text-slate-400">
                            {ev.date}
                            {isAdmin && <button type="button" onClick={() => handleDeleteEvent(ev)} title="Remove event" className="rounded p-1 text-red-400 hover:bg-red-500/10"><Trash2 size={13} /></button>}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-1">{ev.title}</h4>
                        {ev.description && <p className="mt-1 text-xs text-slate-300">{ev.description}</p>}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add event modal (administrators only) */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleAddEvent} className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-white">Add Academic Event / Holiday</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Event Date</label>
              <input type="date" required value={newEvent.date} onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Event Title</label>
              <input type="text" required minLength={2} maxLength={150} placeholder="e.g. Mid-Term Holiday" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Event Category</label>
              <select value={newEvent.type} onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white">
                <option value="HOLIDAY">College Holiday</option>
                <option value="EXAM">Examination</option>
                <option value="EVENT">College Event</option>
                <option value="WORKING">Working Day</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
              <textarea rows={2} maxLength={300} placeholder="Details about holiday or event..." value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 rounded-xl border border-slate-700 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50">{saving ? 'Saving…' : 'Add Event'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/** File picker + preview + confirm for a CSV import. Nothing is saved until the administrator confirms. */
function CsvImporter({ id, tone, title, hint, file, onFile, onAnalyze, onTemplate, preview, onConfirm, saving, renderRow, topBorder = true }) {
  const accent = tone === 'amber'
    ? { icon: 'text-amber-400', button: 'bg-amber-600 hover:bg-amber-500', file: 'file:bg-amber-600/30 file:text-amber-200', border: 'border-amber-500/20' }
    : { icon: 'text-blue-400', button: 'bg-blue-600 hover:bg-blue-500', file: 'file:bg-blue-600/30 file:text-blue-200', border: 'border-slate-800' };
  return (
    <div id={id} className={topBorder ? `mt-5 border-t ${accent.border} pt-4` : ''}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <FileUp size={16} className={accent.icon} />
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">{title}</h4>
        </div>
        <button type="button" onClick={onTemplate} className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-800"><Download size={12} /> Download template</button>
      </div>
      <p className="mb-3 text-[11px] text-slate-400">{hint}</p>
      <div className="grid gap-3 md:grid-cols-3 items-center">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onFile(e.target.files?.[0] || null)}
          className={`rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:px-3 file:py-1 file:text-xs file:font-semibold ${accent.file}`}
        />
        <button type="button" disabled={!file} onClick={onAnalyze} className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40 transition ${accent.button}`}>
          Check file
        </button>
        <div className="text-xs text-slate-400">{file ? `File: ${file.name}` : 'Choose a .csv file (Excel: Save As → CSV)'}</div>
      </div>

      {preview && (
        <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h5 className="text-xs font-bold text-white uppercase">
              {preview.rows.length} row{preview.rows.length === 1 ? '' : 's'} ready{preview.errors.length ? ` · ${preview.errors.length} with problems` : ''}
            </h5>
            <button
              type="button"
              disabled={saving || preview.rows.length === 0}
              onClick={onConfirm}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              <Check size={12} /> {saving ? 'Saving…' : 'Confirm & publish'}
            </button>
          </div>
          {preview.errors.length > 0 && (
            <ul className="mb-3 space-y-1 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-[11px] text-red-200" role="alert">
              {preview.errors.slice(0, 20).map((problem) => <li key={`${problem.line}-${problem.message}`}>Line {problem.line}: {problem.message}</li>)}
              {preview.errors.length > 20 && <li>…and {preview.errors.length - 20} more.</li>}
              <li className="text-red-300/80">Rows with problems are skipped. Fix them in the file and check it again to include them.</li>
            </ul>
          )}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {preview.rows.map((row) => (
              <div key={row.line} className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-xs">{renderRow(row)}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
