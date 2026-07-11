import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import PortalSelect from './pages/PortalSelect.jsx';
import FacultyDashboard from './pages/FacultyDashboard.jsx';
import StudentScanPage from './pages/StudentScanPage.jsx';
import StudentsPage from './pages/StudentsPage.jsx';
import CoursesPage from './pages/CoursesPage.jsx';
import TimetablePage from './pages/TimetablePage.jsx';
import AddFacultyPage from './pages/AddFacultyPage.jsx';
import AnalyticsDashboard from './pages/AnalyticsDashboard.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import LogsPage from './pages/LogsPage.jsx';

function ProtectedRoute({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PortalSelect />} />
          <Route path="/admin/timetable" element={<ProtectedRoute role="ADMIN"><TimetablePage /></ProtectedRoute>} />
          <Route path="/admin/students" element={<ProtectedRoute role="ADMIN"><StudentsPage /></ProtectedRoute>} />
          <Route path="/admin/faculty" element={<ProtectedRoute role="ADMIN"><AddFacultyPage /></ProtectedRoute>} />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

