import { Building2, CalendarDays, Clock, Code2, Pause, Play, Square } from 'lucide-react';

function Field({ icon: Icon, label, value, onChange, options, loading, placeholder }) {
  return <div className="flex min-w-0 flex-1 basis-full items-center gap-2.5 sm:min-w-[180px] sm:basis-auto">
    <Icon size={16} className="shrink-0 text-slate-500" />
    <div className="min-w-0 flex-1"><p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      {loading ? <p className="text-sm text-slate-500">Loading...</p> : <select value={value || ''} onChange={(e) => onChange(e.target.value)} className="w-full cursor-pointer truncate bg-transparent text-sm font-medium text-slate-100 outline-none">
        <option value="" className="bg-ink-850">{placeholder}</option>
        {options.map((option) => <option key={option.id} value={option.id} className="bg-ink-850 text-slate-100">{option.name}</option>)}
      </select>}
    </div>
  </div>;
}

const DAYS = [
  { id: '1', name: 'Monday' }, { id: '2', name: 'Tuesday' },
  { id: '3', name: 'Wednesday' }, { id: '4', name: 'Thursday' },
  { id: '5', name: 'Friday' }, { id: '6', name: 'Saturday' },
  { id: '7', name: 'Sunday' },
];

export default function SessionConfigBar({ selectedDay, setSelectedDay, subjectId, setSubjectId, batchId, roomId, subjects, rooms, loadingCatalog, timeLabel, sessionActive, sessionPaused, onStart, onEnd, onPause, onResume, starting, dayAllocations }) {
  const readyToStart = !starting && !loadingCatalog && Boolean(selectedDay && subjectId && batchId && roomId);

  return <div className="mx-3 rounded-xl border border-ink-border bg-ink-850/60 px-4 py-4 shadow-card sm:mx-6 md:mx-8 md:px-6 md:py-5">
    <div className="flex flex-wrap items-end gap-3 sm:gap-5">
      <Field icon={CalendarDays} label="1. Select Day" value={selectedDay} onChange={setSelectedDay} options={DAYS} loading={loadingCatalog} placeholder="Choose day" />
      <div className="hidden h-8 w-px bg-ink-border md:block" />
      <Field icon={Code2} label="2. Choose Assigned Period" value={subjectId} onChange={setSubjectId} options={selectedDay ? subjects : []} loading={loadingCatalog} placeholder={selectedDay ? 'Choose period / session' : 'Select day first'} />
      <div className="hidden h-8 w-px bg-ink-border md:block" />
      <Field icon={Building2} label="Assigned Room" value={roomId} onChange={() => {}} options={rooms} loading={loadingCatalog} placeholder="Select a period" />
      <div className="flex min-w-[110px] items-center gap-2.5"><Clock size={16} className="text-slate-500" /><div><p className="text-[10px] uppercase tracking-wide text-slate-500">Current Time</p><p className="text-sm font-medium text-slate-100">{timeLabel}</p></div></div>
      {sessionActive ? <div className="flex w-full gap-2 sm:w-auto"><button onClick={sessionPaused ? onResume : onPause} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-signal-amber/70 bg-signal-amber/90 px-4 py-2.5 text-sm font-medium text-ink-950 shadow-[0_0_16px_rgba(245,158,11,0.22)] transition hover:shadow-[0_0_22px_rgba(245,158,11,0.4)] sm:flex-none">{sessionPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}{sessionPaused ? 'Resume' : 'Pause'}</button><button onClick={onEnd} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-300/70 bg-signal-red/90 px-4 py-2.5 text-sm font-medium text-white shadow-[0_0_16px_rgba(239,68,68,0.2)] transition hover:shadow-[0_0_22px_rgba(239,68,68,0.38)] sm:flex-none"><Square size={14} fill="currentColor" />End Session</button></div> : <button onClick={onStart} disabled={!readyToStart} className={`flex w-full items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium text-ink-950 transition sm:w-auto ${readyToStart ? 'border-signal-green bg-signal-green shadow-[0_0_10px_rgba(47,217,122,0.55),0_0_24px_rgba(47,217,122,0.3)] animate-pulse hover:shadow-[0_0_14px_rgba(47,217,122,0.7),0_0_30px_rgba(47,217,122,0.4)]' : 'border-signal-green/30 bg-signal-green/90 opacity-40 cursor-not-allowed'}`}><Play size={14} fill="currentColor" />{starting ? 'Starting...' : 'Start Session'}</button>}
    </div>
    {!selectedDay && !sessionActive && <p className="mt-4 rounded-lg border border-signal-blue/20 bg-signal-blue/5 px-3 py-2 text-xs text-signal-blue">Select a day to view the periods assigned by the administrator in time order.</p>}
    {selectedDay && !loadingCatalog && dayAllocations.length === 0 && <p className="mt-4 rounded-lg border border-signal-amber/20 bg-signal-amber/5 px-3 py-2 text-xs text-signal-amber">No session is assigned for this day.</p>}
    {selectedDay && dayAllocations.length > 0 && !sessionActive && <div className="mt-5 border-t border-ink-border pt-4"><p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">Full day order · {DAYS.find((day) => day.id === selectedDay)?.name}</p><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{dayAllocations.map((allocation, index) => <button key={allocation.id} type="button" onClick={() => setSubjectId(allocation.id)} className={`rounded-xl border px-3 py-3 text-left transition ${subjectId === allocation.id ? 'border-signal-blue bg-signal-blue/10 shadow-[0_0_18px_rgba(59,130,246,0.32)] ring-1 ring-signal-blue/30' : 'border-ink-border bg-ink-900/40 hover:border-signal-blue/50 hover:shadow-[0_0_12px_rgba(59,130,246,0.14)]'}`}><p className="text-[10px] font-bold uppercase text-signal-blue">Period {index + 1} · {allocation.startTime}–{allocation.endTime}</p><p className="mt-1 text-sm font-bold text-white">{allocation.subject.code} · {allocation.subject.name}</p><p className="mt-1 text-xs text-slate-400">{allocation.batch.name} · {allocation.room.name}</p></button>)}</div></div>}
  </div>;
}
