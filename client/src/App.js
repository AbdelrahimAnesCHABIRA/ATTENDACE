import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import QRCodes from './pages/QRCodes';
import AttendanceRecords from './pages/AttendanceRecords';
import Analytics from './pages/Analytics';
import CheatingLogs from './pages/CheatingLogs';
import Settings from './pages/Settings';
import StudentAttendance from './pages/StudentAttendance';

// Layout
import DashboardLayout from './components/DashboardLayout';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/attend/:sessionId" element={<StudentAttendance />} />

      {/* Protected teacher routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="qr-codes" element={<QRCodes />} />
        <Route path="attendance" element={<AttendanceRecords />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="cheating-logs" element={<CheatingLogs />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { fontFamily: 'Inter, sans-serif', fontSize: '14px' },
          }}
        />
      </Router>
    </AuthProvider>
  );
}

export default App;
