import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleReturn = () => {
    if (!user) {
      navigate('/');
    } else if (user.role === 'STUDENT') {
      navigate('/student/dashboard');
    } else if (user.role === 'FACULTY') {
      navigate('/faculty/dashboard');
    } else {
      navigate('/admin/timetable');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-5 py-12">
      <div className="w-full max-w-lg text-center">
        <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-lg shadow-amber-500/5">
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">404</h1>
        <p className="mt-2 text-lg font-medium text-slate-300">Page Not Found</p>
        <p className="mt-3 text-sm text-slate-400 max-w-md mx-auto">
          The page you are trying to access doesn't exist or may have been moved.
        </p>

        <div className="mt-8 flex justify-center gap-4">
          <button
            onClick={handleReturn}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-slate-950 shadow-md shadow-amber-500/20"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
