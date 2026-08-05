import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { listNotifications, markAllNotificationsRead, markNotificationRead } from '../services/api.js';

function relativeTime(value) {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const load = useCallback(async () => { try { const response = await listNotifications(); setItems(response.data || []); setUnread(response.unreadCount || 0); } finally { setLoading(false); } }, []);

  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 30_000); return () => window.clearInterval(timer); }, [load]);
  useEffect(() => { const close = (event) => { if (panelRef.current && !panelRef.current.contains(event.target)) setOpen(false); }; document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close); }, []);

  async function openNotification(item) {
    if (!item.readAt) { setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry)); setUnread((count) => Math.max(0, count - 1)); await markNotificationRead(item.id).catch(() => void 0); }
    setOpen(false); if (item.href) navigate(item.href);
  }
  async function readAll() { await markAllNotificationsRead().catch(() => void 0); setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() }))); setUnread(0); }

  return <div ref={panelRef} className="relative"><button type="button" onClick={() => setOpen((value) => !value)} className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-200 transition hover:bg-white/10" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} title="Notifications"><Bell size={18}/>{unread > 0 && <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-signal-red px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}</button>{open && <section className="absolute right-0 z-[90] mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-ink-border bg-ink-850 shadow-2xl" aria-label="Notifications"><header className="flex items-center justify-between border-b border-ink-border px-4 py-3"><div><h2 className="text-sm font-bold text-white">Notifications</h2><p className="text-[11px] text-slate-500">{unread ? `${unread} unread` : 'You are all caught up'}</p></div>{unread > 0 && <button type="button" onClick={readAll} className="flex items-center gap-1 text-xs font-semibold text-signal-blue"><CheckCheck size={14}/>Mark all read</button>}</header><div className="max-h-[24rem] overflow-y-auto">{loading ? <div className="flex items-center justify-center gap-2 px-4 py-10 text-xs text-slate-400"><Loader2 size={16} className="animate-spin"/>Loading notifications...</div> : items.length === 0 ? <p className="px-4 py-10 text-center text-xs text-slate-500">No notifications yet.</p> : items.map((item) => <button key={item.id} type="button" onClick={() => void openNotification(item)} className={`w-full border-b border-ink-border/70 px-4 py-3 text-left transition last:border-0 hover:bg-white/5 ${item.readAt ? 'opacity-65' : 'bg-signal-blue/5'}`}><div className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? 'bg-slate-600' : 'bg-signal-blue'}`}/><div className="min-w-0 flex-1"><p className="text-xs font-bold text-slate-200">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-400">{item.message}</p><p className="mt-1 text-[10px] text-slate-500">{relativeTime(item.createdAt)}</p></div></div></button>)}</div></section>}</div>;
}
