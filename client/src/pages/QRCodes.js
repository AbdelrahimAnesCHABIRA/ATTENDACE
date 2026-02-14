import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { sessionAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  QrCode,
  Clock,
  Users,
  StopCircle,
  Timer,
  Copy,
  ExternalLink,
  X,
  Maximize2,
  Minimize2,
} from 'lucide-react';

const SESSION_TYPES = ['lecture', 'td', 'lab'];

export default function QRCodes() {
  const location = useLocation();
  const prefill = location.state?.schedule;

  const [activeSessions, setActiveSessions] = useState([]);
  const [sessionHistory, setSessionHistory] = useState([]);
  const [showGenerate, setShowGenerate] = useState(!!prefill);
  const [generatedQR, setGeneratedQR] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [tab, setTab] = useState('active');
  const [selectedSession, setSelectedSession] = useState(null);
  const [loadingQR, setLoadingQR] = useState(null);
  const [fullscreenQR, setFullscreenQR] = useState(null); // { qrCodeDataUrl, subjectName, sessionType, year, sectionOrGroup, expiresAt, attendeeCount, sessionId, attendanceUrl }

  const [form, setForm] = useState({
    sessionType: prefill?.sessionType || 'lecture',
    subjectName: prefill?.subjectName || '',
    year: prefill?.year || 1,
    sectionOrGroup: prefill?.sectionOrGroup || '',
    classroomLocation: prefill?.classroomLocation || null,
    geofenceRadius: prefill?.geofenceRadius || 100,
  });

  const fetchSessions = useCallback(async () => {
    try {
      const [activeRes, historyRes] = await Promise.all([
        sessionAPI.getActive(),
        sessionAPI.getHistory(),
      ]);
      setActiveSessions(activeRes.data.sessions || []);
      setSessionHistory(historyRes.data.sessions || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  // Poll active sessions every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      sessionAPI.getActive().then(res => {
        setActiveSessions(res.data.sessions || []);
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Esc key to close fullscreen
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && fullscreenQR) closeFullscreen();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [fullscreenQR]);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await sessionAPI.generate({
        ...form,
        year: parseInt(form.year),
        geofenceRadius: parseInt(form.geofenceRadius),
      });
      setGeneratedQR(res.data);
      setShowGenerate(false);
      toast.success('QR code generated!');
      fetchSessions();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to generate QR code');
    } finally {
      setGenerating(false);
    }
  };

  const handleDeactivate = async (id) => {
    try {
      await sessionAPI.deactivate(id);
      toast.success('Session deactivated');
      fetchSessions();
      if (generatedQR?.sessionId === id) setGeneratedQR(null);
    } catch (err) {
      toast.error('Failed to deactivate');
    }
  };

  const handleExtend = async (id) => {
    try {
      await sessionAPI.extend(id, 15);
      toast.success('Session extended by 15 minutes');
      fetchSessions();
    } catch (err) {
      toast.error('Failed to extend');
    }
  };

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url);
    toast.success('URL copied!');
  };

  const handleShowQR = async (session) => {
    // If QR data is already in the session, show it directly
    if (session.qrCodeDataUrl) {
      setSelectedSession(session);
      return;
    }
    // Otherwise fetch full session details (which regenerates QR if needed)
    setLoadingQR(session.id);
    try {
      const res = await sessionAPI.getById(session.id);
      setSelectedSession(res.data.session);
    } catch (err) {
      toast.error('Failed to load QR code');
    } finally {
      setLoadingQR(null);
    }
  };

  const openFullscreen = (data) => {
    setFullscreenQR(data);
    // Hide scrollbar
    document.body.style.overflow = 'hidden';
  };

  const closeFullscreen = () => {
    setFullscreenQR(null);
    document.body.style.overflow = '';
  };

  if (loading) {
    return <div className="loading-container"><div className="spinner" /><p>Loading...</p></div>;
  }

  return (
    <div className="fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>QR Code Generator</h2>
          <p>Generate and manage attendance QR codes</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowGenerate(true); setGeneratedQR(null); }}>
          <QrCode size={18} /> Generate New QR
        </button>
      </div>

      {/* Fullscreen QR Overlay */}
      {fullscreenQR && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: '#fff',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
          onClick={closeFullscreen}
        >
          <button
            onClick={closeFullscreen}
            style={{
              position: 'absolute', top: 20, right: 20,
              background: '#f1f5f9', border: 'none', borderRadius: 8,
              padding: '10px 16px', cursor: 'pointer', fontSize: 14,
              display: 'flex', alignItems: 'center', gap: 6,
              color: 'var(--text-secondary)',
            }}
          >
            <Minimize2 size={18} /> Exit Fullscreen
          </button>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>
            {fullscreenQR.subjectName}
          </div>
          <div style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 20 }}>
            {fullscreenQR.sessionType?.toUpperCase()} &bull; Year {fullscreenQR.year} &bull; {fullscreenQR.sectionOrGroup}
          </div>
          <img
            src={fullscreenQR.qrCodeDataUrl}
            alt="QR Code"
            style={{ width: 'min(80vw, 80vh)', height: 'min(80vw, 80vh)', maxWidth: 520, maxHeight: 520, imageRendering: 'pixelated' }}
          />
          <div style={{ marginTop: 16, fontSize: 14, color: 'var(--text-secondary)' }}>
            <Clock size={14} style={{ verticalAlign: 'middle' }} /> Expires: {new Date(fullscreenQR.expiresAt).toLocaleTimeString()}
            {fullscreenQR.attendeeCount != null && (
              <span style={{ marginLeft: 20 }}><Users size={14} style={{ verticalAlign: 'middle' }} /> {fullscreenQR.attendeeCount} attendees</span>
            )}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>Click anywhere or press Esc to exit</div>
        </div>
      )}

      {/* Generated QR Display */}
      {generatedQR && (
        <div className="card" style={{ marginBottom: 24, textAlign: 'center' }}>
          <div className="qr-display">
            <img src={generatedQR.qrCodeDataUrl} alt="QR Code" style={{ width: 300, height: 300, cursor: 'pointer' }} onClick={() => openFullscreen({ qrCodeDataUrl: generatedQR.qrCodeDataUrl, subjectName: form.subjectName, sessionType: form.sessionType, year: form.year, sectionOrGroup: form.sectionOrGroup, expiresAt: generatedQR.expiresAt, sessionId: generatedQR.sessionId, attendanceUrl: generatedQR.attendanceUrl })} />
            <div className="qr-info">
              <div className="session-name">{form.subjectName}</div>
              <div className="session-detail">
                {form.sessionType.toUpperCase()} &bull; Year {form.year} &bull; {form.sectionOrGroup}
              </div>
              <div className="session-detail" style={{ marginTop: 8 }}>
                <Clock size={14} /> Expires: {new Date(generatedQR.expiresAt).toLocaleTimeString()}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => openFullscreen({ qrCodeDataUrl: generatedQR.qrCodeDataUrl, subjectName: form.subjectName, sessionType: form.sessionType, year: form.year, sectionOrGroup: form.sectionOrGroup, expiresAt: generatedQR.expiresAt, sessionId: generatedQR.sessionId, attendanceUrl: generatedQR.attendanceUrl })}>
                <Maximize2 size={14} /> Fullscreen
              </button>
              <button className="btn btn-secondary" onClick={() => copyUrl(generatedQR.attendanceUrl)}>
                <Copy size={14} /> Copy Link
              </button>
              {generatedQR.spreadsheetUrl && (
                <a className="btn btn-secondary" href={generatedQR.spreadsheetUrl} target="_blank" rel="noreferrer">
                  <ExternalLink size={14} /> Open Sheet
                </a>
              )}
              <button className="btn btn-danger" onClick={() => handleDeactivate(generatedQR.sessionId)}>
                <StopCircle size={14} /> Stop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Viewer Modal */}
      {selectedSession && (
        <div className="modal-overlay" onClick={() => setSelectedSession(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ textAlign: 'center', maxWidth: 440 }}>
            <div className="modal-header">
              <h3 className="modal-title">{selectedSession.subjectName}</h3>
              <button className="btn-icon" onClick={() => setSelectedSession(null)}><X size={20} /></button>
            </div>
            <div style={{ padding: '16px 0' }}>
              {selectedSession.qrCodeDataUrl ? (
                <img
                  src={selectedSession.qrCodeDataUrl}
                  alt="QR Code"
                  style={{ width: 280, height: 280, cursor: 'pointer' }}
                  onClick={() => { setSelectedSession(null); openFullscreen(selectedSession); }}
                  title="Click for fullscreen"
                />
              ) : (
                <div style={{ padding: 40, color: 'var(--text-muted)' }}>QR code unavailable</div>
              )}
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12 }}>
                {selectedSession.sessionType.toUpperCase()} &bull; Year {selectedSession.year} &bull; {selectedSession.sectionOrGroup}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                <Clock size={14} style={{ verticalAlign: 'middle' }} /> Expires: {new Date(selectedSession.expiresAt).toLocaleTimeString()}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                <Users size={14} style={{ verticalAlign: 'middle' }} /> {selectedSession.attendeeCount} attendees
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', padding: '0 0 8px', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => { setSelectedSession(null); openFullscreen(selectedSession); }}>
                <Maximize2 size={14} /> Fullscreen
              </button>
              <button className="btn btn-secondary" onClick={() => copyUrl(selectedSession.attendanceUrl || `${window.location.origin}/attend/${selectedSession.id}`)}>
                <Copy size={14} /> Copy Link
              </button>
              <button className="btn btn-secondary" onClick={() => { handleExtend(selectedSession.id); setSelectedSession(null); }}>
                <Timer size={14} /> +15min
              </button>
              <button className="btn btn-danger" onClick={() => { handleDeactivate(selectedSession.id); setSelectedSession(null); }}>
                <StopCircle size={14} /> Stop
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Generate Form Modal */}
      {showGenerate && (
        <div className="modal-overlay" onClick={() => setShowGenerate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Generate QR Code</h3>
              <button className="btn-icon" onClick={() => setShowGenerate(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleGenerate}>
              <div className="form-group">
                <label className="form-label">Session Type</label>
                <select className="form-select" value={form.sessionType} onChange={e => setForm({ ...form, sessionType: e.target.value })}>
                  {SESSION_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Subject Name</label>
                <input className="form-input" value={form.subjectName} onChange={e => setForm({ ...form, subjectName: e.target.value })} placeholder="e.g. Mathematics" required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Year</label>
                  <select className="form-select" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}>
                    {[1,2,3,4,5].map(y => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{form.sessionType === 'lecture' ? 'Section' : 'Group'}</label>
                  <input className="form-input" value={form.sectionOrGroup} onChange={e => setForm({ ...form, sectionOrGroup: e.target.value })} placeholder={form.sessionType === 'lecture' ? '1' : 'A'} required />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowGenerate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={generating}>
                  {generating ? 'Generating...' : 'Generate QR Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab ${tab === 'active' ? 'active' : ''}`} onClick={() => setTab('active')}>Active ({activeSessions.length})</button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
      </div>

      {/* Active Sessions */}
      {tab === 'active' && (
        <div>
          {activeSessions.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <QrCode size={48} />
                <h3>No active sessions</h3>
                <p>Generate a QR code to start tracking attendance</p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {activeSessions.map(session => (
                <div key={session.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{session.subjectName}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {session.sessionType.toUpperCase()} &bull; Year {session.year} &bull; {session.sectionOrGroup}
                    </div>
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 13 }}>
                      <span><Users size={14} /> {session.attendeeCount} attendees</span>
                      <span><Clock size={14} /> Expires {new Date(session.expiresAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-sm btn-primary" onClick={() => handleShowQR(session)} disabled={loadingQR === session.id}>
                      <QrCode size={14} /> {loadingQR === session.id ? 'Loading...' : 'Show QR'}
                    </button>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleExtend(session.id)}>
                      <Timer size={14} /> +15min
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeactivate(session.id)}>
                      <StopCircle size={14} /> Stop
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History */}
      {tab === 'history' && (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Type</th>
                  <th>Year/Group</th>
                  <th>Date</th>
                  <th>Attendees</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sessionHistory.slice(0, 50).map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.subjectName}</td>
                    <td><span className="badge badge-info">{s.sessionType.toUpperCase()}</span></td>
                    <td>Year {s.year} &bull; {s.sectionOrGroup}</td>
                    <td>{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td>{s.attendeeCount}</td>
                    <td>
                      <span className={`badge ${s.isActive ? 'badge-success' : 'badge-warning'}`}>
                        {s.isActive ? 'Active' : 'Ended'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
