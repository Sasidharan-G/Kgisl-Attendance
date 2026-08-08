import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function StudentTheme() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('kgisl_workspace_theme') !== 'light');

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('workspace-dark', 'student-portal');
      document.body.classList.remove('student-portal-light');
    } else {
      document.body.classList.add('student-portal-light');
      document.body.classList.remove('workspace-dark', 'student-portal');
    }
    localStorage.setItem('kgisl_workspace_theme', darkMode ? 'dark' : 'light');

    return () => {
      document.body.classList.remove('workspace-dark', 'student-portal-light', 'student-portal');
    };
  }, [darkMode]);

  return (
    <button
      type="button"
      onClick={() => setDarkMode((current) => !current)}
      className="student-theme-toggle fixed bottom-5 left-5 z-[99] flex h-11 items-center gap-2 rounded-2xl px-3.5 shadow-xl transition-all active:scale-95 bg-slate-900/90 border border-slate-700 text-white backdrop-blur-md"
      aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      title={darkMode ? 'Light mode' : 'Dark mode'}
    >
      {darkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-blue-400" />}
      <span className="text-xs font-bold">{darkMode ? 'Light' : 'Dark'}</span>
    </button>
  );
}
