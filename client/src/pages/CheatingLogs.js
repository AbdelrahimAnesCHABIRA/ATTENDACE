import React, { useState, useEffect } from 'react';
import { cheatingAPI } from '../services/api';
import { ShieldAlert, AlertTriangle, Users, Filter } from 'lucide-react';

export default function CheatingLogs() {
  const [violations, setViolations] = useState([]);
  const [suspicious, setSuspicious] = useState([]);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('violations');
  const [filters, setFilters] = useState({ violationType: '', email: '' });
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [violRes, suspRes, statsRes] = await Promise.all([
        cheatingAPI.getViolations(filters),
        cheatingAPI.getSuspicious(),
        cheatingAPI.getStats(),
      ]);
      setViolations(violRes.data.violations || []);
      setSuspicious(suspRes.data.students || []);
      setStats(statsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleFilter = () => {
    setLoading(true);
    fetchData();
  };

  if (loading) {
    return <div className="loading-container"><div className="spinner" /><p>Loading...</p></div>;
  }

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Cheating Logs</h2>
        <p>Review flagged students and violation records</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon red"><ShieldAlert size={20} /></div>
            <div className="stat-label">Total Violations</div>
            <div className="stat-value">{stats.totalViolations}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon yellow"><Users size={20} /></div>
            <div className="stat-label">Students Flagged</div>
            <div className="stat-value">{stats.uniqueStudentsFlagged}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue"><AlertTriangle size={20} /></div>
            <div className="stat-label">Location Violations</div>
            <div className="stat-value">{stats.byType?.['Location Violation'] || 0}</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon green"><AlertTriangle size={20} /></div>
            <div className="stat-label">Duplicate Device</div>
            <div className="stat-value">{stats.byType?.['Duplicate Device'] || 0}</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'violations' ? 'active' : ''}`} onClick={() => setTab('violations')}>All Violations</button>
        <button className={`tab ${tab === 'suspicious' ? 'active' : ''}`} onClick={() => setTab('suspicious')}>Suspicious Students</button>
      </div>

      {tab === 'violations' && (
        <div className="card">
          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <select
              className="form-select"
              style={{ maxWidth: 200 }}
              value={filters.violationType}
              onChange={e => setFilters({ ...filters, violationType: e.target.value })}
            >
              <option value="">All Types</option>
              <option value="Location Violation">Location Violation</option>
              <option value="Duplicate Device">Duplicate Device</option>
              <option value="Time Violation">Time Violation</option>
            </select>
            <input
              className="form-input"
              placeholder="Filter by email..."
              style={{ maxWidth: 250 }}
              value={filters.email}
              onChange={e => setFilters({ ...filters, email: e.target.value })}
            />
            <button className="btn btn-secondary" onClick={handleFilter}>
              <Filter size={14} /> Apply
            </button>
          </div>

          {violations.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Student</th>
                    <th>Email</th>
                    <th>Violation</th>
                    <th>Details</th>
                    <th>Distance</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {violations.map((v, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12 }}>{new Date(v.timestamp).toLocaleString()}</td>
                      <td style={{ fontWeight: 500 }}>{v.studentName}</td>
                      <td>{v.email}</td>
                      <td>
                        <span className={`badge ${v.violationType === 'Location Violation' ? 'badge-danger' : 'badge-warning'}`}>
                          {v.violationType}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.details}</td>
                      <td>{v.distance}m</td>
                      <td style={{ fontSize: 12 }}>{v.ipAddress}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <ShieldAlert size={48} />
              <h3>No violations recorded</h3>
              <p>Great! No cheating attempts have been detected.</p>
            </div>
          )}
        </div>
      )}

      {tab === 'suspicious' && (
        <div className="card">
          {suspicious.length > 0 ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Email</th>
                    <th>Total Violations</th>
                    <th>Violation Types</th>
                  </tr>
                </thead>
                <tbody>
                  {suspicious.map((s, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{s.studentName}</td>
                      <td>{s.email}</td>
                      <td>
                        <span className="badge badge-danger">{s.count}</span>
                      </td>
                      <td>
                        {[...new Set(s.violations.map(v => v.violationType))].map(type => (
                          <span key={type} className="badge badge-warning" style={{ marginRight: 4 }}>
                            {type}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <Users size={48} />
              <h3>No suspicious patterns</h3>
              <p>No students have 3 or more violations</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
