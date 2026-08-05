import { AlertTriangle, CheckCircle2, FileSearch, Loader2, SearchX, ShieldX, Timer, WifiOff } from 'lucide-react';

const states = {
  loading: { Icon: Loader2, tone: 'state-panel--loading', spin: true },
  error: { Icon: AlertTriangle, tone: 'state-panel--error' },
  empty: { Icon: FileSearch, tone: 'state-panel--empty' },
  search: { Icon: SearchX, tone: 'state-panel--empty' },
  permission: { Icon: ShieldX, tone: 'state-panel--warning' },
  offline: { Icon: WifiOff, tone: 'state-panel--warning' },
  slow: { Icon: Timer, tone: 'state-panel--loading' },
  success: { Icon: CheckCircle2, tone: 'state-panel--success' },
};

export default function StatePanel({ type = 'empty', title, description, actionLabel, onAction, compact = false }) {
  const state = states[type] || states.empty;
  const role = type === 'error' || type === 'permission' || type === 'offline' ? 'alert' : 'status';
  return (
    <section className={`state-panel ${state.tone} ${compact ? 'state-panel--compact' : ''}`} role={role} aria-live={type === 'loading' ? 'polite' : undefined}>
      <span className="state-panel__icon"><state.Icon className={state.spin ? 'animate-spin' : ''} aria-hidden="true" /></span>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {actionLabel && onAction && <button type="button" onClick={onAction}>{actionLabel}</button>}
    </section>
  );
}
