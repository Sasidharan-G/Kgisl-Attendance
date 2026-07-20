import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLines, Radio, RefreshCw, Square, TriangleAlert, Volume2 } from 'lucide-react';
import { AcousticTransmitter } from '../features/acoustic/AcousticTransmitter';
import { getTransmitterCapability } from '../features/acoustic/capabilities';
import { issueAcousticToken, revokeAcousticToken, type AcousticToken } from '../features/acoustic/acousticApi';

type BroadcastState = 'idle' | 'starting' | 'broadcasting' | 'error';

type AcousticBroadcastPanelProps = {
  sessionId?: string | null;
  sessionActive: boolean;
  sessionPaused: boolean;
};

export default function AcousticBroadcastPanel({
  sessionId,
  sessionActive,
  sessionPaused,
}: AcousticBroadcastPanelProps) {
  const transmitterRef = useRef<AcousticTransmitter | null>(null);
  const pendingTokenRef = useRef<Promise<AcousticToken> | null>(null);
  const refreshTimerRef = useRef<number | null>(null);
  const runIdRef = useRef(0);
  const [state, setState] = useState<BroadcastState>('idle');
  const [error, setError] = useState('');
  const [tokenMeta, setTokenMeta] = useState<AcousticToken | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const capability = getTransmitterCapability();

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = null;
  }, []);

  const stopBroadcast = useCallback(async (revoke = true) => {
    runIdRef.current += 1;
    clearRefreshTimer();
    const transmitter = transmitterRef.current;
    transmitterRef.current = null;
    setTokenMeta(null);
    setSecondsLeft(0);
    setState('idle');
    if (transmitter) await transmitter.stop();
    // Serialize stop/start against an in-flight rotation. Otherwise an older
    // request could arrive after a new broadcast and silently replace its token.
    await pendingTokenRef.current?.catch(() => undefined);
    if (revoke && sessionId) await revokeAcousticToken(sessionId).catch(() => undefined);
  }, [clearRefreshTimer, sessionId]);

  const refreshToken = useCallback(async (runId: number, transmitter: AcousticTransmitter) => {
    if (!sessionId || runIdRef.current !== runId) return;
    const request = issueAcousticToken(sessionId);
    pendingTokenRef.current = request;
    let token: AcousticToken;
    try {
      token = await request;
    } finally {
      if (pendingTokenRef.current === request) pendingTokenRef.current = null;
    }
    if (runIdRef.current !== runId) return;
    await transmitter.setToken(token.token);
    if (runIdRef.current !== runId) return;
    setTokenMeta(token);
    setState('broadcasting');
    const latestSafeRefresh = Math.max(1_000, token.expiresAt - Date.now() - 1_500);
    const refreshDelay = Math.max(1_000, Math.min(token.refreshAfterMs, latestSafeRefresh));
    clearRefreshTimer();
    refreshTimerRef.current = window.setTimeout(() => {
      void refreshToken(runId, transmitter).catch(async (refreshError: unknown) => {
        if (runIdRef.current !== runId) return;
        setError(refreshError instanceof Error ? refreshError.message : 'Acoustic token refresh failed.');
        setState('error');
        await transmitter.stop();
        transmitterRef.current = null;
      });
    }, refreshDelay);
  }, [clearRefreshTimer, sessionId]);

  const startBroadcast = useCallback(async () => {
    if (!sessionId || !sessionActive || sessionPaused || !capability.supported) return;
    await stopBroadcast(false);
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setState('starting');
    setError('');
    const transmitter = new AcousticTransmitter();
    transmitterRef.current = transmitter;
    try {
      // Prepare immediately inside the click gesture so browser autoplay rules
      // cannot block output after the network token request completes.
      await transmitter.prepare();
      await refreshToken(runId, transmitter);
    } catch (startError) {
      if (runIdRef.current !== runId) return;
      setError(startError instanceof Error ? startError.message : 'Unable to start the acoustic broadcast.');
      setState('error');
      await transmitter.stop();
      transmitterRef.current = null;
    }
  }, [capability.supported, refreshToken, sessionActive, sessionId, sessionPaused, stopBroadcast]);

  useEffect(() => {
    if (!sessionActive || sessionPaused || !sessionId) void stopBroadcast(true);
  }, [sessionActive, sessionId, sessionPaused, stopBroadcast]);

  useEffect(() => {
    if (!tokenMeta?.expiresAt) return undefined;
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((tokenMeta.expiresAt - Date.now()) / 1_000)));
    update();
    const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, [tokenMeta?.expiresAt]);

  useEffect(() => () => {
    runIdRef.current += 1;
    clearRefreshTimer();
    void transmitterRef.current?.stop();
    transmitterRef.current = null;
    if (sessionId) void revokeAcousticToken(sessionId).catch(() => undefined);
  }, [clearRefreshTimer, sessionId]);

  const broadcasting = state === 'broadcasting';
  const disabled = !sessionActive || sessionPaused || !sessionId || !capability.supported;

  return (
    <section className="acoustic-panel overflow-hidden rounded-2xl border border-violet-400/30 bg-ink-850/70 p-4 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-violet-300/30 bg-violet-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-violet-200">Alpha</span>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">Acoustic Broadcast</h3>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Start a session, then broadcast the audible digital tone for nearby students.</p>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] ${broadcasting ? 'border-violet-300/40 bg-violet-400/10 text-violet-200' : 'border-ink-border bg-ink-900 text-slate-500'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${broadcasting ? 'animate-pulse bg-violet-300' : 'bg-slate-600'}`} />
          {state === 'starting' ? 'Starting' : broadcasting ? 'Broadcasting' : 'Stopped'}
        </div>
      </div>

      <div className="relative mx-auto my-5 grid h-48 w-48 place-items-center" aria-hidden="true">
        {broadcasting && <><span className="acoustic-radar-ring"/><span className="acoustic-radar-ring acoustic-radar-ring-delay-1"/><span className="acoustic-radar-ring acoustic-radar-ring-delay-2"/></>}
        <div className={`relative z-10 grid h-24 w-24 place-items-center rounded-full border ${broadcasting ? 'border-violet-200/60 bg-violet-400/20 shadow-[0_0_55px_rgba(167,139,250,0.38)]' : 'border-ink-border bg-ink-900'}`}>
          {state === 'starting' ? <RefreshCw size={34} className="animate-spin text-violet-300"/> : broadcasting ? <AudioLines size={38} className="text-violet-200"/> : <Radio size={36} className="text-slate-600"/>}
        </div>
      </div>

      {broadcasting && (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-lg border border-violet-300/20 bg-violet-400/5 px-3 py-2 text-[10px] text-violet-200">
          <Volume2 size={13}/>
          Audible tone active · secure token refresh in {secondsLeft}s · generation {tokenMeta?.generationId?.slice(0, 6) ?? '—'}
        </div>
      )}

      {!capability.supported && <p className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-[11px] text-amber-200">{capability.reason} Beta QR still available.</p>}
      {sessionPaused && <p className="mb-4 text-center text-[11px] text-amber-300">Session paused. Acoustic broadcast automatically stopped.</p>}
      {error && <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-[11px] text-red-200"><TriangleAlert size={14} className="mt-0.5 shrink-0"/>{error}</div>}

      {broadcasting ? (
        <button type="button" onClick={() => void stopBroadcast(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 py-2.5 text-xs font-semibold text-red-200 transition hover:bg-red-400/20"><Square size={13} fill="currentColor"/>Stop Alpha Broadcast</button>
      ) : (
        <button type="button" disabled={disabled || state === 'starting'} onClick={() => void startBroadcast()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-950/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"><Radio size={15}/>Start Alpha Broadcast</button>
      )}
    </section>
  );
}
