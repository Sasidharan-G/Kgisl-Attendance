import { useCallback, useEffect, useState } from 'react';
import { Bluetooth, Plus } from 'lucide-react';
import { createBeacon, listBeacons, updateBeacon, type ClassroomBeacon } from '../features/beacon/beaconApi';

type RoomOption = { id: string; name: string };

/** Admin: register the ESP32 beacon that belongs to each classroom (one beacon per room). */
export default function BeaconAdminSection({ rooms }: { rooms: RoomOption[] }) {
  const [beacons, setBeacons] = useState<ClassroomBeacon[]>([]);
  const [roomId, setRoomId] = useState('');
  const [beaconId, setBeaconId] = useState('1');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setBeacons(await listBeacons()); } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Could not load beacons'); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!roomId && rooms.length > 0) setRoomId(rooms[0].id); }, [roomId, rooms]);

  const roomName = (beacon: ClassroomBeacon) => beacon.room?.name ?? rooms.find((room) => room.id === beacon.roomId)?.name ?? 'Unknown room';
  const nextFreeId = () => String(Math.max(0, ...beacons.map((beacon) => beacon.beaconId)) + 1);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const selectedRoom = rooms.find((room) => room.id === roomId);
      await createBeacon({ beaconId: Number(beaconId), name: name.trim() || `${selectedRoom?.name ?? 'Classroom'} ESP32`, roomId, enabled: true });
      setName('');
      await load();
      setBeaconId(nextFreeId());
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : '';
      setError(/unique|exists|P2002/i.test(message) ? 'That beacon ID is already registered. Pick another number.' : (message || 'Could not add beacon'));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(beacon: ClassroomBeacon) {
    setError('');
    try {
      await updateBeacon(beacon.id, { beaconId: beacon.beaconId, name: beacon.name, roomId: beacon.roomId, enabled: !beacon.enabled });
      await load();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Could not update beacon');
    }
  }

  const inputClass = 'w-full rounded-lg border border-ink-border bg-ink-900 px-3 py-2 text-sm text-white';

  return (
    <section className="mt-6 rounded-2xl border border-ink-border bg-ink-850/60 p-5">
      <div className="flex items-center gap-2">
        <Bluetooth size={16} className="text-sky-300" />
        <h2 className="font-bold text-white">Classroom BLE Beacons</h2>
      </div>
      <p className="mt-1 text-xs text-slate-500">Each classroom's ESP32 needs one beacon ID. Faculty start the beacon from the Attendance page; students mark attendance by Bluetooth.</p>
      {error && <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">{error}</p>}

      <form onSubmit={add} className="mt-4 grid gap-3 md:grid-cols-[1.4fr_0.6fr_1.2fr_auto]">
        <label className="space-y-1 text-xs text-slate-400"><span>Room</span>
          <select required value={roomId} onChange={(event) => setRoomId(event.target.value)} className={inputClass}>
            {rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs text-slate-400"><span>Beacon ID</span>
          <input required type="number" min={1} max={65535} value={beaconId} onChange={(event) => setBeaconId(event.target.value)} className={inputClass} />
        </label>
        <label className="space-y-1 text-xs text-slate-400"><span>Name (optional)</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="MCA Lab ESP32" className={inputClass} />
        </label>
        <button disabled={saving || rooms.length === 0} className="flex items-center justify-center gap-2 self-end rounded-lg bg-signal-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus size={15} />Add beacon</button>
      </form>

      <div className="mt-4 grid gap-2">
        {beacons.length === 0 && <p className="text-xs text-slate-500">No beacons registered yet.</p>}
        {beacons.map((beacon) => (
          <div key={beacon.id} className="flex items-center justify-between rounded-lg bg-ink-900 px-3 py-2 text-xs text-slate-400">
            <div><b className="text-sm text-white">#{beacon.beaconId} · {beacon.name}</b><span className="ml-2">{roomName(beacon)}</span></div>
            <button type="button" onClick={() => void toggle(beacon)} className={`rounded-full border px-3 py-1 font-semibold ${beacon.enabled ? 'border-sky-300/40 text-sky-200' : 'border-ink-border text-slate-500'}`}>{beacon.enabled ? 'Enabled' : 'Disabled'}</button>
          </div>
        ))}
      </div>
    </section>
  );
}
