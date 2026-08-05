import { useEffect, useState } from 'react';
import { RefreshCcw, Copy, Maximize2, Minimize2 } from 'lucide-react';

export default function QRPanel({ qr, sessionMeta }) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [expanded, setExpanded] = useState(false);

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

  useEffect(() => {
    if (!expanded) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => { if (event.key === 'Escape') setExpanded(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [expanded]);

  const total = qr?.refreshIntervalSeconds ?? 10;

  return (
    <div className="flex flex-col items-center rounded-2xl border border-ink-border bg-ink-850/60 p-4 shadow-card sm:p-6">
      <div className="mb-4 flex w-full flex-wrap items-center justify-between gap-2 sm:mb-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-red-300/30 bg-red-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-red-200">Beta</span>
          <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">QR Fallback</h3>
        </div>
        <div className="flex items-center gap-1.5 rounded-md border border-ink-border bg-ink-900 px-2.5 py-1 text-[11px] text-slate-400">
          <RefreshCcw size={11} className={secondsLeft <= 3 ? 'animate-spin' : ''} />
          Auto refresh in {secondsLeft}s
        </div>
      </div>

      <button type="button" disabled={!qr?.qrImageDataUrl} onClick={() => setExpanded(true)} aria-label="Open QR in full screen" className="scan-frame relative cursor-zoom-in disabled:cursor-default">
        <span className="corner corner-tl" />
        <span className="corner corner-tr" />
        <span className="corner corner-bl" />
        <span className="corner corner-br" />
        <div className="relative h-56 w-56 overflow-hidden rounded-2xl bg-white p-3 sm:h-64 sm:w-64">
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
      </button>

      <button type="button" disabled={!qr?.qrImageDataUrl} onClick={() => setExpanded(true)} className="mt-4 flex items-center gap-2 text-xs font-semibold text-signal-blue disabled:text-slate-500 sm:mt-5"><Maximize2 size={14}/>Tap QR for full screen</button>

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

      {expanded && qr?.qrImageDataUrl && <div role="dialog" aria-modal="true" aria-label="Full screen attendance QR" className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-ink-950/95 p-3 backdrop-blur-sm sm:p-6">
        <div className="mb-3 flex w-full max-w-3xl items-center justify-between gap-3 text-white"><div><p className="text-sm font-bold">Attendance QR</p><p className="text-xs text-slate-400">Auto refresh in {secondsLeft}s</p></div><button type="button" onClick={() => setExpanded(false)} className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold"><Minimize2 size={17}/>Minimize</button></div>
        <div className="relative flex aspect-square w-full max-w-[min(78vh,48rem)] items-center justify-center overflow-hidden rounded-3xl bg-white p-3 shadow-2xl sm:p-6"><img src={qr.qrImageDataUrl} alt="Full screen attendance QR" className="h-full w-full object-contain"/><div className="pointer-events-none absolute inset-0 flex items-center justify-center"><div className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white p-2 shadow-lg"><img src="/qr-center-logo.jpg" alt="Center Logo" className="h-14 w-14 object-contain sm:h-20 sm:w-20"/></div></div></div>
      </div>}
    </div>
  );
}
