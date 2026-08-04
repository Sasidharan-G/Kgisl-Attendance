import { useLocation } from 'react-router-dom';

const transitionFor = (path) => {
  if (path === '/') return 'vault-reveal';
  if (path.includes('analytics')) return 'gold-orbit';
  if (path.includes('timetable') || path.includes('academic')) return 'ledger-rise';
  if (path.includes('student')) return 'amber-sweep';
  if (path.includes('leave') || path.includes('corrections')) return 'silk-slide';
  return 'obsidian-lift';
};

export default function PageTransition({ children }) {
  const { pathname } = useLocation();
  return (
    <div key={pathname} className={`page-transition ${transitionFor(pathname)}`}>
      {children}
    </div>
  );
}
