import { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import { FileClock, Terminal } from 'lucide-react';
import { listAuditLogs } from '../services/api.js';
import StatePanel from '../components/StatePanel.jsx';

export default function LogsPage() {
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => listAuditLogs().then((data) => { setLogs(data); setError(''); }).catch((err) => setError(err.message || 'Could not load audit logs')).finally(() => setLoading(false));
    load();
    const interval = setInterval(load, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-screen bg-ink-950">
      <Sidebar />

      <main className="flex-1 min-w-0 pb-10">
        <TopBar connected={true} />

        <div className="px-8 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 border border-ink-border text-slate-300">
              <FileClock size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">System Activity Logs</h2>
              <p className="text-sm text-slate-400">Database-backed security and attendance audit trail</p>
            </div>
          </div>

          {/* Log terminal */}
          <div className="rounded-2xl border border-ink-border bg-[#050811] shadow-card p-5 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-ink-border/40 pb-3 mb-4">
              <div className="flex items-center gap-2 text-slate-400">
                <Terminal size={14} />
                <span>Console Stream</span>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-signal-green">
                <span className="h-1.5 w-1.5 rounded-full bg-signal-green status-dot" />
                Live Log
              </span>
            </div>

            {loading && <StatePanel type="loading" compact title="Loading audit trail" description="Reading the latest security activity." />}
            {!loading && error && <StatePanel type="error" compact title="Audit trail unavailable" description={error} actionLabel="Try again" onAction={() => { setLoading(true); setError(''); listAuditLogs().then(setLogs).catch((err) => setError(err.message)).finally(() => setLoading(false)); }} />}
            <div className="space-y-2 max-h-[450px] overflow-y-auto leading-relaxed">
              {logs.map((log, idx) => (
                <div key={log.id || idx} className="flex gap-4">
                  <span className="text-slate-500 font-mono select-none">{new Date(log.createdAt).toLocaleString('en-IN')}</span>
                  <span
                    className={`font-semibold ${
                      !log.success
                        ? 'text-signal-amber'
                        : 'text-signal-blue'
                    }`}
                  >
                    [{log.actorType}]
                  </span>
                  <span className="text-slate-300 font-mono">{log.action}{log.reasonCode ? ` · ${log.reasonCode}` : ''}{log.sessionId ? ` · session ${log.sessionId.slice(0, 8)}` : ''}</span>
                </div>
              ))}
              {!loading && !logs.length && !error && <StatePanel type="empty" compact title="No audit activity" description="Security and attendance actions will appear here." />}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
