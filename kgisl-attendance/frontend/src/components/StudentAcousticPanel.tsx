import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, MapPin, Mic, QrCode, Radio, RotateCcw, ShieldAlert, Waves } from 'lucide-react';
import { AcousticReceiver } from '../features/acoustic/AcousticReceiver';
import { getReceiverCapability } from '../features/acoustic/capabilities';
import { submitAcousticAttendance, type AcousticAttendanceResult } from '../features/acoustic/acousticApi';
import { getStableDeviceId, startAccurateLocation, type LocationTask } from '../features/acoustic/location';

type ListenState = 'idle' | 'requesting' | 'listening' | 'decoded' | 'submitting' | 'success' | 'error';

type StudentAcousticPanelProps = {
  onUseQr: () => void;
};

type ApiLikeError = {
  code?: string;
  message?: string;
  response?: { data?: { code?: string; message?: string } };
};

const ERROR_MESSAGES: Record<string, string> = {
  ACOUSTIC_TOKEN_EXPIRED: 'The signal token has expired. Move closer to the active faculty broadcast and try again.',
  ACOUSTIC_TOKEN_INVALID: 'A valid classroom acoustic signal could not be decoded.',
  ACOUSTIC_TOKEN_INVALID_OR_EXPIRED: 'The signal token is invalid or expired. Retry with the active Alpha broadcast.',
  ATTENDANCE_ALREADY_MARKED: 'Your attendance has already been marked.',
  OUTSIDE_ALLOWED_LOCATION: 'You are outside the permitted classroom location.',
  GPS_ACCURACY_TOO_LOW: 'GPS accuracy is too low. Enable precise location and try again.',
  GPS_REQUIRED: 'Precise location permission is required to mark attendance.',
  DEVICE_NOT_AUTHORIZED: 'This device is not authorised for your account. Contact a faculty member or administrator.',
  SESSION_NOT_ACTIVE: 'There is no active attendance session. Check with your faculty member.',
  RATE_LIMITED: 'Too many attempts. Wait briefly and try again.',
};

function readableError(error: unknown): { code: string; message: string } {
  const typed = (error ?? {}) as ApiLikeError;
  const code = typed.code ?? typed.response?.data?.code ?? '';
  return {
    code,
    message: ERROR_MESSAGES[code] ?? typed.message ?? typed.response?.data?.message ?? 'Unable to complete Alpha attendance.',
  };
}

export default function StudentAcousticPanel({ onUseQr }: StudentAcousticPanelProps) {
  const receiverRef = useRef<AcousticReceiver | null>(null);
  const locationRef = useRef<LocationTask | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const submissionLockedRef = useRef(false);
  const mountedRef = useRef(true);
  const [state, setState] = useState<ListenState>('idle');
  const [message, setMessage] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [level, setLevel] = useState(0);
  const [locationText, setLocationText] = useState('GPS waiting');
  const [result, setResult] = useState<AcousticAttendanceResult | null>(null);
  const capability = useMemo(() => getReceiverCapability(), []);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  }, []);

  const cleanup = useCallback((cancelLocation = true) => {
    clearTimer();
    void receiverRef.current?.stop();
    receiverRef.current = null;
    if (cancelLocation) locationRef.current?.cancel();
    if (cancelLocation) locationRef.current = null;
    setLevel(0);
  }, [clearTimer]);

  const fail = useCallback((error: unknown) => {
    if (!mountedRef.current) return;
    const readable = readableError(error);
    cleanup(true);
    submissionLockedRef.current = false;
    setErrorCode(readable.code);
    setMessage(readable.message);
    setState('error');
  }, [cleanup]);

  const handleToken = useCallback(async (token: string) => {
    if (submissionLockedRef.current || !locationRef.current) return;
    submissionLockedRef.current = true;
    clearTimer();
    setState('decoded');
    setMessage('Signal decoded. Verifying GPS location…');
    void receiverRef.current?.stop();
    receiverRef.current = null;
    try {
      const gps = await locationRef.current.promise;
      if (!mountedRef.current) return;
      setState('submitting');
      setMessage('Securely marking attendance…');
      const attendance = await submitAcousticAttendance({ token, deviceId: getStableDeviceId(), gps });
      if (!mountedRef.current) return;
      locationRef.current = null;
      setResult(attendance);
      setMessage('');
      setState('success');
      if ('vibrate' in navigator) navigator.vibrate?.([100, 45, 180]);
    } catch (error) {
      fail(error);
    }
  }, [clearTimer, fail]);

  const startListening = useCallback(async () => {
    if (!capability.supported) {
      setMessage(capability.reason);
      setState('error');
      return;
    }
    cleanup(true);
    submissionLockedRef.current = false;
    setResult(null);
    setErrorCode('');
    setMessage('Preparing microphone and GPS…');
    setLocationText('GPS starting');
    setState('requesting');

    const locationTask = startAccurateLocation(({ accuracy, samples }) => {
      if (mountedRef.current) setLocationText(`GPS ±${Math.round(accuracy)} m · sample ${samples}`);
    });
    // Surface an early GPS denial immediately instead of listening for a token
    // that cannot be submitted. Once a token is decoded, handleToken owns it.
    void locationTask.promise.catch((locationError: unknown) => {
      const code = (locationError as { code?: string })?.code;
      if (code !== 'LOCATION_CANCELLED' && !submissionLockedRef.current) fail(locationError);
    });
    locationRef.current = locationTask;

    const receiver = new AcousticReceiver();
    receiverRef.current = receiver;
    try {
      await receiver.start({
        onLevel: (nextLevel) => mountedRef.current && setLevel(nextLevel),
        onToken: (token) => void handleToken(token),
      });
      if (!mountedRef.current || receiverRef.current !== receiver) return;
      setState('listening');
      setMessage('Listening for the faculty Alpha signal…');
      timeoutRef.current = window.setTimeout(() => {
        fail({ code: 'DECODE_TIMEOUT', message: 'No signal was detected within 15 seconds. Move closer to the faculty speaker or use Beta QR.' });
      }, 15_000);
    } catch (error) {
      fail(error);
    }
  }, [capability, cleanup, fail, handleToken]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup(true);
    };
  }, [cleanup]);

  const listening = state === 'requesting' || state === 'listening';
  const bars = [0.55, 0.9, 0.7, 1, 0.62, 0.82, 0.5];

  if (state === 'success' && result) {
    return (
      <div className="relative overflow-hidden py-3 text-center">
        <div className="acoustic-confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <span key={index}/>)}</div>
        <div className="mx-auto grid h-28 w-28 place-items-center rounded-full border-4 border-emerald-300/50 bg-emerald-400/20 shadow-[0_0_70px_rgba(52,211,153,0.35)]">
          <Check size={62} strokeWidth={3} className="text-emerald-300"/>
        </div>
        <h2 className="mt-5 text-2xl font-bold text-white">Present!</h2>
        <p className="mt-1 text-sm font-medium text-emerald-300">Alpha attendance marked successfully</p>
        <div className="mt-5 space-y-2 rounded-xl border border-emerald-300/20 bg-emerald-400/5 p-4 text-left text-xs">
          <ResultRow label="Student" value={`${result.studentName} · ${result.rollNo}`}/>
          <ResultRow label="Subject" value={result.subjectName}/>
          <ResultRow label="Method" value="Acoustic · Alpha"/>
          <ResultRow label="Time" value={new Date(result.markedAt).toLocaleTimeString()}/>
          {result.distanceMeters !== undefined && <ResultRow label="Distance" value={`${result.distanceMeters} m`}/>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="relative mx-auto grid h-56 w-56 place-items-center" aria-hidden="true">
        {listening && <><span className="acoustic-listen-ring"/><span className="acoustic-listen-ring acoustic-listen-ring-delay"/></>}
        <div className={`relative z-10 grid h-28 w-28 place-items-center rounded-full border transition ${listening ? 'border-cyan-200/60 bg-cyan-400/15 shadow-[0_0_65px_rgba(34,211,238,0.3)]' : 'border-ink-border bg-ink-900'}`}>
          {state === 'requesting' ? <Loader2 size={42} className="animate-spin text-cyan-300"/> : listening ? <Mic size={45} className="text-cyan-200"/> : <Radio size={44} className="text-slate-600"/>}
        </div>
      </div>

      {state === 'listening' && (
        <div className="mx-auto -mt-4 mb-4 flex h-10 items-center justify-center gap-1" aria-label="Live microphone level">
          {bars.map((scale, index) => <span key={index} className="w-1.5 rounded-full bg-cyan-300 transition-all duration-75" style={{ height: `${Math.max(5, level * 38 * scale)}px` }}/>) }
        </div>
      )}

      {(listening || state === 'decoded' || state === 'submitting') && (
        <div className="space-y-2 text-center">
          <p className="text-sm text-slate-300">{message}</p>
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500"><MapPin size={12}/>{locationText}</p>
        </div>
      )}

      {state === 'idle' && (
        <div className="text-center">
          <p className="text-sm text-slate-400">Stay near the faculty device while Alpha detects the high-frequency signal.</p>
          <button type="button" disabled={!capability.supported} onClick={() => void startListening()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-950/20 transition hover:brightness-110 disabled:opacity-40"><Waves size={18}/>Listen & Mark Present</button>
        </div>
      )}

      {(state === 'decoded' || state === 'submitting') && <div className="mt-4 flex justify-center"><Loader2 size={24} className="animate-spin text-emerald-300"/></div>}

      {state === 'error' && (
        <div className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-center">
          <ShieldAlert size={24} className="mx-auto text-red-300"/>
          <p className="mt-2 text-xs leading-relaxed text-red-200">{message}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {capability.supported && <button type="button" onClick={() => void startListening()} className="flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 py-2 text-xs text-white"><RotateCcw size={13}/>Retry Alpha</button>}
            <button type="button" onClick={() => { cleanup(true); onUseQr(); }} className={`${capability.supported ? '' : 'col-span-2'} flex items-center justify-center gap-1.5 rounded-lg bg-signal-red py-2 text-xs font-semibold text-white`}><QrCode size={13}/>Use Beta QR</button>
          </div>
          {errorCode === 'MIC_PERMISSION_DENIED' && <p className="mt-3 text-[10px] text-slate-500">Allow microphone access in your browser settings, then retry Alpha.</p>}
        </div>
      )}
    </div>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4"><span className="text-slate-500">{label}</span><span className="text-right font-medium text-slate-200">{value}</span></div>;
}
