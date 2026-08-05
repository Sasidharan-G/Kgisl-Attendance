import { useEffect, useState } from 'react';
import { Gauge, Wifi, WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const sync = () => {
      setOnline(navigator.onLine);
      setSlow(Boolean(connection && (connection.saveData || ['slow-2g', '2g'].includes(connection.effectiveType) || connection.rtt > 800)));
    };
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    connection?.addEventListener?.('change', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
      connection?.removeEventListener?.('change', sync);
    };
  }, []);
  if (!online) return <div className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-amber-500 px-3 py-2 text-sm font-semibold text-black"><WifiOff size={16}/>No internet connection. Reconnect before scanning or saving changes.</div>;
  if (!slow) return null;
  return <div className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 bg-sky-500 px-3 py-2 text-sm font-semibold text-slate-950"><Gauge size={16}/>Slow network detected. Your request may take a little longer. <Wifi size={15}/></div>;
}
