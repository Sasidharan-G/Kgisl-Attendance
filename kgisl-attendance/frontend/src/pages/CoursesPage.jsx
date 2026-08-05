import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import { listSubjects } from '../services/api.js';
import { BookOpen, FolderOpen } from 'lucide-react';
import StatePanel from '../components/StatePanel.jsx';

export default function CoursesPage() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await listSubjects();
        setSubjects(data);
      } catch (err) {
        setError(err.message || 'Failed to load courses');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen bg-ink-950">
      <Sidebar />

      <main className="flex-1 min-w-0 pb-10">
        <TopBar connected={true} />

        <div className="px-8 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-signal-blue/10 border border-signal-blue/20 text-signal-blue">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Academic Courses</h2>
              <p className="text-sm text-slate-400">Department curriculum & catalogs</p>
            </div>
          </div>

          {error && <div className="mb-6"><StatePanel type="error" compact title="Could not load courses" description={error} actionLabel="Try again" onAction={() => window.location.reload()} /></div>}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Primary MCA Card */}
            <div className="col-span-1 lg:col-span-2 rounded-2xl border border-ink-border bg-ink-850/60 shadow-card p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-signal-red/10 text-signal-red border border-signal-red/20">
                    Active Program
                  </span>
                  <h3 className="text-2xl font-bold text-white mt-2">Master of Computer Applications</h3>
                  <p className="text-sm text-slate-400 mt-1">MCA • Post Graduate Degree • 2 Years</p>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Curriculum Subjects ({subjects.length})
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {loading ? (
                    <div className="col-span-2"><StatePanel type="loading" compact title="Loading curriculum" description="Fetching the latest subject catalog." /></div>
                  ) : subjects.length === 0 ? (
                    <div className="col-span-2"><StatePanel type="empty" compact title="No subjects configured" description="Subjects added by the administrator will appear here." /></div>
                  ) : (
                    subjects.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-ink-border bg-ink-900/50 hover:bg-ink-800/40 transition"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{sub.name}</p>
                          <p className="text-xs font-mono text-slate-500 mt-0.5">{sub.code}</p>
                        </div>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                          Core
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Inactive / Electives Card */}
            <div className="rounded-2xl border border-ink-border bg-ink-850/60 shadow-card p-6 flex flex-col justify-between">
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-800 border border-ink-border text-slate-400">
                  <FolderOpen size={20} />
                </div>
                <h3 className="text-lg font-bold text-white mt-4">Other Programs</h3>
                <p className="text-sm text-slate-400 mt-2">
                  No other active programs are registered under this department profile.
                </p>
              </div>

              <div className="border-t border-ink-border/50 pt-4 mt-6">
                <p className="text-xs text-slate-500">
                  To request additions, contact the department chair or admin system operations.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
