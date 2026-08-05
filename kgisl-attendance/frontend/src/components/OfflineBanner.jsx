import { useEffect, useState } from 'react';
import { Gauge, WifiOff } from 'lucide-react';

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
  if (online) return null;
  if (!online) return <div className="network-banner network-banner--offline" role="alert"><WifiOff size={16}/><span><b>No internet.</b> Reconnect before scanning or saving changes.</span></div>;
  if (slow) return <div className="network-banner network-banner--slow" role="status"><Gauge size={16}/><span><b>Slow network.</b> Requests may take a little longer.</span></div>;
  return null;
}
