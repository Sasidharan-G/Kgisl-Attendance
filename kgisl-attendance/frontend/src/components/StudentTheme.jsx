import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

export default function StudentTheme() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('kgisl_workspace_theme') !== 'light');

  useEffect(() => {
    document.body.classList.toggle('workspace-dark', darkMode);
    document.body.classList.toggle('student-portal-light', !darkMode);
    document.body.classList.add('student-portal');
    localStorage.setItem('kgisl_workspace_theme', darkMode ? 'dark' : 'light');

    return () => {
      document.body.classList.remove('workspace-dark', 'student-portal-light', 'student-portal');
    };
  }, [darkMode]);

  return (
    <button
      type="button"
      onClick={() => setDarkMode((current) => !current)}
      className="student-theme-toggle fixed right-4 top-4 z-[90] grid h-10 w-10 place-items-center rounded-xl"
      aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      title={darkMode ? 'Light mode' : 'Dark mode'}
    >
      {darkMode ? <Sun size={17}/> : <Moon size={17}/>}
    </button>
  );
}
