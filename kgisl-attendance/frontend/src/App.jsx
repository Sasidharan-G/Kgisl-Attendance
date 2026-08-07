import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import AgentChat from './components/AgentChat.jsx';
import StatePanel from './components/StatePanel.jsx';
import StudentTheme from './components/StudentTheme.jsx';

const PortalSelect = lazy(() => import('./pages/PortalSelect.jsx'));
const FacultyDashboard = lazy(() => import('./pages/FacultyDashboard.jsx'));
const StudentScanPage = lazy(() => import('./pages/StudentScanPage.jsx'));
const StudentsPage = lazy(() => import('./pages/StudentsPage.jsx'));
const TimetablePage = lazy(() => import('./pages/TimetablePage.jsx'));
const AddFacultyPage = lazy(() => import('./pages/AddFacultyPage.jsx'));
const AnalyticsDashboard = lazy(() => import('./pages/AnalyticsDashboard.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const StudentAttendancePage = lazy(() => import('./pages/StudentAttendancePage.jsx'));
const LeaveRequestsPage = lazy(() => import('./pages/LeaveRequestsPage.jsx'));
const AcademicSetupPage = lazy(() => import('./pages/AcademicSetupPage.jsx'));
const StudentDashboardPage = lazy(() => import('./pages/StudentDashboardPage.jsx'));
const CorrectionRequestsPage = lazy(() => import('./pages/CorrectionRequestsPage.jsx'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage.jsx'));
const AcademicCalendarPage = lazy(() => import('./pages/AcademicCalendarPage.jsx'));

function ProtectedRoute({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (role && user.role !== role) return <div className="flex min-h-screen items-center justify-center bg-ink-950 px-5"><div className="w-full max-w-md"><StatePanel type="permission" title="Permission denied" description={`This page is available only to ${role.toLowerCase()} accounts. You are signed in as ${user.role.toLowerCase()}.`} actionLabel="Return to my portal" onAction={() => window.location.assign(user.role === 'STUDENT' ? '/student/dashboard' : user.role === 'FACULTY' ? '/faculty/dashboard' : '/admin/timetable')} /></div></div>;
  return role === 'STUDENT' ? <><StudentTheme />{children}</> : children;
}

function GlobalAgent() {
  const { user } = useAuth();
  const location = useLocation();
  const isPublicPage = location.pathname === '/' || location.pathname === '/privacy';
  if (!user || isPublicPage) return null;
  return <AgentChat />;
}

export default function App() {
  return (
    <AuthProvider>
      <div id="main-content" tabIndex="-1">
      <OfflineBanner />
      <BrowserRouter>
        <GlobalAgent />
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-ink-950 px-5"><div className="w-full max-w-md"><StatePanel type="loading" title="Opening your workspace" description="Loading your attendance tools and latest records." /></div></div>}>
        <Routes>
          <Route path="/" element={<PortalSelect />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/admin/timetable" element={<ProtectedRoute role="ADMIN"><TimetablePage /></ProtectedRoute>} />
          <Route path="/admin/academic" element={<ProtectedRoute role="ADMIN"><AcademicSetupPage /></ProtectedRoute>} />
          <Route path="/admin/calendar" element={<ProtectedRoute role="ADMIN"><AcademicCalendarPage /></ProtectedRoute>} />
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
            path="/faculty/add-faculty"
            element={
              <ProtectedRoute role="FACULTY">
                <AddFacultyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/faculty/calendar"
            element={
              <ProtectedRoute role="FACULTY">
                <AcademicCalendarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/dashboard"
            element={<ProtectedRoute role="STUDENT"><StudentDashboardPage /></ProtectedRoute>}
          />
          <Route
            path="/student/calendar"
            element={<ProtectedRoute role="STUDENT"><AcademicCalendarPage /></ProtectedRoute>}
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
          <Route path="/admin/corrections" element={<ProtectedRoute role="ADMIN"><CorrectionRequestsPage /></ProtectedRoute>} />
          <Route path="/faculty/corrections" element={<ProtectedRoute role="FACULTY"><CorrectionRequestsPage /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
      </div>
    </AuthProvider>
  );
}

