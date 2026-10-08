import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  CheckCircle2,
  XCircle,
  ScanLine,
  LogOut,
  MapPin,
  Loader2,
  Camera,
  ShieldAlert,
  History,
  CalendarCheck,
  Bluetooth,
  QrCode,
  Smartphone,
  Fingerprint,
  Radar,
  Square,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { submitScan, submitBeaconScan, getSessionPublicInfo } from '../services/api.js';
import { BLE_UNSUPPORTED_MESSAGES, bleSupport, isPacketFresh, selectBeaconDevice, watchBeacon } from '../features/beacon/webBle.js';
import { createLocationTracker } from '../utils/locationFix.js';
import { enrollPasskey, getPasskeyAssertion, getPasskeyStatus, passkeySupported } from '../utils/passkey.js';

/**
 * Stable per-browser device fingerprint (persisted in localStorage).
 * Used as ONE of several verification layers — not as the sole auth factor.
 */
function getDeviceId() {
  let id = localStorage.getItem('kgisl_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('kgisl_device_id', id);
  }
  return id;
}

/** Map backend error codes to clear, student-facing messages. */
function mapErrorCode(code, fallbackMessage) {
  const messages = {
    QR_EXPIRED: 'QR code has expired. Scan the latest QR shown by your faculty.',
    INVALID_QR_SIGNATURE: 'Invalid QR code. Please scan the QR displayed on the screen.',
    TOKEN_REVOKED: 'This QR code is no longer valid. Scan the latest one.',
    TOKEN_ALREADY_USED: 'This QR code has already been used.',
    ATTENDANCE_ALREADY_MARKED: 'Your attendance has already been marked for this session.',
    BATCH_MISMATCH: 'You are not enrolled in this session\'s batch.',
    SUBJECT_MISMATCH: 'Subject does not match this session.',
    OUTSIDE_ALLOWED_LOCATION: 'You are outside the allowed attendance location.',
    DEVICE_NOT_AUTHORIZED: 'This device is not authorised for your account. Contact your administrator.',
    GPS_ACCURACY_TOO_LOW: 'GPS accuracy is too low. Move to an open area and try again.',
    GPS_REQUIRED: 'Location access is required to mark attendance.',
    SESSION_NOT_ACTIVE: 'This attendance session is no longer active.',
    OUTSIDE_TIME_WINDOW: 'Attendance window has closed for this session.',
    RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
    PASSKEY_REQUIRED: 'Confirm with Face ID / Touch ID to mark attendance.',
    PASSKEY_INVALID: 'Face ID / Touch ID verification failed. Make sure you are on the phone you set up, then try again.',
    PASSKEY_CHALLENGE_EXPIRED: 'The Face ID check timed out. Tap Start Scanning and confirm again.',
    PASSKEY_CANCELLED: 'Face ID / Touch ID was cancelled. Tap Start Scanning and confirm again.',
    DEVICE_ALREADY_BOUND: 'This account is already linked to another device. Ask your faculty to reset it first.',
    VALIDATION_ERROR: 'Request could not be processed. Please try scanning again.',
    BEACON_PACKET_INVALID_OR_EXPIRED: 'The classroom beacon signal expired. Stay in class; the next signal will be used.',
    BEACON_TOKEN_INVALID_OR_EXPIRED: 'The classroom beacon signal expired. Stay in class; the next signal will be used.',
    BEACON_NOT_FOUND: 'This classroom beacon is not registered. Inform your faculty.',
    BEACON_ROOM_MISMATCH: "This beacon does not belong to this session's classroom.",
    BEACON_SIGNAL_TOO_WEAK: 'Beacon signal is too weak. Move closer to the classroom board.',
    BLE_TIMEOUT: 'Classroom beacon not detected. Make sure your faculty has started attendance, Bluetooth and Location are on, and you are inside the class.',
  };
  return messages[code] || fallbackMessage || 'Something went wrong. Try scanning again.';
}

// Failures that can clear up on the next beacon signal, so the scan keeps running.
const BLE_TRANSIENT_CODES = new Set([
  'BEACON_PACKET_INVALID_OR_EXPIRED',
  'BEACON_TOKEN_INVALID_OR_EXPIRED',
  'BEACON_SIGNAL_TOO_WEAK',
  'GPS_ACCURACY_TOO_LOW',
]);
const BLE_SCAN_TIMEOUT_MS = 60_000;
const ANDROID_APK_URL = 'https://github.com/Sasidharan-G/Kgisl-Attendance/releases/latest/download/KGiSL-Attendance.apk';

// Scan status states
// idle | scanning | locating | submitting | success | error
export default function StudentScanPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));
  const rafRef = useRef(null);
  // Warm GPS tracker: started with the camera so a precise fix is ready when the QR is decoded.
  const locationRef = useRef(null);
  if (!locationRef.current) locationRef.current = createLocationTracker();

  // Duplicate-scan prevention: store the last submitted token & submission in-flight flag
  const lastScannedTokenRef = useRef(null);
  const isSubmittingRef = useRef(false);

  const [status, setStatus] = useState('idle');
  const [cameraError, setCameraError] = useState('');
  const [message, setMessage] = useState('');
  const [successData, setSuccessData] = useState(null); // from backend response
  const [errorCode, setErrorCode] = useState('');
  // Alpha (BLE) needs the Android app; the browser only supports Beta (QR). The
  // camera does not start until the student taps the action and accepts the notice.
  const [attendanceMode, setAttendanceMode] = useState('alpha');
  const [showConsent, setShowConsent] = useState(false);
  const [pendingMode, setPendingMode] = useState(null);
  // Device binding: 'none' (can enrol a passkey), 'passkey' (Face ID per scan) or 'device' (bound to the mobile app).
  const [passkeyStatus, setPasskeyStatus] = useState(null);
  const [enrolling, setEnrolling] = useState(false);
  const [passkeyError, setPasskeyError] = useState('');
  const passkeyRef = useRef(null); // one-time Face ID assertion held between the tap and the QR decode
  const bleWatchRef = useRef(null);
  const bleTimeoutRef = useRef(null);
  const bleSubmittedRef = useRef(new Set());
  const bleStatus = bleSupport();
  const bleSupported = bleStatus.ok;
  const supported = passkeySupported();

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const stream = videoRef.current?.srcObject;
    stream?.getTracks()?.forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const stopBle = useCallback(() => {
    if (bleTimeoutRef.current) window.clearTimeout(bleTimeoutRef.current);
    bleTimeoutRef.current = null;
    bleWatchRef.current?.stop();
    bleWatchRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPasskeyStatus()
      .then((status) => { if (!cancelled) setPasskeyStatus(status); })
      // If the status check fails, fall back to the legacy device id rather than locking students out.
      .catch(() => { if (!cancelled) setPasskeyStatus({ enrolled: false, boundTo: 'unknown' }); });
    return () => { cancelled = true; };
  }, []);

  // Stop camera on component unmount
  useEffect(() => () => { stopCamera(); stopBle(); locationRef.current.stop(); }, [stopCamera, stopBle]);

  const handleDecoded = useCallback(
    async (rawValue) => {
      // Guard 1: only one submission in-flight at a time
      if (isSubmittingRef.current) return;

      let qrPayload;
      try {
        qrPayload = JSON.parse(rawValue);
      } catch {
        return; // Not valid JSON — keep scanning
      }

      // Guard 2: validate required QR fields exist
      if (
        !qrPayload.sessionId ||
        !qrPayload.token ||
        !qrPayload.issuedAt ||
        !qrPayload.expiresAt ||
        !qrPayload.nonce ||
        !qrPayload.signature
      ) {
        return; // Malformed QR — keep scanning
      }

      // Guard 3: don't re-submit the exact same token (QR is still visible on screen)
      if (lastScannedTokenRef.current === qrPayload.token) return;

      // Lock
      isSubmittingRef.current = true;
      lastScannedTokenRef.current = qrPayload.token;
      stopCamera();

      try {
        // Step A: fetch session public info (batchId + subjectId)
        setStatus('locating');
        setMessage('Looking up session…');

        // Fetch session metadata and GPS together so network latency does not
        // add extra waiting time after the QR has already been decoded.
        const sessionInfoPromise = getSessionPublicInfo(qrPayload.sessionId);

        // Step B: obtain GPS coordinates in parallel
        setMessage('Verifying your location…');
        const locationPromise = locationRef.current.getBest({
          onProgress: (accuracy) => setMessage(`Improving location accuracy… ±${Math.round(accuracy)} m`),
        });
        const [{ data: sessionInfo }, gps] = await Promise.all([sessionInfoPromise, locationPromise]);

        // Step C: submit attendance
        setStatus('submitting');
        setMessage('Marking attendance…');

        // The assertion is single-use: consume it now so a retry always asks for Face ID again.
        const passkey = passkeyRef.current;
        passkeyRef.current = null;
        const response = await submitScan({
          batchId: sessionInfo.batchId,
          subjectId: sessionInfo.subjectId,
          deviceId: getDeviceId(),
          gps, // { lat, lng, accuracy }
          qr: qrPayload, // full signed QR object
          ...(passkey ? { passkey } : {}),
        });

        // Success — show details from the backend response (never from QR)
        setSuccessData(response.data);
        setStatus('success');
        locationRef.current.stop();
        setMessage('');
      } catch (err) {
        const code = err?.code || err?.response?.data?.code || '';
        const fallback = err?.message || err?.response?.data?.message || '';
        setErrorCode(code);
        setMessage(mapErrorCode(code, fallback));
        setStatus('error');
        locationRef.current.stop();
        // Reset lock so the user can retry (but keep lastScannedToken to avoid immediate re-submit)
        isSubmittingRef.current = false;
      }
    },
    [stopCamera]
  );

  const tick = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        handleDecoded(code.data);
        return; // handleDecoded takes over from here
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [handleDecoded]);

  // ---- Alpha: classroom BLE beacon (Web Bluetooth) -------------------------------------------------
  const failBle = useCallback((code, text) => {
    stopBle();
    locationRef.current.stop();
    isSubmittingRef.current = false;
    setErrorCode(code || 'BLE_ERROR');
    setMessage(text);
    setStatus('error');
  }, [stopBle]);

  const handleBeacon = useCallback(async ({ packet, rssi }) => {
    if (isSubmittingRef.current || bleSubmittedRef.current.has(packet)) return;
    if (!isPacketFresh(packet)) return; // stale advertisement still in the air
    bleSubmittedRef.current.add(packet);
    isSubmittingRef.current = true;
    const usedPasskey = Boolean(passkeyRef.current);
    try {
      setStatus('locating');
      setMessage(`Beacon detected (${rssi} dBm). Verifying your location…`);
      const gps = await locationRef.current.getBest({
        onProgress: (accuracy) => setMessage(`Improving location accuracy… ±${Math.round(accuracy)} m`),
      });
      setStatus('submitting');
      setMessage('Marking attendance…');
      const passkey = passkeyRef.current;
      passkeyRef.current = null; // single use: a retry asks for Face ID again
      const response = await submitBeaconScan({
        packet,
        rssi,
        deviceId: getDeviceId(),
        gps,
        ...(passkey ? { passkey } : {}),
      });
      stopBle();
      locationRef.current.stop();
      isSubmittingRef.current = false;
      setSuccessData(response.data);
      setStatus('success');
      setMessage('');
    } catch (err) {
      const code = err?.code || err?.response?.data?.code || '';
      const text = mapErrorCode(code, err?.message || err?.response?.data?.message || '');
      // Same rule as the Android app: weak/expired signals retry on the next beacon packet.
      if (BLE_TRANSIENT_CODES.has(code) && !usedPasskey) {
        bleSubmittedRef.current.delete(packet);
        isSubmittingRef.current = false;
        setStatus('scanning');
        setMessage(`${text} Still scanning…`);
        return;
      }
      failBle(code, text);
    }
  }, [failBle, stopBle]);

  async function startBleScan() {
    if (localStorage.getItem('kgisl_attendance_consent_v1') !== 'accepted') { setPendingMode('ble'); setShowConsent(true); return; }
    stopBle();
    stopCamera();
    passkeyRef.current = null;
    bleSubmittedRef.current = new Set();
    isSubmittingRef.current = false;
    setSuccessData(null);
    setErrorCode('');
    setCameraError('');
    setStatus('scanning');
    setMessage('Choose KGISL-BEACON in the Bluetooth list…');

    let device;
    try {
      device = await selectBeaconDevice(); // runs straight from the tap, as browsers require
    } catch (err) {
      failBle(err.code, err.message);
      return;
    }
    if (passkeyStatus?.boundTo === 'passkey') {
      setMessage('Confirm with Face ID / Touch ID…');
      try {
        passkeyRef.current = await getPasskeyAssertion();
      } catch (err) {
        failBle(err.code || 'PASSKEY_ERROR', mapErrorCode(err.code, err.message));
        return;
      }
    }
    locationRef.current.start(); // warm GPS up so a precise fix is ready when the beacon is seen
    setMessage('Looking for the classroom beacon… Stay inside the class.');
    try {
      bleWatchRef.current = await watchBeacon(device, { onStable: handleBeacon });
    } catch (err) {
      failBle(err.code, err.message);
      return;
    }
    bleTimeoutRef.current = window.setTimeout(() => {
      if (isSubmittingRef.current) return;
      failBle('BLE_TIMEOUT', mapErrorCode('BLE_TIMEOUT'));
    }, BLE_SCAN_TIMEOUT_MS);
  }

  function stopBleScan() {
    stopBle();
    locationRef.current.stop();
    isSubmittingRef.current = false;
    setStatus('idle');
    setMessage('');
  }

  async function startScanning() {
    if (localStorage.getItem('kgisl_attendance_consent_v1') !== 'accepted') { setShowConsent(true); return; }
    passkeyRef.current = null;
    if (passkeyStatus?.boundTo === 'passkey') {
      // Must run straight from the tap: Safari only allows the Face ID prompt during a user gesture.
      setStatus('locating');
      setMessage('Confirm with Face ID / Touch ID…');
      setSuccessData(null);
      setErrorCode('');
      try {
        passkeyRef.current = await getPasskeyAssertion();
      } catch (err) {
        setErrorCode(err.code || 'PASSKEY_ERROR');
        setMessage(mapErrorCode(err.code, err.message));
        setStatus('error');
        return;
      }
    }
    setStatus('scanning');
    setMessage('');
    setCameraError('');
    setSuccessData(null);
    setErrorCode('');
    isSubmittingRef.current = false;
    lastScannedTokenRef.current = null;
    locationRef.current.start();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setCameraError('Camera access is required to scan the attendance QR.');
      setStatus('idle');
    }
  }

  async function handleEnroll() {
    setEnrolling(true);
    setPasskeyError('');
    try {
      await enrollPasskey();
      setPasskeyStatus(await getPasskeyStatus());
    } catch (err) {
      setPasskeyError(mapErrorCode(err.code, err.message));
    } finally {
      setEnrolling(false);
    }
  }

  function handleRetry() {
    // Reset token ref so the same QR can be tried if it was a transient error
    // (e.g. network error) — but not if the error is permanent (duplicate, device).
    const permanentCodes = ['ATTENDANCE_ALREADY_MARKED', 'DEVICE_NOT_AUTHORIZED', 'SESSION_NOT_ACTIVE'];
    if (permanentCodes.includes(errorCode)) {
      // Don't clear lastScannedTokenRef — prevent re-submitting same token
    } else {
      lastScannedTokenRef.current = null;
    }
    if (attendanceMode === 'alpha') startBleScan(); else startScanning();
  }

  function selectAttendanceMode(mode) {
    if (localStorage.getItem('kgisl_attendance_consent_v1') !== 'accepted') { setPendingMode(mode); setShowConsent(true); return; }
    stopCamera();
    stopBle();
    locationRef.current.stop();
    setAttendanceMode(mode);
    setStatus('idle');
    setCameraError('');
    setMessage('');
    setErrorCode('');
    setSuccessData(null);
    isSubmittingRef.current = false;
  }

  const renderIdleGate = (onStart, startLabel) => {
            const bound = passkeyStatus?.boundTo;
            const note = (tone, icon, title, body, action) => (
              <div className={`mt-6 rounded-xl border p-4 ${tone}`}>
                <div className="flex items-start gap-3">
                  {icon}
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-100">{title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{body}</p>
                    {passkeyError && <p className="mt-2 text-xs text-red-300">{passkeyError}</p>}
                  </div>
                </div>
                {action}
              </div>
            );
            if (!passkeyStatus) {
              return <button disabled className="mt-6 w-full rounded-lg bg-signal-red py-2.5 text-sm font-medium text-white opacity-50">Checking device security…</button>;
            }
            if (bound === 'passkey' && !supported) {
              return note('border-amber-500/30 bg-amber-500/10', <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-400" />,
                'Open the secure site to continue', 'Your account is protected with Face ID / Touch ID, which needs the HTTPS site in a modern browser. Open the official attendance link and try again.');
            }
            if (bound === 'device') {
              return note('border-sky-400/30 bg-sky-400/5', <Smartphone size={18} className="mt-0.5 shrink-0 text-sky-300" />,
                'Your account is linked to another phone', 'Attendance for this account can only be marked from the phone it was first linked to. Ask your faculty to reset your device to use this one.');
            }
            if (bound === 'none' && supported) {
              return note('border-signal-green/30 bg-signal-green/5', <Fingerprint size={18} className="mt-0.5 shrink-0 text-signal-green" />,
                'Secure this phone with Face ID / Touch ID',
                'One-time setup. It links your account to this device so nobody else can mark attendance as you, even with your password. Your face or fingerprint never leaves the phone.',
                <button onClick={handleEnroll} disabled={enrolling} className="mt-4 w-full rounded-lg bg-signal-green py-2.5 text-sm font-bold text-ink-950 transition hover:brightness-110 disabled:opacity-60">
                  {enrolling ? 'Waiting for Face ID…' : 'Set up now'}
                </button>);
            }
            return (
              <>
                {bound === 'passkey' && (
                  <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-signal-green"><Fingerprint size={13} />Face ID / Touch ID protected</p>
                )}
                <button
                  onClick={onStart}
                  className="mt-4 w-full rounded-lg bg-signal-red py-2.5 text-sm font-medium text-white transition hover:bg-red-600"
                >
                  {startLabel}
                </button>
              </>
            );
            };

  return (
    <div className="student-workspace min-h-screen flex flex-col items-center px-4 py-6 sm:px-6 sm:py-10">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Signed in as</p>
            <p className="text-sm font-medium text-slate-200">{user?.name}</p>
          </div>
          <div className="flex items-center gap-3"><button onClick={() => navigate('/student/dashboard')} className="flex items-center gap-1.5 text-xs text-signal-blue">Home</button><button onClick={() => navigate('/student/attendance')} className="flex items-center gap-1.5 text-xs text-signal-blue"><History size={13}/>History</button><button onClick={() => navigate('/student/leave')} className="flex items-center gap-1.5 text-xs text-signal-blue"><CalendarCheck size={13}/>Leave</button><button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300"
          >
            <LogOut size={13} /> Sign out
          </button></div>
        </div>

        <div className="student-attendance-card mt-6 rounded-2xl p-5 shadow-card sm:p-7">
          <h1 className="font-display text-xl font-semibold text-white">Mark Attendance</h1>
          <p className="mt-1 text-sm text-slate-400">Alpha (Bluetooth) is the primary method: your phone detects the classroom beacon and marks attendance automatically. If Bluetooth is unavailable, use the Beta QR scanner.</p>

          <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-ink-border bg-ink-900 p-1">
            <button type="button" onClick={() => selectAttendanceMode('alpha')} className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold transition ${attendanceMode === 'alpha' ? 'bg-cyan-500/20 text-cyan-200 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><Bluetooth size={14}/>Alpha · BLE</button>
            <button type="button" onClick={() => selectAttendanceMode('beta')} className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold transition ${attendanceMode === 'beta' ? 'bg-red-500/20 text-red-200 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><QrCode size={14}/>Beta · QR</button>
          </div>

          {attendanceMode === 'alpha' ? (
            <>
              <div className="mt-6 grid place-items-center">
                <div className={`grid h-24 w-24 place-items-center rounded-full border transition ${status === 'scanning' ? 'border-sky-200/60 bg-sky-400/15 shadow-[0_0_45px_rgba(56,189,248,0.35)]' : 'border-sky-300/30 bg-sky-400/5'}`}>
                  {(status === 'locating' || status === 'submitting')
                    ? <Loader2 size={34} className="animate-spin text-sky-200" />
                    : status === 'success'
                      ? <CheckCircle2 size={36} className="text-signal-green" />
                      : status === 'scanning'
                        ? <Radar size={36} className="animate-pulse text-sky-200" />
                        : <Bluetooth size={34} className="text-sky-300" />}
                </div>
              </div>

              {status === 'scanning' && (
                <div className="mt-5 text-center">
                  <p className="text-sm text-sky-100 animate-pulse">{message}</p>
                  <button type="button" onClick={stopBleScan} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-sky-400/40 bg-sky-400/10 px-4 py-2 text-xs font-semibold transition hover:bg-sky-400/20">
                    <Square size={12} fill="currentColor" />Stop scanning
                  </button>
                </div>
              )}

              {status === 'idle' && (
                <>
                  <p className="mt-5 text-center text-xs leading-relaxed text-slate-400">
                    Stay inside the classroom with Bluetooth and Location on. Tap once: your phone finds the classroom beacon and marks attendance automatically.
                  </p>
                  {bleSupported ? renderIdleGate(startBleScan, 'Start classroom scan') : (
                    <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-left">
                      <div className="flex items-start gap-3">
                        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-400" />
                        <div>
                          <p className="text-sm font-semibold">Bluetooth scan is not available here</p>
                          <p className="mt-1 text-xs leading-relaxed">{BLE_UNSUPPORTED_MESSAGES[bleStatus.reason]}</p>
                          {bleStatus.reason === 'no-watch' && (
                            <ol className="mt-2 list-decimal space-y-1 pl-4 text-xs leading-relaxed">
                              <li>In Chrome, open <b>chrome://flags</b></li>
                              <li>Search <b>Experimental Web Platform features</b>, set it to <b>Enabled</b></li>
                              <li>Tap <b>Relaunch</b>, then open this page again</li>
                            </ol>
                          )}
                          <p className="mt-2 text-[10px] opacity-60">Check: {bleStatus.reason}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => selectAttendanceMode('beta')} className="mt-4 w-full rounded-lg border border-sky-400/40 bg-sky-400/10 py-2.5 text-xs font-semibold transition hover:bg-sky-400/20">
                        Use Beta · QR instead
                      </button>
                    </div>
                  )}
                  <a href={ANDROID_APK_URL} download className="mt-3 flex items-center justify-center gap-2 rounded-lg border border-sky-400/40 bg-sky-400/10 py-2.5 text-xs font-semibold transition hover:bg-sky-400/20">
                    <Smartphone size={14} />Get the Android app (recommended for Bluetooth)
                  </a>
                  <p className="mt-2 text-center text-[10px] opacity-60">After downloading, allow "Install unknown apps" once, then sign in with this same account.</p>
                </>
              )}
            </>
          ) : (
            <>
          {/* QR Viewfinder */}
          <div className="mt-6 scan-frame relative mx-auto w-full aspect-square max-w-[280px] overflow-hidden rounded-2xl bg-black">
            <span className="corner corner-tl" />
            <span className="corner corner-tr" />
            <span className="corner corner-bl" />
            <span className="corner corner-br" />
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            {status === 'scanning' && (
              <div className="sweep animate-scanline" style={{ animationDuration: '2.4s' }} />
            )}
            {status !== 'scanning' && (
              <div className="absolute inset-0 flex items-center justify-center bg-ink-950/70">
                <ScanLine size={36} className="text-slate-600" />
              </div>
            )}
          </div>

          {/* Camera permission error */}
          {cameraError && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-3">
              <Camera size={14} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-300">{cameraError}</p>
            </div>
          )}

          {status === 'idle' && renderIdleGate(startScanning, 'Start Scanning')}
            </>
          )}

          {/* LOCATING / SUBMITTING state */}
          {(status === 'locating' || status === 'submitting') && (
            <div className="mt-6 flex flex-col items-center gap-3">
              <Loader2 size={22} className="text-signal-green animate-spin" />
              <p className="text-center text-sm text-slate-400 animate-pulse">{message}</p>
              {status === 'locating' && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin size={12} />
                  <span>Obtaining GPS coordinates…</span>
                </div>
              )}
            </div>
          )}

          {/* SUCCESS state */}
          {status === 'success' && successData && (
            <div className="mt-6 rounded-lg border border-signal-green/30 bg-signal-green/10 px-4 py-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 size={20} className="text-signal-green shrink-0" />
                <p className="text-sm font-semibold text-signal-green">Attendance Marked</p>
              </div>
              <div className="space-y-1.5">
                <Row label="Name" value={successData.studentName} />
                <Row label="Roll No" value={successData.rollNo} />
                <Row label="Subject" value={successData.subjectName} />
                <Row label="Status" value={successData.status} highlight />
                <Row
                  label="Time"
                  value={new Date(successData.markedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                />
                {successData.distanceMeters !== undefined && (
                  <Row label="Distance" value={`${successData.distanceMeters} m from class`} />
                )}
                {successData.gpsAccuracy !== undefined && (
                  <Row label="GPS Accuracy" value={`±${Math.round(successData.gpsAccuracy)} m`} />
                )}
              </div>
            </div>
          )}

          {/* ERROR state */}
          {status === 'error' && (
            <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-4 text-center">
              {errorCode === 'DEVICE_NOT_AUTHORIZED' ? (
                <ShieldAlert size={22} className="text-signal-red" />
              ) : (
                <XCircle size={22} className="text-signal-red" />
              )}
              <p className="text-sm text-red-300 leading-relaxed">{message}</p>
              {/* Only show retry for recoverable errors */}
              {!['ATTENDANCE_ALREADY_MARKED', 'DEVICE_NOT_AUTHORIZED'].includes(errorCode) && (
                <button
                  onClick={handleRetry}
                  className="mt-1 rounded-lg bg-signal-red px-4 py-2 text-xs font-medium text-white hover:bg-red-600"
                >
                  Try Again
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {showConsent && <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-4 sm:items-center sm:justify-center"><div role="dialog" aria-modal="true" aria-labelledby="privacy-title" className="w-full max-w-md rounded-2xl border border-ink-border bg-ink-850 p-6 shadow-2xl"><h2 id="privacy-title" className="text-lg font-bold text-white">Attendance permission notice</h2><p className="mt-3 text-sm leading-6 text-slate-300">Attendance mark pannumbodhu mattum Bluetooth (classroom beacon), camera (QR), precise location, and your device passkey (Face ID / Touch ID) or device ID use pannuvom. Idhu class presence verify panna mattum; background location or recordings save panna maatom.</p><button onClick={() => navigate('/privacy')} className="mt-3 text-sm font-semibold text-signal-blue">Read Privacy Policy</button><div className="mt-5 flex gap-3"><button onClick={() => { setShowConsent(false); setPendingMode(null); }} className="flex-1 rounded-xl border border-ink-border px-4 py-2.5 text-sm text-slate-300">Cancel</button><button onClick={() => { localStorage.setItem('kgisl_attendance_consent_v1', 'accepted'); setShowConsent(false); if (pendingMode === 'alpha') setAttendanceMode('alpha'); else if (pendingMode === 'beta') setAttendanceMode('beta'); else if (pendingMode === 'ble') startBleScan(); else startScanning(); setPendingMode(null); }} className="flex-1 rounded-xl bg-signal-green px-4 py-2.5 text-sm font-bold text-ink-950">I understand</button></div></div></div>}
    </div>
  );
}

/** Small helper for the success detail rows */
function Row({ label, value, highlight = false }) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-slate-500">{label}</span>
      <span className={highlight ? 'text-signal-green font-semibold' : 'text-slate-300'}>
        {value}
      </span>
    </div>
  );
}
