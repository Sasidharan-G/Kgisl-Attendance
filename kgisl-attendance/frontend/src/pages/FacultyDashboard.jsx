import { useEffect, useRef, useState } from 'react';
import { Users2, ShieldAlert, Timer, GraduationCap } from 'lucide-react';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import SessionConfigBar from '../components/SessionConfigBar.jsx';
import StatusRing from '../components/StatusRing.jsx';
import QRPanel from '../components/QRPanel.jsx';
import RecentScans from '../components/RecentScans.jsx';
import ValidationStrip from '../components/ValidationStrip.jsx';
import StatTile from '../components/StatTile.jsx';
import AgentChat from '../components/AgentChat.jsx';
import ManualAttendance from '../components/ManualAttendance.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { startSession, endSession, listAllocations } from '../services/api.js';
import { getSocket, disconnectSocket } from '../services/socket.js';

export default function FacultyDashboard() {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const currentSessionIdRef = useRef(null);

  const [subjects, setSubjects] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  const [subjectId, setSubjectId] = useState('');
  const [roomId, setRoomId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [timeLabel, setTimeLabel] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

  const [sessionActive, setSessionActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [sessionMeta, setSessionMeta] = useState(null);
  const [qr, setQr] = useState(null);
  const [stats, setStats] = useState({ totalStudents: 0, present: 0, absent: 0, progressPercent: 0 });
  const [scans, setScans] = useState([]);
  const [violations, setViolations] = useState(0);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTimeLabel(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })), 1000);
    return () => clearInterval(timer);
  }, []);

  // Load real Subject/Room/Batch options from the backend on mount so the
  // session-start request sends actual UUIDs, not display labels.
  useEffect(() => {
    (async () => {
      try {
        const a = await listAllocations();
        setAllocations(a);
        setSubjects(a.map((x) => ({ id: x.id, name: `${x.subject.code} · ${x.batch.name} · ${x.startTime}-${x.endTime}` })));
        const first = a[0];
        setRooms(first ? [first.room] : []);
        setBatches(first ? [first.batch] : []);
        setSubjectId(first?.id ?? '');
        setRoomId(first?.roomId ?? '');
        setBatchId(first?.batchId ?? '');
      } catch (err) {
        setCatalogError(err.message || 'Could not load subjects/rooms/batches. Run the backend seed script.');
      } finally {
        setLoadingCatalog(false);
      }
    })();
  }, []);

  function selectAllocation(id) {
    setSubjectId(id);
    const a = allocations.find((x) => x.id === id);
    if (a) {
      setRooms([a.room]); setBatches([a.batch]);
      setRoomId(a.roomId); setBatchId(a.batchId);
    }
  }

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    // Re-join the session room on every connect — not just the first time.
    // A dev-server HMR reload, a brief network blip, or the proxy dropping the
    // websocket will all trigger socket.io's own reconnection logic, but a
    // reconnect gets a **new** socket.id and Socket.IO rooms don't survive
    // that — without this, the client silently stops receiving qr_updated
    // after the first hiccup even though it looks "connected".
    socket.on('connect', () => {
      setConnected(true);
      if (currentSessionIdRef.current) {
        socket.emit('join_session', currentSessionIdRef.current);
      }
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('qr_updated', (payload) => {
      setQr(payload);
      setStats(payload.stats);
    });

    socket.on('attendance_marked', (data) => {
      setScans((prev) => [data, ...prev].slice(0, 50));
    });

    socket.on('geofence_violation', (data) => {
      setViolations((prev) => prev + 1);
      setScans((prev) => [{ ...data, isViolation: true }, ...prev].slice(0, 50));
    });

    socket.on('session_ended', () => {
      setSessionActive(false);
      setQr(null);
      currentSessionIdRef.current = null;
    });

    return () => {
      disconnectSocket();
    };
  }, []);

  async function handleStart() {
    setStarting(true);
    try {
      const allocation = allocations.find((x) => x.id === subjectId);
      if (!allocation) throw new Error('Select an admin-assigned class');
      const { data: session } = await startSession({
        allocationId: allocation.id,
        subjectId: allocation.subjectId,
        roomId,
        batchId,
      });

      setSessionMeta({
        sessionId: session.sessionId,
        startedBy: user.name,
        startedAt: new Date(session.startedAt).toLocaleTimeString(),
      });
      setSessionActive(true);
      setScans([]);
      setViolations(0);
      currentSessionIdRef.current = session.sessionId;

      socketRef.current?.emit('join_session', session.sessionId);
    } catch (err) {
      alert(err.message || 'Could not start session');
    } finally {
      setStarting(false);
    }
  }

  async function handleEnd() {
    if (!sessionMeta?.sessionId) return;
    try {
      await endSession(sessionMeta.sessionId);
      currentSessionIdRef.current = null;
    } catch (err) {
      alert(err.message || 'Could not end session');
    }
  }

  return (
    <div className="flex min-h-screen bg-ink-950">
      <Sidebar />

      <main className="flex-1 min-w-0 pb-10">
        <TopBar connected={connected} sessionActive={sessionActive} />

        {catalogError && (
          <p className="mx-8 mb-4 rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-2.5 text-xs text-red-300">
            {catalogError}
          </p>
        )}

        <SessionConfigBar
          subjectId={subjectId}
          setSubjectId={selectAllocation}
          batchId={batchId}
          setBatchId={setBatchId}
          roomId={roomId}
          setRoomId={setRoomId}
          subjects={subjects}
          batches={batches}
          rooms={rooms}
          loadingCatalog={loadingCatalog}
          timeLabel={timeLabel}
          sessionActive={sessionActive}
          starting={starting}
          onStart={handleStart}
          onEnd={handleEnd}
        />

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_1.3fr_1fr] gap-6 px-8">
          <div className="rounded-2xl border border-ink-border bg-ink-850/60 shadow-card p-6 flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Session Status</h3>
              <span className="flex items-center gap-1.5 text-[11px] text-signal-green">
                <span className="h-1.5 w-1.5 rounded-full bg-signal-green status-dot" />
                {sessionActive ? 'Active' : 'Idle'}
              </span>
            </div>

            <StatusRing
              value={qr ? Math.max(0, Math.ceil((qr.expiresAt - Date.now()) / 1000)) : 0}
              max={qr?.refreshIntervalSeconds ?? 10}
              label={qr ? Math.max(0, Math.ceil((qr.expiresAt - Date.now()) / 1000)) : '—'}
              sublabel="SEC · QR Expires In"
              color="#2fd97a"
            />

            <div className="mt-6 grid w-full grid-cols-2 gap-3">
              <div className="rounded-xl border border-ink-border bg-ink-900 py-3 text-center">
                <p className="font-display text-2xl font-bold text-signal-green">{stats.present}</p>
                <p className="text-[11px] text-slate-500">Present</p>
              </div>
              <div className="rounded-xl border border-ink-border bg-ink-900 py-3 text-center">
                <p className="font-display text-2xl font-bold text-signal-red">{stats.absent}</p>
                <p className="text-[11px] text-slate-500">Absent</p>
              </div>
            </div>

            <div className="mt-5 w-full">
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>Session Progress</span>
                <span>
                  {stats.present} / {stats.totalStudents}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-ink-900">
                <div
                  className="h-1.5 rounded-full bg-signal-green transition-all"
                  style={{ width: `${stats.progressPercent}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] text-slate-500">{stats.progressPercent}%</p>
            </div>
          </div>

          <div className="flex flex-col h-full gap-6">
            <QRPanel qr={qr} sessionMeta={sessionMeta} />
            {sessionActive && <ManualAttendance sessionId={sessionMeta?.sessionId} />}
          </div>

          <RecentScans scans={scans} />
        </div>

        <div className="mt-6">
          <ValidationStrip active={sessionActive} connected={connected} />
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 px-8">
          <StatTile icon={Users2} iconTone="blue" title="Active Sessions" value={sessionActive ? '1' : '0'} subtitle="Session Running" />
          <StatTile icon={ShieldAlert} iconTone="red" title="Proxy Attempts Tracked" value={violations} subtitle="Blocked Today" />
          <StatTile icon={Timer} iconTone="blue" title="Average Attendance Time" value="—" subtitle="Average Scan Time" />
          <StatTile
            icon={GraduationCap}
            iconTone="blue"
            title="Students Today"
            value={stats.totalStudents}
            subtitle="Total Students"
          />
        </div>
      </main>

      {/* Global AI Agent for the Dashboard */}
      <AgentChat />
    </div>
  );
}
