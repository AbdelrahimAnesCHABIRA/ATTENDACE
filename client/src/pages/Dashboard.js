import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { analyticsAPI, scheduleAPI, sessionAPI } from '../services/api';
import {
  Users,
  CalendarDays,
  QrCode,
  AlertTriangle,
  TrendingUp,
  Clock,
  ArrowRight,
} from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [todaySchedules, setTodaySchedules] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      analyticsAPI.getOverview(),
      scheduleAPI.getToday(),
      sessionAPI.getActive(),
    ]).then(([statsRes, schedRes, sessRes]) => {
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data);
      if (schedRes.status === 'fulfilled') setTodaySchedules(schedRes.value.data.schedules || []);
      if (sessRes.status === 'fulfilled') setActiveSessions(sessRes.value.data.sessions || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Welcome back, {user?.name?.split(' ')[0] || 'Teacher'}</h2>
        <p>Here's what's happening with your classes today.</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><CalendarDays size={20} /></div>
          <div className="stat-label">Total Sessions</div>
          <div className="stat-value">{stats?.totalSessions || 0}</div>
          <div className="stat-change">{stats?.todaySessions || 0} today</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><Users size={20} /></div>
          <div className="stat-label">Unique Students</div>
          <div className="stat-value">{stats?.uniqueStudents || 0}</div>
          <div className="stat-change">{stats?.todayAttendees || 0} today</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><TrendingUp size={20} /></div>
          <div className="stat-label">Avg per Session</div>
          <div className="stat-value">{stats?.averageAttendancePerSession || 0}</div>
          <div className="stat-change">students average</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><AlertTriangle size={20} /></div>
          <div className="stat-label">Flagged</div>
          <div className="stat-value">{stats?.flaggedCount || 0}</div>
          <div className="stat-change">violations detected</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Today's Sessions */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Today's Sessions</h3>
            <button className="btn btn-sm btn-secondary" onClick={() => navigate('/schedule')}>
              View All <ArrowRight size={14} />
            </button>
          </div>
          {todaySchedules.length === 0 ? (
            <div className="empty-state">
              <CalendarDays size={40} />
              <h3>No sessions today</h3>
              <p>You can generate a QR code on-the-fly</p>
            </div>
          ) : (
            todaySchedules.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.subjectName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {s.sessionType.toUpperCase()} &bull; Year {s.year} &bull; {s.sectionOrGroup}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    <Clock size={12} style={{ marginRight: 4 }} />
                    {s.startTime} - {s.endTime}
                  </div>
                </div>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => navigate('/qr-codes', { state: { schedule: s } })}
                >
                  <QrCode size={14} /> Generate QR
                </button>
              </div>
            ))
          )}
        </div>

        {/* Active QR Codes */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Active QR Codes</h3>
            <button className="btn btn-sm btn-primary" onClick={() => navigate('/qr-codes')}>
              <QrCode size={14} /> New QR Code
            </button>
          </div>
          {activeSessions.length === 0 ? (
            <div className="empty-state">
              <QrCode size={40} />
              <h3>No active sessions</h3>
              <p>Generate a QR code to start an attendance session</p>
            </div>
          ) : (
            activeSessions.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.subjectName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {s.sessionType.toUpperCase()} &bull; {s.attendeeCount} attendees
                  </div>
                </div>
                <span className="badge badge-success pulse">Live</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Quick Generate Button */}
      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <button
          className="btn btn-lg btn-primary"
          onClick={() => navigate('/qr-codes')}
          style={{ padding: '16px 40px', fontSize: 16 }}
        >
          <QrCode size={20} /> Generate QR Code Now
        </button>
      </div>
    </div>
  );
}
