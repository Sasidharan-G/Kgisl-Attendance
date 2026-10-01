import { useCallback, useEffect, useRef, useState } from 'react';
import { Bluetooth, BluetoothOff, RefreshCw, Square, TriangleAlert } from 'lucide-react';
import {
  getHelperStatus,
  issueBeaconPacket,
  listBeacons,
  sendPacketToHelper,
  type BeaconPacketIssue,
  type ClassroomBeacon,
} from '../features/beacon/beaconApi';

type BroadcastState = 'idle' | 'starting' | 'broadcasting' | 'error';

type BeaconBroadcastPanelProps = {
  sessionId?: string | null;
  roomId?: string | null;
  sessionActive: boolean;
  sessionPaused: boolean;
};

const HELPER_KEY_STORAGE = 'kgisl_helper_key';

function readStoredKey(): string {
  try { return localStorage.getItem(HELPER_KEY_STORAGE) ?? ''; } catch { return ''; }
}

export default function BeaconBroadcastPanel({ sessionId, roomId, sessionActive, sessionPaused }: BeaconBroadcastPanelProps) {
  const refreshTimerRef = useRef<number | null>(null);
  const runIdRef = useRef(0);
  const [state, setState] = useState<BroadcastState>('idle');
  const [error, setError] = useState('');
  const [helperKey, setHelperKey] = useState(readStoredKey);
  const [beacons, setBeacons] = useState<ClassroomBeacon[]>([]);
  const [beaconId, setBeaconId] = useState<number | null>(null);
  const [lastIssue, setLastIssue] = useState<BeaconPacketIssue | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const roomBeacons = beacons.filter((beacon) => beacon.enabled && (!roomId || beacon.roomId === roomId));

  useEffect(() => {
    let cancelled = false;
    listBeacons().then((rows) => { if (!cancelled) setBeacons(rows); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (roomBeacons.length > 0 && !roomBeacons.some((beacon) => beacon.beaconId === beaconId)) {
      setBeaconId(roomBeacons[0].beaconId);
    }
    // roomBeacons is derived from beacons/roomId, so depend on its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beacons, roomId]);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = null;
  }, []);

  const stopBroadcast = useCallback(() => {
    // The ESP32 firmware stops advertising on its own 35 s after the last packet.
    runIdRef.current += 1;
    clearRefreshTimer();
    setLastIssue(null);
    setSecondsLeft(0);
    setState('idle');
  }, [clearRefreshTimer]);

  const pushPacket = useCallback(async (runId: number, key: string, beacon: number) => {
    if (!sessionId || runIdRef.current !== runId) return;
    const issue = await issueBeaconPacket(sessionId, beacon);
    if (runIdRef.current !== runId) return;
    await sendPacketToHelper(key, issue);
    if (runIdRef.current !== runId) return;
    setLastIssue(issue);
    setState('broadcasting');
    const latestSafeRefresh = Math.max(1_000, issue.expiresAt - Date.now() - 4_000);
    const delay = Math.max(1_000, Math.min(issue.refreshAfterMs, latestSafeRefresh));
    clearRefreshTimer();
    refreshTimerRef.current = window.setTimeout(() => {
      void pushPacket(runId, key, beacon).catch((refreshError: unknown) => {
        if (runIdRef.current !== runId) return;
        setError(refreshError instanceof Error ? refreshError.message : 'Beacon refresh failed.');
        setState('error');
      });
    }, delay);
  }, [clearRefreshTimer, sessionId]);

  const startBroadcast = useCallback(async () => {
    if (!sessionId || !sessionActive || sessionPaused || beaconId === null) return;
    clearRefreshTimer();
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setState('starting');
    setError('');
    try {
      const key = helperKey.trim();
      await getHelperStatus(key);
      try { localStorage.setItem(HELPER_KEY_STORAGE, key); } catch { /* storage unavailable */ }
      await pushPacket(runId, key, beaconId);
    } catch (startError) {
      if (runIdRef.current !== runId) return;
      setError(startError instanceof Error ? startError.message : 'Unable to start the BLE beacon.');
      setState('error');
    }
  }, [beaconId, clearRefreshTimer, helperKey, pushPacket, sessionActive, sessionId, sessionPaused]);

  useEffect(() => {
    if (!sessionActive || sessionPaused || !sessionId) stopBroadcast();
  }, [sessionActive, sessionId, sessionPaused, stopBroadcast]);

  useEffect(() => {
    if (!lastIssue?.expiresAt) return undefined;
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((lastIssue.expiresAt - Date.now()) / 1_000)));
    update();
    const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, [lastIssue?.expiresAt]);

  useEffect(() => () => {
    runIdRef.current += 1;
    clearRefreshTimer();
  }, [clearRefreshTimer]);

  const broadcasting = state === 'broadcasting';
  const disabled = !sessionActive || sessionPaused || !sessionId || beaconId === null || helperKey.trim().length < 32;

  return (
    <section className="overflow-hidden rounded-2xl border border-sky-400/30 bg-ink-850/70 p-4 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-sky-300/30 bg-sky-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-sky-200">BLE</span>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">ESP32 Classroom Beacon</h3>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Relays a signed, rotating packet to the ESP32 via the local helper. Students scan with the Android app.</p>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] ${broadcasting ? 'border-sky-300/40 bg-sky-400/10 text-sky-200' : 'border-ink-border bg-ink-900 text-slate-500'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${broadcasting ? 'animate-pulse bg-sky-300' : 'bg-slate-600'}`} />
          {state === 'starting' ? 'Starting' : broadcasting ? 'Broadcasting' : 'Stopped'}
        </div>
      </div>

      <div className="my-5 grid place-items-center">
        <div className={`grid h-20 w-20 place-items-center rounded-full border ${broadcasting ? 'border-sky-200/60 bg-sky-400/20 shadow-[0_0_45px_rgba(56,189,248,0.35)]' : 'border-ink-border bg-ink-900'}`}>
          {state === 'starting' ? <RefreshCw size={30} className="animate-spin text-sky-300" /> : broadcasting ? <Bluetooth size={32} className="text-sky-200" /> : <BluetoothOff size={30} className="text-slate-600" />}
        </div>
      </div>

      {broadcasting && (
        <p className="mb-4 rounded-lg border border-sky-300/20 bg-sky-400/5 px-3 py-2 text-center text-[10px] text-sky-200">
          Beacon #{lastIssue?.beaconId} active · packet refresh in {secondsLeft}s · generation {lastIssue?.generationId?.slice(0, 6) ?? '—'}
        </p>
      )}

      <div className="mb-4 grid gap-3">
        <label className="grid gap-1 text-[10px] uppercase tracking-wide text-slate-500">
          Beacon
          <select
            value={beaconId ?? ''}
            onChange={(event) => setBeaconId(Number(event.target.value))}
            disabled={broadcasting || roomBeacons.length === 0}
            className="rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-xs normal-case text-slate-200"
          >
            {roomBeacons.length === 0 && <option value="">No beacon registered for this room</option>}
            {roomBeacons.map((beacon) => <option key={beacon.id} value={beacon.beaconId}>#{beacon.beaconId} · {beacon.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-[10px] uppercase tracking-wide text-slate-500">
          Helper key
          <input
            type="password"
            value={helperKey}
            onChange={(event) => setHelperKey(event.target.value)}
            disabled={broadcasting}
            placeholder="HELPER_API_KEY from smartboard-helper"
            autoComplete="off"
            className="rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-xs normal-case text-slate-200 placeholder:text-slate-600"
          />
        </label>
      </div>

      {sessionPaused && <p className="mb-4 text-center text-[11px] text-amber-300">Session paused. Beacon packets stopped; the ESP32 goes silent within 35 s.</p>}
      {error && <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-[11px] text-red-200"><TriangleAlert size={14} className="mt-0.5 shrink-0" />{error}</div>}

      {broadcasting ? (
        <button type="button" onClick={stopBroadcast} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 py-2.5 text-xs font-semibold text-red-200 transition hover:bg-red-400/20"><Square size={13} fill="currentColor" />Stop BLE Beacon</button>
      ) : (
        <button type="button" disabled={disabled || state === 'starting'} onClick={() => void startBroadcast()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-sky-950/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"><Bluetooth size={15} />Start BLE Beacon</button>
      )}
    </section>
  );
}
