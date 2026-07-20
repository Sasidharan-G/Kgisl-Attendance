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
  Waves,
  QrCode,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { submitScan, getSessionPublicInfo } from '../services/api.js';
import StudentAcousticPanel from '../components/StudentAcousticPanel';

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

/**
 * Collect several fresh high-accuracy readings and use the best one instead of
 * trusting the first indoor GPS fix. Resolves early after two strong fixes, or
 * uses the best available reading when the sampling window ends.
 */
function getAccurateLocation(onProgress) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({ code: 'GPS_REQUIRED', message: 'Geolocation is not supported by this browser.' });
      return;
    }

    let best = null;
    let samples = 0;
    let settled = false;
    let watchId;
    const finish = (result, error) => {
      if (settled) return;
      settled = true;
      if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
      clearTimeout(timeoutId);
      if (error) reject(error); else resolve(result);
    };
    const timeoutId = setTimeout(() => {
      if (best) finish(best);
      else finish(null, { code: 'GPS_REQUIRED', message: 'Could not get your location. Turn on precise location and try again.' });
    }, 5000);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        samples += 1;
        const reading = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        if (!best || reading.accuracy < best.accuracy) best = reading;
        onProgress?.(best.accuracy, samples);
        if (best.accuracy <= 40) finish(best);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          finish(null, { code: 'GPS_REQUIRED', message: 'Precise location permission is required to mark attendance.' });
        }
      },
      { enableHighAccuracy: true, timeout: 4500, maximumAge: 1500 }
    );
  });
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
    VALIDATION_ERROR: 'Request could not be processed. Please try scanning again.',
  };
  return messages[code] || fallbackMessage || 'Something went wrong. Try scanning again.';
}

// Scan status states
// idle | scanning | locating | submitting | success | error
export default function StudentScanPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));
  const rafRef = useRef(null);

  // Duplicate-scan prevention: store the last submitted token & submission in-flight flag
  const lastScannedTokenRef = useRef(null);
  const isSubmittingRef = useRef(false);

  const [status, setStatus] = useState('idle');
  const [cameraError, setCameraError] = useState('');
  const [message, setMessage] = useState('');
  const [successData, setSuccessData] = useState(null); // from backend response
  const [errorCode, setErrorCode] = useState('');
  const [attendanceMode, setAttendanceMode] = useState('alpha');

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    const stream = videoRef.current?.srcObject;
    stream?.getTracks()?.forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Stop camera on component unmount
  useEffect(() => stopCamera, [stopCamera]);

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
        const locationPromise = getAccurateLocation((accuracy, samples) => {
          setMessage(`Improving location accuracy… ${Math.round(accuracy)} m · sample ${samples}`);
        });
        const [{ data: sessionInfo }, gps] = await Promise.all([sessionInfoPromise, locationPromise]);

        // Step C: submit attendance
        setStatus('submitting');
        setMessage('Marking attendance…');

        const response = await submitScan({
          batchId: sessionInfo.batchId,
          subjectId: sessionInfo.subjectId,
          deviceId: getDeviceId(),
          gps, // { lat, lng, accuracy }
          qr: qrPayload, // full signed QR object
        });

        // Success — show details from the backend response (never from QR)
        setSuccessData(response.data);
        setStatus('success');
        setMessage('');
      } catch (err) {
        const code = err?.code || err?.response?.data?.code || '';
        const fallback = err?.message || err?.response?.data?.message || '';
        setErrorCode(code);
        setMessage(mapErrorCode(code, fallback));
        setStatus('error');
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

  async function startScanning() {
    setStatus('scanning');
    setMessage('');
    setCameraError('');
    setSuccessData(null);
    setErrorCode('');
    isSubmittingRef.current = false;
    lastScannedTokenRef.current = null;

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

  function handleRetry() {
    // Reset token ref so the same QR can be tried if it was a transient error
    // (e.g. network error) — but not if the error is permanent (duplicate, device).
    const permanentCodes = ['ATTENDANCE_ALREADY_MARKED', 'DEVICE_NOT_AUTHORIZED', 'SESSION_NOT_ACTIVE'];
    if (permanentCodes.includes(errorCode)) {
      // Don't clear lastScannedTokenRef — prevent re-submitting same token
    } else {
      lastScannedTokenRef.current = null;
    }
    startScanning();
  }

  function selectAttendanceMode(mode) {
    stopCamera();
    setAttendanceMode(mode);
    setStatus('idle');
    setCameraError('');
    setMessage('');
    setErrorCode('');
    setSuccessData(null);
    isSubmittingRef.current = false;
  }

  return (
    <div className="student-workspace min-h-screen flex flex-col items-center px-4 py-6 sm:px-6 sm:py-10">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Signed in as</p>
            <p className="text-sm font-medium text-slate-200">{user?.name}</p>
          </div>
          <div className="flex items-center gap-3"><button onClick={() => navigate('/student/attendance')} className="flex items-center gap-1.5 text-xs text-signal-blue"><History size={13}/>History</button><button onClick={() => navigate('/student/leave')} className="flex items-center gap-1.5 text-xs text-signal-blue"><CalendarCheck size={13}/>Leave</button><button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300"
          >
            <LogOut size={13} /> Sign out
          </button></div>
        </div>

        <div className="student-attendance-card mt-6 rounded-2xl p-5 shadow-card sm:p-7">
          <h1 className="font-display text-xl font-semibold text-white">Mark Attendance</h1>
          <p className="mt-1 text-sm text-slate-400">Listen for the Alpha sound. If it is unavailable, use the Beta QR scanner.</p>

          <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-ink-border bg-ink-900 p-1">
            <button type="button" onClick={() => selectAttendanceMode('alpha')} className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold transition ${attendanceMode === 'alpha' ? 'bg-cyan-500/20 text-cyan-200 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><Waves size={14}/>Alpha · Sound</button>
            <button type="button" onClick={() => selectAttendanceMode('beta')} className={`flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-semibold transition ${attendanceMode === 'beta' ? 'bg-red-500/20 text-red-200 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}><QrCode size={14}/>Beta · QR</button>
          </div>

          {attendanceMode === 'alpha' ? (
            <div className="mt-4">
              <StudentAcousticPanel onUseQr={() => selectAttendanceMode('beta')} />
            </div>
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

          {/* IDLE state */}
          {status === 'idle' && (
            <button
              onClick={startScanning}
              className="mt-6 w-full rounded-lg bg-signal-red py-2.5 text-sm font-medium text-white transition hover:bg-red-600"
            >
              Start Scanning
            </button>
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
            </>
          )}
        </div>
      </div>
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
