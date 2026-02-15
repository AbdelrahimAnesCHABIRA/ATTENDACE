import React from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import { GraduationCap } from 'lucide-react';

export default function Login() {
  const { user } = useAuth();

  const handleGoogleLogin = async () => {
    try {
      const res = await authAPI.getGoogleAuthUrl();
      if (res.data.authUrl) {
        window.location.href = res.data.authUrl;
      } else {
        alert('Server did not return an auth URL. Check server logs.');
      }
    } catch (err) {
      console.error('Google auth error:', err);
      if (!err.response) {
        alert('Cannot reach the server. Please try again later.');
      } else {
        alert('Login failed: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  if (user) {
    window.location.href = '/dashboard';
    return null;
  }

  return (
    <div className="login-page">
      <div className="login-card fade-in">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: '#eff6ff', display: 'flex',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <GraduationCap size={32} color="var(--primary)" />
          </div>
        </div>
        <h1>AttendQR</h1>
        <p className="subtitle">University Attendance Management System</p>

        <button className="google-btn" onClick={handleGoogleLogin}>
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Sign in with Google
        </button>

        <div style={{ marginTop: 32, fontSize: 12, color: 'var(--text-muted)' }}>
          <p>Teachers: Sign in with your university Google account</p>
          <p style={{ marginTop: 4 }}>Students: Scan the QR code shared by your teacher</p>
        </div>
      </div>
    </div>
  );
}
