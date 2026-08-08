import React from 'react';
import { Flame, Award, Zap, ShieldCheck, Sparkles } from 'lucide-react';

export default function BadgesWidget({ attendancePercentage = 88, streakDays = 7 }) {
  const badges = [
    {
      id: 'streak',
      title: `${streakDays}-Day Attendance Streak`,
      desc: 'Attended all consecutive sessions without missing!',
      icon: Flame,
      color: 'from-amber-500 to-orange-500',
      textColor: 'text-amber-400',
      active: streakDays >= 3,
    },
    {
      id: 'early_bird',
      title: 'Early Bird Scanner',
      desc: 'Top 3 fastest QR scanner in class session!',
      icon: Zap,
      color: 'from-yellow-400 to-amber-500',
      textColor: 'text-yellow-400',
      active: true,
    },
    {
      id: 'golden_punctual',
      title: 'Golden Punctuality Badge',
      desc: 'Maintained >=85% attendance across all subjects!',
      icon: Award,
      color: 'from-emerald-400 to-teal-500',
      textColor: 'text-emerald-400',
      active: attendancePercentage >= 85,
    },
    {
      id: 'master_shield',
      title: 'Anti-Bunk Shield',
      desc: 'Zero unexcused absences this academic month!',
      icon: ShieldCheck,
      color: 'from-blue-500 to-indigo-500',
      textColor: 'text-blue-400',
      active: attendancePercentage >= 75,
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Flame className="h-5 w-5 animate-pulse text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Punctuality Streaks & Badges
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                <Sparkles className="h-3 w-3" /> Gamified
              </span>
            </h3>
            <p className="text-xs text-slate-400">Earn badges for regular attendance & early scanning</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-1.5 border border-amber-500/20">
          <Flame className="h-4 w-4 text-orange-400 fill-orange-400 animate-bounce" />
          <span className="text-xs font-extrabold text-amber-300">{streakDays} Day Streak</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {badges.map((b) => {
          const Icon = b.icon;
          return (
            <div
              key={b.id}
              className={`flex items-start gap-3 rounded-xl border p-3.5 transition-all duration-200 ${
                b.active
                  ? 'border-slate-700/80 bg-slate-950/80 shadow-md hover:border-slate-600'
                  : 'border-slate-800/40 bg-slate-950/30 opacity-50'
              }`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${b.color} text-slate-950 shadow-md`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-100 truncate">{b.title}</h4>
                  {b.active && (
                    <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                      UNLOCKED
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">{b.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
