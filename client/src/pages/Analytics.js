import React, { useState, useEffect } from 'react';
import { analyticsAPI } from '../services/api';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { TrendingUp, Users, BookOpen, AlertTriangle } from 'lucide-react';

const COLORS = ['#1e40af', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

export default function Analytics() {
  const [overview, setOverview] = useState(null);
  const [trends, setTrends] = useState([]);
  const [courses, setCourses] = useState([]);
  const [lowAttendance, setLowAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    Promise.allSettled([
      analyticsAPI.getOverview(),
      analyticsAPI.getTrends(30),
      analyticsAPI.getCourses(),
      analyticsAPI.getLowAttendance(70),
    ]).then(([overviewRes, trendsRes, coursesRes, lowRes]) => {
      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.data);
      if (trendsRes.status === 'fulfilled') setTrends(trendsRes.value.data.trends || []);
      if (coursesRes.status === 'fulfilled') setCourses(coursesRes.value.data.courses || []);
      if (lowRes.status === 'fulfilled') setLowAttendance(lowRes.value.data.students || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="loading-container"><div className="spinner" /><p>Loading analytics...</p></div>;
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Analytics & Reports</h2>
        <p>Attendance trends, course statistics, and student performance</p>
      </div>

      {/* Overview Stats */}
      {overview && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon blue"><TrendingUp size={20} /></div>
            <div className="stat-label">Total Sessions</div>
            <div className="stat-value">{overview.totalSessions}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><Users size={20} /></div>
            <div className="stat-label">Unique Students</div>
            <div className="stat-value">{overview.uniqueStudents}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon yellow"><BookOpen size={20} /></div>
            <div className="stat-label">Avg per Session</div>
            <div className="stat-value">{overview.averageAttendancePerSession}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red"><AlertTriangle size={20} /></div>
            <div className="stat-label">Flagged</div>
            <div className="stat-value">{overview.flaggedCount}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Trends</button>
        <button className={`tab ${tab === 'courses' ? 'active' : ''}`} onClick={() => setTab('courses')}>Courses</button>
        <button className={`tab ${tab === 'students' ? 'active' : ''}`} onClick={() => setTab('students')}>Low Attendance</button>
      </div>

      {/* Trends Chart */}
      {tab === 'overview' && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 24 }}>Attendance Trend (Last 30 Days)</h3>
          {trends.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={trends.filter(t => t.total > 0 || t.sessions > 0)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="present" stroke="#059669" name="Present" strokeWidth={2} />
                <Line type="monotone" dataKey="flagged" stroke="#dc2626" name="Flagged" strokeWidth={2} />
                <Line type="monotone" dataKey="sessions" stroke="#1e40af" name="Sessions" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state">
              <TrendingUp size={48} />
              <h3>No data yet</h3>
              <p>Start generating QR codes and collecting attendance to see trends</p>
            </div>
          )}
        </div>
      )}

      {/* Courses */}
      {tab === 'courses' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 24 }}>Course Attendance</h3>
            {courses.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={courses}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="subjectName" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="averageAttendance" fill="#1e40af" name="Avg Attendance" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state"><h3>No course data</h3></div>
            )}
          </div>
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: 24 }}>Session Type Distribution</h3>
            {courses.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={courses}
                    dataKey="totalSessions"
                    nameKey="subjectName"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, value }) => `${name} (${value})`}
                  >
                    {courses.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state"><h3>No data</h3></div>
            )}
          </div>

          {/* Course Table */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <h3 className="card-title" style={{ marginBottom: 16 }}>Course Summary</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Type</th>
                    <th>Sessions</th>
                    <th>Total Attendees</th>
                    <th>Unique Students</th>
                    <th>Avg Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((c, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{c.subjectName}</td>
                      <td><span className="badge badge-info">{c.sessionType.toUpperCase()}</span></td>
                      <td>{c.totalSessions}</td>
                      <td>{c.totalAttendees}</td>
                      <td>{c.uniqueStudents}</td>
                      <td>{c.averageAttendance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Low Attendance Students */}
      {tab === 'students' && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>Students Below 70% Attendance</h3>
          {lowAttendance.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Email</th>
                    <th>Present</th>
                    <th>Flagged</th>
                    <th>Attendance Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {lowAttendance.map((s, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{s.studentName}</td>
                      <td>{s.email}</td>
                      <td>{s.present}</td>
                      <td>{s.flagged}</td>
                      <td>
                        <span className={`badge ${s.attendanceRate >= 50 ? 'badge-warning' : 'badge-danger'}`}>
                          {s.attendanceRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <Users size={48} />
              <h3>All students are above threshold</h3>
              <p>No students with attendance below 70%</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
