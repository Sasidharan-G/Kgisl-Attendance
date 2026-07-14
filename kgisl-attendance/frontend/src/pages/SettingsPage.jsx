import { useState } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import TopBar from '../components/TopBar.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { Settings, Shield, KeyRound, Wifi, MapPin } from 'lucide-react';
import { changePassword } from '../services/api.js';

export default function SettingsPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must contain at least 8 characters');
      return;
    }
    setError(''); setSuccess('');
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess('Password updated successfully!');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Could not update password');
    }
  };

  return (
    <div className="flex min-h-screen bg-ink-950">
      <Sidebar />

      <main className="flex-1 min-w-0 pb-10">
        <TopBar connected={true} />

        <div className="px-8 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile card & general details (1-col) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-2xl border border-ink-border bg-ink-850/60 shadow-card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal-blue/10 border border-signal-blue/20 text-signal-blue">
                  <Shield size={18} />
                </div>
                <h3 className="text-lg font-bold text-white">Profile Details</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Staff Name</p>
                  <p className="text-sm font-semibold text-white mt-0.5">{user?.name || 'Staff'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Email Address</p>
                  <p className="text-sm font-mono text-slate-300 mt-0.5">{user?.email || 'name@kgisl-iim.ac.in'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Designation Role</p>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-signal-red/10 text-signal-red border border-signal-red/20 mt-1">
                    {user?.role || 'FACULTY'}
                  </span>
                </div>
              </div>
            </div>

            {/* Geofence specs card */}
            <div className="rounded-2xl border border-ink-border bg-ink-850/60 shadow-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal-green/10 border border-signal-green/20 text-signal-green">
                  <MapPin size={18} />
                </div>
                <h3 className="text-sm font-bold text-white">Security & Geofence</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">Default classroom configurations for proxy detection checks</p>

              <div className="space-y-3">
                <div className="flex justify-between items-center p-2.5 rounded-lg bg-ink-900 border border-ink-border text-xs">
                  <span className="text-slate-400">Default Radius</span>
                  <span className="text-white font-semibold font-mono">120 meters</span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-lg bg-ink-900 border border-ink-border text-xs">
                  <span className="text-slate-400">Wi-Fi BSSID Check</span>
                  <span className="text-signal-green font-semibold">Enabled</span>
                </div>
              </div>
            </div>
          </div>

          {/* Change Password Form (2-col) */}
          <div className="lg:col-span-2 rounded-2xl border border-ink-border bg-ink-850/60 shadow-card p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-signal-amber/10 border border-signal-amber/20 text-signal-amber">
                <KeyRound size={18} />
              </div>
              <h3 className="text-lg font-bold text-white">Change Password</h3>
            </div>

            {error && (
              <p className="rounded-lg border border-signal-red/30 bg-signal-red/10 px-4 py-2 text-xs text-red-300 mb-5">
                {error}
              </p>
            )}

            {success && (
              <p className="rounded-lg border border-signal-green/30 bg-signal-green/10 px-4 py-2 text-xs text-signal-green mb-5">
                {success}
              </p>
            )}

            <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-md">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-ink-900 border border-ink-border rounded-xl text-slate-200 focus:outline-none focus:border-signal-red transition text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-ink-900 border border-ink-border rounded-xl text-slate-200 focus:outline-none focus:border-signal-red transition text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-ink-900 border border-ink-border rounded-xl text-slate-200 focus:outline-none focus:border-signal-red transition text-sm"
                />
              </div>

              <button
                type="submit"
                className="py-2.5 px-6 bg-signal-red hover:bg-red-600 font-semibold text-white rounded-xl transition text-sm shadow-md mt-6"
              >
                Update Password
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
