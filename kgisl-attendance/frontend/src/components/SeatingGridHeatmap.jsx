import React from 'react';
import { UserCheck, UserX, Grid, ShieldAlert } from 'lucide-react';

export default function SeatingGridHeatmap({ activeSession }) {
  // Generate 24 classroom seats (6 columns x 4 rows layout)
  const totalSeats = 24;
  const scannedSeats = [1, 2, 4, 5, 8, 9, 11, 14, 15, 17, 18, 20, 21, 23];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 mb-4 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Grid className="h-5 w-5 text-blue-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Live Classroom Seating Heatmap
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" /> Real-Time Grid
              </span>
            </h3>
            <p className="text-xs text-slate-400">Visual occupancy layout as students scan dynamic QR</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-bold">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="h-3 w-3 rounded-md bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            <span>Present ({scannedSeats.length})</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-400">
            <span className="h-3 w-3 rounded-md bg-slate-800 border border-rose-500/40" />
            <span>Empty / Absent ({totalSeats - scannedSeats.length})</span>
          </div>
        </div>
      </div>

      {/* Classroom Podium Screen Indicator */}
      <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/80 py-1.5 text-center text-[10px] font-extrabold uppercase tracking-widest text-slate-400 shadow-inner">
        🖥️ CLASSROOM FRONT / PROJECTOR SCREEN
      </div>

      {/* 6x4 Grid Layout */}
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
        {Array.from({ length: totalSeats }).map((_, idx) => {
          const seatNo = idx + 1;
          const isPresent = scannedSeats.includes(seatNo);

          return (
            <div
              key={seatNo}
              className={`flex flex-col items-center justify-center rounded-xl p-3 border transition-all duration-300 ${
                isPresent
                  ? 'border-emerald-500/50 bg-emerald-950/40 shadow-lg shadow-emerald-950/40 hover:scale-105'
                  : 'border-slate-800 bg-slate-950/40 opacity-60'
              }`}
            >
              <div className="flex items-center justify-center mb-1">
                {isPresent ? (
                  <UserCheck className="h-4 w-4 text-emerald-400" />
                ) : (
                  <UserX className="h-4 w-4 text-slate-500" />
                )}
              </div>
              <span className={`text-[11px] font-bold ${isPresent ? 'text-emerald-300' : 'text-slate-400'}`}>
                Seat #{seatNo}
              </span>
              <span className="text-[9px] font-semibold text-slate-400">
                {isPresent ? 'Present' : 'Empty'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
