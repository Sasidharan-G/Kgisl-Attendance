import { Code2, Users2, Building2, Clock, Square, Play } from 'lucide-react';

function Field({ icon: Icon, label, value, onChange, options, loading }) {
  return (
    <div className="flex items-center gap-2.5 flex-1 min-w-[160px]">
      <Icon size={16} className="text-slate-500 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="w-full truncate bg-transparent text-sm font-medium text-slate-100 outline-none cursor-pointer"
          >
            {options.length === 0 && <option value="">No options — check backend seed data</option>}
            {options.map((opt) => (
              <option key={opt.id} value={opt.id} className="bg-ink-850 text-slate-100">
                {opt.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

export default function SessionConfigBar({
  subjectId,
  setSubjectId,
  batchId,
  setBatchId,
  roomId,
  setRoomId,
  subjects,
  batches,
  rooms,
  loadingCatalog,
  timeLabel,
  sessionActive,
  onStart,
  onEnd,
  starting,
}) {
  return (
    <div className="mx-8 flex flex-wrap items-center gap-6 rounded-xl border border-ink-border bg-ink-850/60 px-6 py-4 shadow-card">
      <Field icon={Code2} label="Admin Assigned Class / Section" value={subjectId} onChange={setSubjectId} options={subjects} loading={loadingCatalog} />
      <div className="h-8 w-px bg-ink-border hidden md:block" />
      <Field icon={Building2} label="Room" value={roomId} onChange={setRoomId} options={rooms} loading={loadingCatalog} />
      <div className="h-8 w-px bg-ink-border hidden md:block" />
      <div className="flex items-center gap-2.5 flex-1 min-w-[140px]">
        <Clock size={16} className="text-slate-500 shrink-0" />
        <div>
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Time</p>
          <p className="text-sm font-medium text-slate-100">{timeLabel}</p>
        </div>
      </div>

      {sessionActive ? (
        <button
          onClick={onEnd}
          className="flex items-center gap-2 rounded-lg bg-signal-red/90 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-signal-red"
        >
          <Square size={14} fill="currentColor" /> End Session
        </button>
      ) : (
        <button
          onClick={onStart}
          disabled={starting || loadingCatalog || !subjectId || !batchId || !roomId}
          className="flex items-center gap-2 rounded-lg bg-signal-green/90 px-4 py-2.5 text-sm font-medium text-ink-950 transition hover:bg-signal-green disabled:opacity-60"
        >
          <Play size={14} fill="currentColor" /> {starting ? 'Starting…' : 'Start Session'}
        </button>
      )}
    </div>
  );
}
