import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import AgentChat from './components/AgentChat.jsx';

const PortalSelect = lazy(() => import('./pages/PortalSelect.jsx'));
const FacultyDashboard = lazy(() => import('./pages/FacultyDashboard.jsx'));
const StudentScanPage = lazy(() => import('./pages/StudentScanPage.jsx'));
const StudentsPage = lazy(() => import('./pages/StudentsPage.jsx'));
const CoursesPage = lazy(() => import('./pages/CoursesPage.jsx'));
const TimetablePage = lazy(() => import('./pages/TimetablePage.jsx'));
const AddFacultyPage = lazy(() => import('./pages/AddFacultyPage.jsx'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const LogsPage = lazy(() => import('./pages/LogsPage.jsx'));
const StudentAttendancePage = lazy(() => import('./pages/StudentAttendancePage.jsx'));
const LeaveRequestsPage = lazy(() => import('./pages/LeaveRequestsPage.jsx'));
const AcademicSetupPage = lazy(() => import('./pages/AcademicSetupPage.jsx'));

function ProtectedRoute({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function GlobalAgent() {
  const { user } = useAuth();
  return user?.role === 'ADMIN' || user?.role === 'FACULTY' ? <AgentChat /> : null;
}

export default function App() {
  return (
    <AuthProvider>
      <OfflineBanner />
      <BrowserRouter>
        <GlobalAgent />
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-ink-950 text-slate-300">Loading...</div>}>
        <Routes>
          <Route path="/" element={<PortalSelect />} />
          <Route path="/admin/timetable" element={<ProtectedRoute role="ADMIN"><TimetablePage /></ProtectedRoute>} />
          <Route path="/admin/academic" element={<ProtectedRoute role="ADMIN"><AcademicSetupPage /></ProtectedRoute>} />
          <Route path="/admin/students" element={<ProtectedRoute role="ADMIN"><StudentsPage /></ProtectedRoute>} />
          <Route path="/admin/faculty" element={<ProtectedRoute role="ADMIN"><AddFacultyPage /></ProtectedRoute>} />
          <Route path="/admin/analytics" element={<ProtectedRoute role="ADMIN"><AnalyticsDashboard /></ProtectedRoute>} />
          <Route
            path="/faculty/dashboard"
            element={
              <ProtectedRoute role="FACULTY">
                <FacultyDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/analytics"
            element={
              <ProtectedRoute role="FACULTY">
                <AnalyticsDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/students"
            element={
              <ProtectedRoute role="FACULTY">
                <StudentsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/courses"
            element={
              <ProtectedRoute role="FACULTY">
                <CoursesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/timetable"
            element={
              <ProtectedRoute role="FACULTY">
                <TimetablePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/settings"
            element={
              <ProtectedRoute role="FACULTY">
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/logs"
            element={
              <ProtectedRoute role="FACULTY">
                <LogsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/add-faculty"
            element={
              <ProtectedRoute role="FACULTY">
                <AddFacultyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/scan"
            element={
              <ProtectedRoute role="STUDENT">
                <StudentScanPage />
              </ProtectedRoute>
            }
          />
          <Route path="/student/attendance" element={<ProtectedRoute role="STUDENT"><StudentAttendancePage /></ProtectedRoute>} />
          <Route path="/student/leave" element={<ProtectedRoute role="STUDENT"><LeaveRequestsPage /></ProtectedRoute>} />
          <Route path="/faculty/leave" element={<ProtectedRoute role="FACULTY"><LeaveRequestsPage /></ProtectedRoute>} />
          <Route path="/admin/leave" element={<ProtectedRoute role="ADMIN"><LeaveRequestsPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

