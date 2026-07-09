import { CheckCircle2, ShieldAlert } from 'lucide-react';

export default function RecentScans({ scans }) {
  return (
    <div className="rounded-2xl border border-ink-border bg-ink-850/60 shadow-card p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Recent Live Scans</h3>
        <span className="flex items-center gap-1.5 text-[11px] text-signal-green">
          <span className="h-1.5 w-1.5 rounded-full bg-signal-green status-dot animate-pulse" /> Live
        </span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto max-h-[340px] pr-1">
        {scans.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-xs text-slate-500">No scans received yet in this session.</p>
            <p className="text-[10px] text-slate-600 mt-1">Waiting for students to scan the QR...</p>
          </div>
        )}
        {scans.map((s, i) => {
          const scanTimeText = s.scanTime 
            ? new Date(s.scanTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

          return (
            <div
              key={`${s.studentId}-${i}`}
              className={`flex items-center justify-between rounded-xl px-4 py-3 border transition-all ${
                s.isViolation 
                  ? 'bg-signal-red/5 border-signal-red/20 hover:bg-signal-red/10' 
                  : 'bg-ink-900/40 border-ink-border/40 hover:bg-ink-800/20'
              }`}
            >
              <div className="min-w-0">
                <p className={`text-sm font-semibold truncate ${s.isViolation ? 'text-red-400' : 'text-white'}`}>{s.studentName}</p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                  <span className="font-mono">{s.studentRoll || 'Student'}</span>
                  <span>•</span>
                  <span className="font-mono text-[10px]">{scanTimeText}</span>
                </div>
                {s.isViolation && s.distance && (
                  <p className="text-[10px] text-red-400/80 mt-1">Geofence violated ({s.distance}m away)</p>
                )}
              </div>
              
              {s.isViolation ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold bg-signal-red/10 text-signal-red px-2 py-0.5 rounded-lg border border-signal-red/20">
                  <ShieldAlert size={12} />
                  Blocked
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-semibold bg-signal-green/10 text-signal-green px-2 py-0.5 rounded-lg border border-signal-green/20">
                  <CheckCircle2 size={12} />
                  Present
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

