import { Grid3x3, Wifi, MapPin, Clock, ShieldCheck } from 'lucide-react';

const ITEMS = [
  { icon: Grid3x3, label: 'QR Code', value: 'Valid' },
  { icon: Wifi, label: 'Network', value: 'Verified' },
  { icon: MapPin, label: 'Location', value: 'Verified' },
  { icon: Clock, label: 'Time Window', value: 'Valid' },
  { icon: ShieldCheck, label: 'Duplicate Check', value: 'Passed' },
];

export default function ValidationStrip({ active = false, connected = false }) {
  const items = ITEMS.map((item) => ({ ...item, value: active ? (connected ? item.value : 'Waiting for connection') : 'Waiting for session' }));
  return (
    <div className="mx-8 rounded-xl border border-ink-border bg-ink-850/60 shadow-card px-6 py-4">
      <p className="mb-3 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Validation Status</p>
      <div className="flex flex-wrap gap-8">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-2.5">
            <Icon size={16} className={active && connected ? 'text-signal-green' : 'text-slate-500'} />
            <div>
              <p className="text-[11px] text-slate-500">{label}</p>
              <p className={`text-xs font-medium ${active && connected ? 'text-signal-green' : 'text-slate-500'}`}>{value}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
