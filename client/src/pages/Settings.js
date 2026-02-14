import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Save, MapPin, Clock, Shield } from 'lucide-react';

export default function Settings() {
  const { user, setUser } = useAuth();
  const [settings, setSettings] = useState(
    user?.settings || {
      defaultGeofenceRadius: 100,
      qrCodeValidityMinutes: 15,
    }
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await authAPI.updateSettings(settings);
      setUser(res.data.user);
      toast.success('Settings saved');
    } catch (err) {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Settings</h2>
        <p>Manage your preferences and default configurations</p>
      </div>

      {/* Profile */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="card-title" style={{ marginBottom: 16 }}>Profile</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {user?.picture && (
            <img
              src={user.picture}
              alt={user.name}
              style={{ width: 64, height: 64, borderRadius: '50%', border: '2px solid var(--border)' }}
            />
          )}
          <div>
            <div style={{ fontWeight: 600, fontSize: 18 }}>{user?.name}</div>
            <div style={{ color: 'var(--text-secondary)' }}>{user?.email}</div>
            <span className="badge badge-info" style={{ marginTop: 4 }}>{user?.role?.toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* Default Session Settings */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="card-title" style={{ marginBottom: 20 }}>
          <Shield size={18} style={{ marginRight: 8 }} />
          Default Session Settings
        </h3>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              <MapPin size={14} style={{ marginRight: 4 }} />
              Default Geofence Radius (meters)
            </label>
            <input
              type="number"
              className="form-input"
              value={settings.defaultGeofenceRadius}
              onChange={e => setSettings({ ...settings, defaultGeofenceRadius: parseInt(e.target.value) })}
              min="10"
              max="1000"
            />
            <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              Students outside this radius will be flagged
            </small>
          </div>

          <div className="form-group">
            <label className="form-label">
              <Clock size={14} style={{ marginRight: 4 }} />
              QR Code Validity (minutes)
            </label>
            <input
              type="number"
              className="form-input"
              value={settings.qrCodeValidityMinutes}
              onChange={e => setSettings({ ...settings, qrCodeValidityMinutes: parseInt(e.target.value) })}
              min="5"
              max="120"
            />
            <small style={{ color: 'var(--text-muted)', fontSize: 12 }}>
              QR codes expire after this duration
            </small>
          </div>
        </div>
      </div>

      {/* Google Drive Integration */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="card-title" style={{ marginBottom: 16 }}>Google Drive Integration</h3>
        <div className="alert alert-success">
          Google Drive is connected. Attendance sheets will be automatically created in your Drive.
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8 }}>
          Folder structure: <code>Attendance-2025-2026/Year-X/Section-X/...</code>
        </p>
      </div>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
          <Save size={18} />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
