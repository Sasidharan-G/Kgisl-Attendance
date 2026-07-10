import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { CheckCircle2, XCircle, ScanLine, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { submitScan, getSessionPublicInfo } from '../services/api.js';

// Simple stable per-browser device fingerprint (persisted locally) used as
// the `deviceId` the backend cross-checks against the student's bound device.
function getDeviceId() {
  let id = localStorage.getItem('kgisl_device_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('kgisl_device_id', id);
  }
  return id;
}

export default function StudentScanPage() {
  const { user, logout } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));
  const rafRef = useRef(null);
  const scanningLockRef = useRef(false);

  const [status, setStatus] = useState('idle'); // idle | scanning | submitting | success | error
  const [message, setMessage] = useState('');
  const [cameraError, setCameraError] = useState('');

  const stopScanning = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const stream = videoRef.current?.srcObject;
    stream?.getTracks()?.forEach((t) => t.stop());
  }, []);

  const handleDecoded = useCallback(
    async (rawValue) => {
      if (scanningLockRef.current) return;
      scanningLockRef.current = true;
      stopScanning();
      setStatus('submitting');
      setMessage('Verifying your location…');

      try {
        const qrPayload = JSON.parse(rawValue);

        // The QR itself deliberately never carries batch/subject (see backend
        // spec: "QR must NEVER contain attendance information"). We only know
        // the sessionId at this point, so we look up the non-sensitive
        // batch/subject the session belongs to before submitting the scan.
        const { data: sessionInfo } = await getSessionPublicInfo(qrPayload.sessionId);

        const gps = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
            () => reject(new Error('Location permission is required to mark attendance.')),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        });

        await submitScan({
          batchId: sessionInfo.batchId,
          subjectId: sessionInfo.subjectId,
          gps: { lat: gps.lat, lng: gps.lng },
          qr: qrPayload,
        });

        setStatus('success');
        setMessage('Attendance marked successfully.');
      } catch (err) {
        setStatus('error');
        let errorMsg = err.message || 'Could not mark attendance. Try scanning again.';
        if (err.response?.data?.message) {
           const code = err.response.data.message;
           if (code.includes('GEOFENCE_REJECTED')) {
             errorMsg = 'Attendance rejected. You are outside the allowed 150-meter attendance location.';
           } else if (code.includes('POOR_GPS_ACCURACY')) {
             errorMsg = 'Location accuracy is too low. Please move to an open area and try again.';
           } else if (code.includes('INVALID_GPS')) {
             errorMsg = 'Unable to access your live location. Enable GPS and try again.';
           } else {
             errorMsg = code;
           }
        }
        setMessage(errorMsg);
      } finally {
        scanningLockRef.current = false;
      }
    },
    [stopScanning, user]
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
        return;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [handleDecoded]);

  async function startScanning() {
    setStatus('scanning');
    setMessage('');
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
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

  useEffect(() => stopScanning, [stopScanning]);

  return (
    <div className="min-h-screen flex flex-col items-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Signed in as</p>
            <p className="text-sm font-medium text-slate-200">{user?.name}</p>
          </div>
          <button onClick={logout} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300">
            <LogOut size={13} /> Sign out
          </button>
        </div>

        <div className="mt-8 rounded-2xl border border-ink-border bg-ink-850/60 shadow-card p-6">
          <h1 className="font-display text-xl font-semibold text-white">Mark Attendance</h1>
          <p className="mt-1 text-sm text-slate-400">Scan the live QR shown by your faculty.</p>

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

          {cameraError && <p className="mt-4 text-xs text-signal-red">{cameraError}</p>}

          {status === 'idle' && (
            <button
              onClick={startScanning}
              className="mt-6 w-full rounded-lg bg-signal-red py-2.5 text-sm font-medium text-white transition hover:bg-red-600"
            >
              Start Scanning
            </button>
          )}

          {status === 'submitting' && (
            <p className="mt-6 text-center text-sm text-slate-400 animate-pulse">{message}</p>
          )}

          {status === 'success' && (
            <div className="mt-6 flex flex-col items-center gap-2 rounded-lg border border-signal-green/30 bg-signal-green/10 px-4 py-4 text-center">
              <CheckCircle2 size={22} className="text-signal-green" />
              <p className="text-sm text-signal-green">{message}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="mt-6 flex flex-col items-center gap-2 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-4 text-center">
              <XCircle size={22} className="text-signal-red" />
              <p className="text-sm text-red-300">{message}</p>
              <button
                onClick={startScanning}
                className="mt-2 rounded-lg bg-signal-red px-4 py-2 text-xs font-medium text-white hover:bg-red-600"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
