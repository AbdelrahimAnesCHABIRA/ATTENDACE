import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  CalendarDays,
  QrCode,
  ClipboardList,
  BarChart3,
  ShieldAlert,
  Settings,
  LogOut,
  Menu,
  X,
  GraduationCap,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/schedule', icon: CalendarDays, label: 'Schedule' },
  { to: '/qr-codes', icon: QrCode, label: 'QR Codes' },
  { to: '/attendance', icon: ClipboardList, label: 'Attendance' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/cheating-logs', icon: ShieldAlert, label: 'Cheating Logs' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile header */}
      <div className="mobile-header">
        <button className="btn-icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <span style={{ fontWeight: 600, color: 'var(--primary)' }}>Attendance System</span>
        <div style={{ width: 32 }} />
      </div>

      <div className="app-layout">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-logo">
            <GraduationCap size={28} color="var(--primary)" />
            <h1>AttendQR</h1>
          </div>

          <nav className="sidebar-nav">
            {navItems.map(({ to, icon: Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* User info at bottom */}
          <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid var(--border)' }}>
            {user && (
              <div style={{ padding: '8px 12px', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{user.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user.email}</div>
              </div>
            )}
            <button className="nav-item" onClick={handleLogout} style={{ color: 'var(--danger)' }}>
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="main-content">
          <Outlet />
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 35,
          }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
}
