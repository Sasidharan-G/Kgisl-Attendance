import { AlertCircle, Building2, CalendarDays, Clock, Code2, Info, Pause, Play, Square, ChevronDown } from 'lucide-react';
import { format12HourRange } from '../utils/timeFormat.js';

function Field({ icon: Icon, label, value, onChange, options, loading, placeholder }) {
  return (
    <div className="flex min-w-0 flex-1 basis-full flex-col gap-1.5 sm:min-w-[200px] sm:basis-auto">
      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
        {label}
      </label>
      <div className="relative flex items-center rounded-xl border border-slate-700/80 bg-slate-900/90 px-3 py-2 shadow-sm transition hover:border-blue-500/60 hover:bg-slate-900 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 mr-2.5">
          <Icon size={15} />
        </div>

        {loading ? (
          <p className="text-xs text-slate-400 font-medium">Loading catalog...</p>
        ) : (
          <div className="relative flex-1 min-w-0 flex items-center justify-between">
            <select
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className="w-full cursor-pointer truncate bg-transparent pr-6 text-xs sm:text-sm font-bold text-white outline-none appearance-none"
            >
              <option value="" className="bg-slate-900 text-slate-400 font-medium">
                {placeholder}
              </option>
              {options.map((option) => (
                <option key={option.id} value={option.id} className="bg-slate-900 text-slate-100 font-semibold py-1">
                  {option.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-0 text-slate-400" />
          </div>
        )}
      </div>
    </div>
  );
}

const DAYS = [
  { id: '1', name: 'Monday' },
  { id: '2', name: 'Tuesday' },
  { id: '3', name: 'Wednesday' },
  { id: '4', name: 'Thursday' },
  { id: '5', name: 'Friday' },
  { id: '6', name: 'Saturday' },
  { id: '7', name: 'Sunday' },
];

export default function SessionConfigBar({
  selectedDay,
  setSelectedDay,
  subjectId,
  setSubjectId,
  batchId,
  roomId,
  subjects,
  rooms,
  loadingCatalog,
  timeLabel,
  sessionActive,
  sessionPaused,
  onStart,
  onEnd,
  onPause,
  onResume,
  starting,
  dayAllocations,
}) {
  const readyToStart = !starting && !loadingCatalog && Boolean(selectedDay && subjectId && batchId && roomId);

  return (
    <div className="mx-3 rounded-2xl border border-slate-800 bg-slate-900/90 px-4 py-4 shadow-xl sm:mx-6 md:mx-8 md:px-6 md:py-5">
      <div className="flex flex-wrap items-center gap-4 sm:gap-5">
        <Field
          icon={CalendarDays}
          label="1. Select Day"
          value={selectedDay}
          onChange={setSelectedDay}
          options={DAYS}
          loading={loadingCatalog}
          placeholder="Choose day"
        />

        <div className="hidden h-10 w-px bg-slate-800 md:block" />

        <Field
          icon={Code2}
          label="2. Choose Period"
          value={subjectId}
          onChange={setSubjectId}
          options={selectedDay ? subjects : []}
          loading={loadingCatalog}
          placeholder={selectedDay ? 'Choose period / session' : 'Select day first'}
        />

        <div className="hidden h-10 w-px bg-slate-800 md:block" />

        <Field
          icon={Building2}
          label="Assigned Room"
          value={roomId}
          onChange={() => {}}
          options={rooms}
          loading={loadingCatalog}
          placeholder="Select a period"
        />

        <div className="flex flex-col gap-1.5 min-w-[120px]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Time</span>
          <div className="flex h-[42px] items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/80 px-3 text-xs font-mono font-bold text-emerald-400">
            <Clock size={14} className="text-emerald-400 animate-pulse" />
            <span>{timeLabel}</span>
          </div>
        </div>

        {sessionActive ? (
          <div className="flex w-full gap-2 sm:w-auto mt-2 sm:mt-0">
            <button
              onClick={sessionPaused ? onResume : onPause}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-500/70 bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-amber-950 transition hover:bg-amber-400 sm:flex-none"
            >
              {sessionPaused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
              {sessionPaused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={onEnd}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-rose-500/70 bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-rose-950 transition hover:bg-rose-500 sm:flex-none"
            >
              <Square size={14} fill="currentColor" />
              End Session
            </button>
          </div>
        ) : (
          <button
            onClick={onStart}
            disabled={!readyToStart}
            className={`flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-2.5 text-xs font-bold text-slate-950 transition sm:w-auto mt-2 sm:mt-0 ${
              readyToStart
                ? 'border-emerald-400 bg-emerald-400 shadow-lg shadow-emerald-950 animate-pulse hover:bg-emerald-300 cursor-pointer'
                : 'border-emerald-900 bg-emerald-950/50 text-emerald-600 cursor-not-allowed opacity-50'
            }`}
          >
            <Play size={14} fill="currentColor" />
            {starting ? 'Starting...' : 'Start Session'}
          </button>
        )}
      </div>

      {!selectedDay && !sessionActive && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-blue-500/40 bg-blue-950/60 px-4 py-3 text-xs sm:text-sm font-semibold text-blue-200 shadow-sm">
          <Info size={16} className="shrink-0 text-blue-400" />
          <span>Select a day to view the periods assigned by the administrator in time order.</span>
        </div>
      )}

      {selectedDay && !loadingCatalog && dayAllocations.length === 0 && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-amber-500/40 bg-amber-950/60 px-4 py-3 text-xs sm:text-sm font-semibold text-amber-200 shadow-sm">
          <AlertCircle size={16} className="shrink-0 text-amber-400" />
          <span>No session is assigned for this day.</span>
        </div>
      )}

      {selectedDay && dayAllocations.length > 0 && !sessionActive && (
        <div className="mt-5 border-t border-slate-800 pt-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Full day order · {DAYS.find((day) => day.id === selectedDay)?.name}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {dayAllocations.map((allocation, index) => (
              <button
                key={allocation.id}
                type="button"
                onClick={() => setSubjectId(allocation.id)}
                className={`rounded-xl border px-3.5 py-3 text-left transition ${
                  subjectId === allocation.id
                    ? 'border-blue-500 bg-blue-950/60 shadow-[0_0_20px_rgba(59,130,246,0.3)] ring-1 ring-blue-500'
                    : 'border-slate-800 bg-slate-950/60 hover:border-blue-500/50'
                }`}
              >
                <p className="text-[10px] font-bold uppercase text-blue-400">
                  Period {index + 1} · {format12HourRange(allocation.startTime, allocation.endTime)}
                </p>
                <p className="mt-1 text-sm font-bold text-white">
                  {allocation.subject.code} · {allocation.subject.name}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {allocation.batch.name} · {allocation.room.name}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
