import React, { useState, useEffect } from 'react';
import { attendanceAPI, sessionAPI } from '../services/api';
import { Search, Download, Users, CheckCircle, AlertTriangle } from 'lucide-react';

export default function AttendanceRecords() {
  const [tab, setTab] = useState('sessions');
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      sessionAPI.getHistory(),
      attendanceAPI.getStats(),
    ]).then(([sessRes, statsRes]) => {
      setSessions(sessRes.data.sessions || []);
      setStats(statsRes.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadSessionRecords = async (sessionId) => {
    try {
      const res = await attendanceAPI.getBySession(sessionId);
      setRecords(res.data.records || []);
      setSelectedSession(sessions.find(s => s.id === sessionId));
    } catch (err) {
      console.error(err);
    }
  };

  const searchStudent = async () => {
    if (!searchTerm) return;
    try {
      const res = await attendanceAPI.getByStudent(searchTerm);
      setRecords(res.data.records || []);
      setSelectedSession(null);
    } catch (err) {
      console.error(err);
    }
  };

  const exportCSV = () => {
    if (records.length === 0) return;
    const headers = ['Timestamp', 'Student Name', 'Email', 'Status', 'IP Address'];
    const csvContent = [
      headers.join(','),
      ...records.map(r =>
        [r.timestamp, r.studentName, r.email, r.status, r.ipAddress].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${selectedSession?.subjectName || 'records'}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return <div className="loading-container"><div className="spinner" /><p>Loading...</p></div>;
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Attendance Records</h2>
        <p>View and manage attendance data across all sessions</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <div className="stat-icon blue"><Users size={20} /></div>
            <div className="stat-label">Total Submissions</div>
            <div className="stat-value">{stats.totalSubmissions}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><CheckCircle size={20} /></div>
            <div className="stat-label">Present</div>
            <div className="stat-value">{stats.presentCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><AlertTriangle size={20} /></div>
            <div className="stat-label">Flagged</div>
            <div className="stat-value">{stats.flaggedCount}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon yellow"><Users size={20} /></div>
            <div className="stat-label">Unique Students</div>
            <div className="stat-value">{stats.uniqueStudents}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'sessions' ? 'active' : ''}`} onClick={() => setTab('sessions')}>By Session</button>
        <button className={`tab ${tab === 'student' ? 'active' : ''}`} onClick={() => setTab('student')}>By Student</button>
      </div>

      {tab === 'sessions' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
          {/* Session List */}
          <div className="card" style={{ maxHeight: 600, overflowY: 'auto' }}>
            <h3 className="card-title" style={{ marginBottom: 16 }}>Sessions</h3>
            {sessions.map(s => (
              <div
                key={s.id}
                onClick={() => loadSessionRecords(s.id)}
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background: selectedSession?.id === s.id ? '#eff6ff' : 'transparent',
                  borderRadius: 'var(--radius)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{s.subjectName}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {s.sessionType.toUpperCase()} &bull; {new Date(s.createdAt).toLocaleDateString()} &bull; {s.attendeeCount} students
                </div>
              </div>
            ))}
            {sessions.length === 0 && (
              <div className="empty-state">
                <p>No sessions yet</p>
              </div>
            )}
          </div>

          {/* Records Table */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                {selectedSession ? `${selectedSession.subjectName} — ${new Date(selectedSession.createdAt).toLocaleDateString()}` : 'Select a session'}
              </h3>
              {records.length > 0 && (
                <button className="btn btn-sm btn-secondary" onClick={exportCSV}>
                  <Download size={14} /> Export CSV
                </button>
              )}
            </div>
            {records.length > 0 ? (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Time</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td style={{ fontWeight: 500 }}>{r.studentName}</td>
                        <td>{r.email}</td>
                        <td>{new Date(r.timestamp).toLocaleTimeString()}</td>
                        <td>
                          <span className={`badge ${r.status === 'PRESENT' ? 'badge-success' : 'badge-danger'}`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <Users size={40} />
                <h3>{selectedSession ? 'No records yet' : 'Select a session to view records'}</h3>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'student' && (
        <div className="card">
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <input
              className="form-input"
              placeholder="Enter student email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && searchStudent()}
              style={{ maxWidth: 400 }}
            />
            <button className="btn btn-primary" onClick={searchStudent}>
              <Search size={16} /> Search
            </button>
          </div>
          {records.length > 0 && !selectedSession ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Session</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td>{r.sessionId.slice(0, 8)}...</td>
                      <td>{new Date(r.timestamp).toLocaleDateString()}</td>
                      <td>{new Date(r.timestamp).toLocaleTimeString()}</td>
                      <td>
                        <span className={`badge ${r.status === 'PRESENT' ? 'badge-success' : 'badge-danger'}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <Search size={40} />
              <h3>Search for a student</h3>
              <p>Enter a student's email address to view their attendance records</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
