import { AlertTriangle, CheckCircle2, FileSearch, Loader2, ShieldX, WifiOff } from 'lucide-react';

const states = {
  loading: { Icon: Loader2, tone: 'border-signal-blue/25 bg-signal-blue/10 text-signal-blue', icon: 'animate-spin' },
  error: { Icon: AlertTriangle, tone: 'border-signal-red/30 bg-signal-red/10 text-red-300', icon: '' },
  empty: { Icon: FileSearch, tone: 'border-ink-border bg-ink-900/40 text-slate-300', icon: '' },
  permission: { Icon: ShieldX, tone: 'border-signal-amber/30 bg-signal-amber/10 text-signal-amber', icon: '' },
  offline: { Icon: WifiOff, tone: 'border-signal-amber/30 bg-signal-amber/10 text-signal-amber', icon: '' },
  success: { Icon: CheckCircle2, tone: 'border-signal-green/30 bg-signal-green/10 text-signal-green', icon: '' },
};

export default function StatePanel({ type = 'empty', title, description, actionLabel, onAction, compact = false }) {
  const { Icon, tone, icon } = states[type] || states.empty;
  return (
    <div className={`rounded-2xl border px-5 py-7 text-center ${tone} ${compact ? 'py-4' : ''}`} role={type === 'error' ? 'alert' : 'status'}>
      <Icon className={`mx-auto mb-3 h-7 w-7 ${icon}`} aria-hidden="true" />
      <h3 className="text-sm font-bold text-white">{title}</h3>
      {description && <p className="mx-auto mt-1.5 max-w-md text-xs leading-5 text-slate-400">{description}</p>}
      {actionLabel && onAction && <button type="button" onClick={onAction} className="mt-4 rounded-lg border border-current/30 px-3 py-2 text-xs font-bold transition hover:bg-white/10">{actionLabel}</button>}
    </div>
  );
}
