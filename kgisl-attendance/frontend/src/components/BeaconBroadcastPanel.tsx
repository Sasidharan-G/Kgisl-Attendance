import { useCallback, useEffect, useRef, useState } from 'react';
import { Bluetooth, BluetoothOff, Check, CircleDashed, KeyRound, Loader2, Square, TriangleAlert } from 'lucide-react';
import {
  connectHelper,
  getHelperStatus,
  issueBeaconPacket,
  listBeacons,
  revokeBeaconPacket,
  sendPacketToHelper,
  type BeaconPacketIssue,
  type ClassroomBeacon,
} from '../features/beacon/beaconApi';
import { readHelperKey, saveHelperKey } from '../features/beacon/helperKey';

type BroadcastState = 'idle' | 'starting' | 'broadcasting' | 'error';
type StepState = 'pending' | 'active' | 'done';

type BeaconBroadcastPanelProps = {
  sessionId?: string | null;
  roomId?: string | null;
  sessionActive: boolean;
  sessionPaused: boolean;
};

const AUTOSTART_STORAGE = 'kgisl_beacon_autostart';
const MAX_REFRESH_RETRIES = 3;
const STEP_LABELS = ['Classroom helper connected', 'ESP32 beacon ready', 'Signed packet broadcasting'] as const;

function readAutoStart(): boolean {
  try { return localStorage.getItem(AUTOSTART_STORAGE) !== 'off'; } catch { return true; }
}

function StepIcon({ state }: { state: StepState }) {
  if (state === 'done') return <Check size={13} className="text-sky-300" />;
  if (state === 'active') return <Loader2 size={13} className="animate-spin text-sky-300" />;
  return <CircleDashed size={13} className="text-slate-600" />;
}

export default function BeaconBroadcastPanel({ sessionId, roomId, sessionActive, sessionPaused }: BeaconBroadcastPanelProps) {
  const refreshTimerRef = useRef<number | null>(null);
  const runIdRef = useRef(0);
  const autoStartedForRef = useRef<string | null>(null);
  const [state, setState] = useState<BroadcastState>('idle');
  const [step, setStep] = useState(0); // 0..3: how many of the three start-up steps are finished
  const [error, setError] = useState('');
  const [helperKey, setHelperKey] = useState(readHelperKey);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [autoStart, setAutoStart] = useState(readAutoStart);
  const [beacons, setBeacons] = useState<ClassroomBeacon[]>([]);
  const [beaconId, setBeaconId] = useState<number | null>(null);
  const [lastIssue, setLastIssue] = useState<BeaconPacketIssue | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const roomBeacons = beacons.filter((beacon) => beacon.enabled && (!roomId || beacon.roomId === roomId));
  const hasKey = helperKey.trim().length >= 32;

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
    // The ESP32 firmware stops advertising on its own 35 s after the last packet;
    // revoking server-side invalidates the in-air packet immediately.
    runIdRef.current += 1;
    if (sessionId) void revokeBeaconPacket(sessionId).catch(() => undefined);
    clearRefreshTimer();
    setLastIssue(null);
    setSecondsLeft(0);
    setStep(0);
    setState('idle');
  }, [clearRefreshTimer, sessionId]);

  const pushPacket = useCallback(async (runId: number, key: string, beacon: number, refresh = false, retry = 0): Promise<void> => {
    if (!sessionId || runIdRef.current !== runId) return;
    try {
      const issue = await issueBeaconPacket(sessionId, beacon);
      if (runIdRef.current !== runId) return;
      await sendPacketToHelper(key, issue);
      if (runIdRef.current !== runId) return;
      setLastIssue(issue);
      setError('');
      setStep(3);
      setState('broadcasting');
      const latestSafeRefresh = Math.max(1_000, issue.expiresAt - Date.now() - 4_000);
      const delay = Math.max(1_000, Math.min(issue.refreshAfterMs, latestSafeRefresh));
      clearRefreshTimer();
      refreshTimerRef.current = window.setTimeout(() => { void pushPacket(runId, key, beacon, true); }, delay);
    } catch (pushError) {
      if (runIdRef.current !== runId) return;
      // First start: surface the problem immediately (wrong key, helper off, ESP32 unplugged).
      if (!refresh) throw pushError;
      // A refresh hiccup (Wi-Fi blip, ESP32 re-enumerating) should not kill a running class:
      // retry quickly while the packet already in the air is still valid.
      if (retry < MAX_REFRESH_RETRIES) {
        clearRefreshTimer();
        refreshTimerRef.current = window.setTimeout(() => { void pushPacket(runId, key, beacon, true, retry + 1); }, 1_500);
        return;
      }
      clearRefreshTimer();
      setError(pushError instanceof Error ? pushError.message : 'Beacon refresh failed.');
      setState('error');
    }
  }, [clearRefreshTimer, sessionId]);

  const startBroadcast = useCallback(async () => {
    if (!sessionId || !sessionActive || sessionPaused || beaconId === null) return;
    clearRefreshTimer();
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setState('starting');
    setError('');
    setStep(0);
    const key = helperKey.trim();
    try {
      await getHelperStatus(key); // step 1: helper reachable + key accepted
      if (runIdRef.current !== runId) return;
      saveHelperKey(key);
      setShowKeyInput(false);
      setStep(1);
      await connectHelper(key); // step 2: helper opens the ESP32 (rejects with a clear reason if unplugged)
      if (runIdRef.current !== runId) return;
      setStep(2);
      await pushPacket(runId, key, beaconId); // step 3 completes inside pushPacket
    } catch (startError) {
      if (runIdRef.current !== runId) return;
      setError(startError instanceof Error ? startError.message : 'Unable to start the BLE beacon.');
      setState('error');
    }
  }, [beaconId, clearRefreshTimer, helperKey, pushPacket, sessionActive, sessionId, sessionPaused]);

  useEffect(() => {
    if (!sessionActive || sessionPaused || !sessionId) stopBroadcast();
  }, [sessionActive, sessionId, sessionPaused, stopBroadcast]);

  // One-click flow: when a session goes live and the helper is paired, start the beacon by itself.
  useEffect(() => {
    if (!autoStart || !hasKey || state !== 'idle') return;
    if (!sessionActive || sessionPaused || !sessionId || beaconId === null) return;
    if (autoStartedForRef.current === sessionId) return;
    autoStartedForRef.current = sessionId;
    void startBroadcast();
  }, [autoStart, beaconId, hasKey, sessionActive, sessionId, sessionPaused, startBroadcast, state]);

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

  const toggleAutoStart = (value: boolean) => {
    setAutoStart(value);
    try { localStorage.setItem(AUTOSTART_STORAGE, value ? 'on' : 'off'); } catch { /* storage unavailable */ }
  };

  const broadcasting = state === 'broadcasting';
  const starting = state === 'starting';
  const needsKey = !hasKey || showKeyInput;
  const disabled = !sessionActive || sessionPaused || !sessionId || beaconId === null || !hasKey;
  const stepState = (index: number): StepState => (step > index ? 'done' : starting && step === index ? 'active' : 'pending');

  return (
    <section className="overflow-hidden rounded-2xl border border-sky-400/30 bg-ink-850/70 p-4 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-sky-300/30 bg-sky-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.2em] text-sky-200">Alpha</span>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-300">BLE Classroom Beacon</h3>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">One click starts everything. Students mark attendance from this site in Chrome (Alpha · BLE).</p>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] ${broadcasting ? 'border-sky-300/40 bg-sky-400/10 text-sky-200' : 'border-ink-border bg-ink-900 text-slate-500'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${broadcasting ? 'animate-pulse bg-sky-300' : 'bg-slate-600'}`} />
          {starting ? 'Starting' : broadcasting ? 'Live' : 'Stopped'}
        </div>
      </div>

      <div className="my-5 grid place-items-center">
        <div className={`grid h-20 w-20 place-items-center rounded-full border transition ${broadcasting ? 'border-sky-200/60 bg-sky-400/20 shadow-[0_0_45px_rgba(56,189,248,0.35)]' : 'border-ink-border bg-ink-900'}`}>
          {starting ? <Loader2 size={30} className="animate-spin text-sky-300" /> : broadcasting ? <Bluetooth size={32} className="text-sky-200" /> : <BluetoothOff size={30} className="text-slate-600" />}
        </div>
      </div>

      {(starting || broadcasting) && (
        <ul className="mb-4 grid gap-1.5 rounded-lg border border-sky-300/15 bg-sky-400/5 px-3 py-2.5 text-[11px] text-slate-300" aria-live="polite">
          {STEP_LABELS.map((label, index) => (
            <li key={label} className="flex items-center gap-2"><StepIcon state={stepState(index)} />{label}</li>
          ))}
        </ul>
      )}

      {broadcasting && (
        <p className="mb-4 rounded-lg border border-sky-300/20 bg-sky-400/5 px-3 py-2 text-center text-[10px] text-sky-200">
          Beacon #{lastIssue?.beaconId} live · next packet in {secondsLeft}s · generation {lastIssue?.generationId?.slice(0, 6) ?? '—'}
        </p>
      )}

      {roomBeacons.length > 1 && (
        <label className="mb-4 grid gap-1 text-[10px] uppercase tracking-wide text-slate-500">
          Beacon
          <select
            value={beaconId ?? ''}
            onChange={(event) => setBeaconId(Number(event.target.value))}
            disabled={broadcasting || starting}
            className="rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-xs normal-case text-slate-200"
          >
            {roomBeacons.map((beacon) => <option key={beacon.id} value={beacon.beaconId}>#{beacon.beaconId} · {beacon.name}</option>)}
          </select>
        </label>
      )}
      {roomBeacons.length === 0 && <p className="mb-4 text-center text-[11px] text-amber-300">No beacon is registered for this room. Admin: Academic Setup → Classroom BLE Beacons.</p>}

      {needsKey && !broadcasting && (
        <label className="mb-4 grid gap-1 text-[10px] uppercase tracking-wide text-slate-500">
          <span className="flex items-center gap-1"><KeyRound size={11} />Pair classroom helper (one time)</span>
          <input
            type="password"
            value={helperKey}
            onChange={(event) => setHelperKey(event.target.value)}
            placeholder="Paste the key shown in the helper window"
            autoComplete="off"
            className="rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-xs normal-case text-slate-200 placeholder:text-slate-600"
          />
          <span className="text-[10px] normal-case text-slate-600">Tip: opening the site with start-classroom.bat pairs it automatically.</span>
        </label>
      )}

      {sessionPaused && <p className="mb-4 text-center text-[11px] text-amber-300">Session paused. Beacon packets stopped; the ESP32 goes silent within 35 s.</p>}
      {error && <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-[11px] text-red-200"><TriangleAlert size={14} className="mt-0.5 shrink-0" />{error}</div>}

      {broadcasting ? (
        <button type="button" onClick={stopBroadcast} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-400/10 py-2.5 text-xs font-semibold text-red-200 transition hover:bg-red-400/20"><Square size={13} fill="currentColor" />Stop BLE Beacon</button>
      ) : (
        <button type="button" disabled={disabled || starting} onClick={() => void startBroadcast()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-sky-950/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
          {starting ? <Loader2 size={15} className="animate-spin" /> : <Bluetooth size={15} />}{starting ? 'Starting…' : state === 'error' ? 'Retry BLE Beacon' : 'Start BLE Beacon'}
        </button>
      )}

      <div className="mt-4 flex items-center justify-between gap-3 text-[10px] text-slate-500">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={autoStart} onChange={(event) => toggleAutoStart(event.target.checked)} className="h-3 w-3 accent-sky-400" />
          Auto-start when a session begins
        </label>
        {hasKey && !broadcasting && (
          <button type="button" onClick={() => setShowKeyInput((value) => !value)} className="text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline">{showKeyInput ? 'Hide key' : 'Change helper key'}</button>
        )}
      </div>
    </section>
  );
}
