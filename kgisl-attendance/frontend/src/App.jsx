import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import OfflineBanner from './components/OfflineBanner.jsx';
import StatePanel from './components/StatePanel.jsx';
import StudentTheme from './components/StudentTheme.jsx';

import ErrorBoundary from './components/ErrorBoundary.jsx';

function safeLazy(importFunc) {
  return lazy(async () => {
    try {
      return await importFunc();
    } catch (err) {
      console.error('Lazy load chunk failed, reloading page to fetch latest version...', err);
      const lastReload = sessionStorage.getItem('kgisl_last_chunk_reload');
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem('kgisl_last_chunk_reload', String(now));
        window.location.reload();
      }
      throw err;
    }
  });
}

const PortalSelect = safeLazy(() => import('./pages/PortalSelect.jsx'));
const FacultyDashboard = safeLazy(() => import('./pages/FacultyDashboard.jsx'));
const StudentScanPage = safeLazy(() => import('./pages/StudentScanPage.jsx'));
const StudentsPage = safeLazy(() => import('./pages/StudentsPage.jsx'));
const TimetablePage = safeLazy(() => import('./pages/TimetablePage.jsx'));
const AddFacultyPage = safeLazy(() => import('./pages/AddFacultyPage.jsx'));
const AnalyticsDashboard = safeLazy(() => import('./pages/AnalyticsDashboard.jsx'));
const SettingsPage = safeLazy(() => import('./pages/SettingsPage.jsx'));
const StudentAttendancePage = safeLazy(() => import('./pages/StudentAttendancePage.jsx'));
const LeaveRequestsPage = safeLazy(() => import('./pages/LeaveRequestsPage.jsx'));
const AcademicSetupPage = safeLazy(() => import('./pages/AcademicSetupPage.jsx'));
const StudentDashboardPage = safeLazy(() => import('./pages/StudentDashboardPage.jsx'));
const CorrectionRequestsPage = safeLazy(() => import('./pages/CorrectionRequestsPage.jsx'));
const PrivacyPolicyPage = safeLazy(() => import('./pages/PrivacyPolicyPage.jsx'));
const AcademicCalendarPage = safeLazy(() => import('./pages/AcademicCalendarPage.jsx'));
const ForcePasswordChangePage = safeLazy(() => import('./pages/ForcePasswordChangePage.jsx'));
const NotFoundPage =safeLazy(() => import('./pages/NotFoundPage.jsx'));

function ProtectedRoute({ role, children }) {
  const { user, mustChangePassword } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (mustChangePassword) return <Suspense fallback={null}><ForcePasswordChangePage /></Suspense>;
  if (role && user.role !== role) return <div className="flex min-h-screen items-center justify-center bg-ink-950 px-5"><div className="w-full max-w-md"><StatePanel type="permission" title="Permission denied" description={`This page is available only to ${role.toLowerCase()} accounts. You are signed in as ${user.role.toLowerCase()}.`} actionLabel="Return to my portal" onAction={() => window.location.assign(user.role === 'STUDENT' ? '/student/dashboard' : user.role === 'FACULTY' ? '/faculty/dashboard' : '/admin/timetable')} /></div></div>;
  return role === 'STUDENT' ? <><StudentTheme />{children}</> : children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <div id="main-content" tabIndex="-1">
        <OfflineBanner />
        <BrowserRouter>
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
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
        </div>
      </AuthProvider>
    </ErrorBoundary>
  );
}

