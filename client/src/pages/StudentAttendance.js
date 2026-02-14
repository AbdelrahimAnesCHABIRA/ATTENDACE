import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { attendanceAPI, sessionAPI } from '../services/api';
import toast from 'react-hot-toast';
import { GraduationCap, CheckCircle, Loader, MapPin } from 'lucide-react';

export default function StudentAttendance() {
  const { sessionId } = useParams();
  const [sessionValid, setSessionValid] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ studentName: '', email: '' });
  const [locationStatus, setLocationStatus] = useState('pending'); // pending, granted, denied

  // Validate session on load
  useEffect(() => {
    sessionAPI.validate(sessionId)
      .then(res => {
        setSessionValid(res.data.valid);
      })
      .catch(() => {
        setSessionValid(false);
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  // Request location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => setLocationStatus('granted'),
        () => setLocationStatus('denied'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationStatus('denied');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Get location
      let latitude = null;
      let longitude = null;

      if (navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
            });
          });
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } catch {
          // Location denied - still submit
        }
      }

      // Get network info (MAC address not available in browser for security)
      const macAddress = 'N/A'; // Not accessible from browser

      await attendanceAPI.submit({
        sessionId,
        studentName: form.studentName,
        email: form.email,
        macAddress,
        latitude,
        longitude,
      });

      setSubmitted(true);
      toast.success('Attendance submitted!');
    } catch (err) {
      toast.error('Failed to submit attendance. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="student-page">
        <div className="student-card" style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '24px auto' }} />
          <p>Validating session...</p>
        </div>
      </div>
    );
  }

  if (!sessionValid) {
    return (
      <div className="student-page">
        <div className="student-card" style={{ textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: '#fee2e2', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <GraduationCap size={32} color="#dc2626" />
          </div>
          <h2 style={{ color: '#dc2626' }}>Session Unavailable</h2>
          <p>This attendance session has expired or is no longer active.</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
            Please ask your teacher to generate a new QR code.
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="student-page">
        <div className="student-card" style={{ textAlign: 'center' }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: '#d1fae5', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <CheckCircle size={40} color="#059669" />
          </div>
          <h2 style={{ color: '#059669' }}>Attendance Submitted!</h2>
          <p>Your attendance has been recorded successfully.</p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 16 }}>
            You can close this page now.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="student-page">
      <div className="student-card fade-in">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#eff6ff', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <GraduationCap size={28} color="var(--primary)" />
          </div>
        </div>
        <h2>Mark Attendance</h2>
        <p>Please enter your details to record your attendance.</p>

        {/* Location status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 'var(--radius)',
          background: locationStatus === 'granted' ? '#d1fae5' : '#fef3c7',
          fontSize: 12, marginBottom: 24,
          color: locationStatus === 'granted' ? '#065f46' : '#92400e',
        }}>
          <MapPin size={14} />
          {locationStatus === 'granted'
            ? 'Location access granted'
            : locationStatus === 'denied'
            ? 'Location denied — attendance may be flagged'
            : 'Requesting location access...'
          }
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              className="form-input"
              placeholder="Enter your full name"
              value={form.studentName}
              onChange={e => setForm({ ...form, studentName: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">University Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="your.name@university.edu"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 16, marginTop: 8 }}
          >
            {submitting ? (
              <><Loader size={18} className="pulse" /> Submitting...</>
            ) : (
              'Submit Attendance'
            )}
          </button>
        </form>

        <div style={{ marginTop: 20, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
          By submitting, you consent to sharing your location data for attendance verification.
        </div>
      </div>
    </div>
  );
}
