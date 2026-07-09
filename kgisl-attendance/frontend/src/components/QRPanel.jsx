import { useEffect, useState } from 'react';
import { RefreshCcw, Copy } from 'lucide-react';

export default function QRPanel({ qr, sessionMeta }) {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!qr?.expiresAt) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((qr.expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [qr?.expiresAt, qr?.issuedAt]);

  const total = qr?.refreshIntervalSeconds ?? 10;

  return (
    <div className="rounded-2xl border border-ink-border bg-ink-850/60 shadow-card p-6 flex flex-col items-center">
      <div className="w-full flex items-center justify-between mb-6">
        <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Scan to Mark Attendance</h3>
        <div className="flex items-center gap-1.5 rounded-md border border-ink-border bg-ink-900 px-2.5 py-1 text-[11px] text-slate-400">
          <RefreshCcw size={11} className={secondsLeft <= 3 ? 'animate-spin' : ''} />
          Auto refresh in {secondsLeft}s
        </div>
      </div>

      <div className="scan-frame relative">
        <span className="corner corner-tl" />
        <span className="corner corner-tr" />
        <span className="corner corner-bl" />
        <span className="corner corner-br" />
        <div className="relative h-64 w-64 overflow-hidden rounded-2xl bg-white p-3">
          {qr?.qrImageDataUrl ? (
            <>
              <img src={qr.qrImageDataUrl} alt="Attendance QR" className="h-full w-full object-contain" />
              {/* Center Logo Overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white p-1.5 rounded-xl shadow-lg border border-slate-100 flex items-center justify-center">
                  <img src="/qr-center-logo.jpg" alt="Center Logo" className="h-12 w-12 object-contain" />
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
              Waiting for session…
            </div>
          )}
          <div
            className="sweep animate-scanline"
            style={{ animationDuration: `${total}s` }}
          />
        </div>
      </div>

      <p className="mt-5 text-xs text-slate-500">Show this QR to students for scanning</p>

      <div className="mt-6 grid w-full grid-cols-3 gap-4 border-t border-ink-border pt-5 text-center">
        <div>
          <p className="text-[10px] text-slate-500 uppercase">Session ID</p>
          <div className="mt-1 flex items-center justify-center gap-1 font-mono text-xs text-slate-300">
            <span className="truncate max-w-[90px]">{sessionMeta?.sessionId ?? '—'}</span>
            {sessionMeta?.sessionId && (
              <button onClick={() => navigator.clipboard.writeText(sessionMeta.sessionId)}>
                <Copy size={11} className="text-slate-500 hover:text-slate-300" />
              </button>
            )}
          </div>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase">Started By</p>
          <p className="mt-1 text-xs text-slate-300">{sessionMeta?.startedBy ?? '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 uppercase">Started At</p>
          <p className="mt-1 text-xs text-slate-300">{sessionMeta?.startedAt ?? '—'}</p>
        </div>
      </div>
    </div>
  );
}
