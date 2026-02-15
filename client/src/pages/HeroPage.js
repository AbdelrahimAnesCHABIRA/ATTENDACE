import React from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import AttendQRLogo from '../components/AttendQRLogo';
import {
  QrCode,
  Shield,
  Cloud,
  BarChart3,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Smartphone,
  Layout,
  ArrowRight,
} from 'lucide-react';
import './HeroPage.css';

export default function HeroPage() {
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    try {
      const res = await authAPI.getGoogleAuthUrl();
      if (res.data.authUrl) {
        window.location.href = res.data.authUrl;
      }
    } catch (err) {
      console.error('Google auth error:', err);
      navigate('/login');
    }
  };

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      {/* Navigation */}
      <nav className="hero-nav">
        <div className="hero-nav-inner">
          <div className="hero-nav-brand">
            <AttendQRLogo size={40} />
            <span>AttendQR</span>
            <span className="hero-badge">BETA</span>
          </div>

          <div className="hero-nav-links">
            <a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>Features</a>
            <a href="#how-it-works" onClick={(e) => { e.preventDefault(); scrollTo('how-it-works'); }}>How It Works</a>
            <a href="#security" onClick={(e) => { e.preventDefault(); scrollTo('security'); }}>Security</a>
          </div>

          <button className="hero-signin-btn" onClick={() => navigate('/login')}>
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-grid">
            {/* Left Column */}
            <div className="hero-text">
              <h1>
                University Attendance,{' '}
                <span className="accent">Simplified</span>
              </h1>
              <p>
                Teachers generate QR codes, students scan to attend, and anti-cheating protection
                is built right in. All attendance data syncs automatically to Google Sheets.
              </p>

              <div className="hero-ctas">
                <button className="hero-cta-google" onClick={handleGoogleLogin}>
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Get Started with Google
                </button>
                <button className="hero-cta-secondary" onClick={() => scrollTo('how-it-works')}>
                  See How It Works
                  <ArrowRight size={20} />
                </button>
              </div>
            </div>

            {/* Right Column — Mockup */}
            <div className="hero-mockup">
              <div className="hero-mockup-inner">
                {/* Phone */}
                <div className="hero-phone">
                  <div className="hero-phone-screen">
                    <div className="hero-phone-content">
                      <p className="course-name">CS 101 - Introduction to Programming</p>
                      <p className="scan-label">Scan to Mark Attendance</p>
                      <div className="hero-phone-qr">
                        <div className="hero-phone-qr-inner">
                          <QrCode size={120} color="#fff" />
                        </div>
                      </div>
                      <p className="hero-phone-valid">Valid for 10 minutes</p>
                      <div className="hero-phone-bar">
                        <div className="hero-phone-bar-fill" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dashboard */}
                <div className="hero-dashboard">
                  <div className="hero-dash-header">
                    <div className="hero-dash-header-top">
                      <Layout size={20} />
                      <span>Dashboard</span>
                    </div>
                    <h3>Today's Overview</h3>
                  </div>
                  <div className="hero-stats-grid">
                    <div className="hero-stat hero-stat-green">
                      <div className="value">94%</div>
                      <div className="label">Attendance Rate</div>
                    </div>
                    <div className="hero-stat hero-stat-indigo">
                      <div className="value">247</div>
                      <div className="label">Students Present</div>
                    </div>
                    <div className="hero-stat hero-stat-orange">
                      <div className="value">3</div>
                      <div className="label">Cheating Alerts</div>
                    </div>
                    <div className="hero-stat hero-stat-blue">
                      <div className="value">8</div>
                      <div className="label">Active Sessions</div>
                    </div>
                  </div>
                  <div className="hero-chart">
                    <div className="hero-chart-inner">
                      {[75, 85, 80, 100, 85, 75, 80].map((h, i) => (
                        <div
                          key={i}
                          className="hero-chart-bar"
                          style={{
                            height: `${h}%`,
                            background: `rgba(79,70,229,${0.3 + i * 0.1})`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Decorative blobs */}
              <div className="hero-blob hero-blob-1" />
              <div className="hero-blob hero-blob-2" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="hero-features">
        <div className="hero-section-inner">
          <div className="hero-section-header">
            <h2>Everything You Need to Manage Attendance</h2>
            <p>Powerful features designed specifically for university teachers to take attendance efficiently and securely.</p>
          </div>

          <div className="hero-features-grid">
            {[
              { icon: QrCode, color: 'indigo', title: 'Instant QR Codes', desc: 'Generate session QR codes in one click, valid for configurable durations. Start taking attendance in seconds.' },
              { icon: Shield, color: 'green', title: 'Anti-Cheating', desc: 'GPS geofencing flags students outside the classroom. Duplicate device detection prevents proxy attendance.' },
              { icon: Cloud, color: 'blue', title: 'Google Drive Sync', desc: 'Attendance auto-saved to Google Sheets with professional formatting. Access your data anywhere, anytime.' },
              { icon: BarChart3, color: 'purple', title: 'Real-Time Analytics', desc: 'Dashboard with attendance trends, per-course stats, and low-attendance alerts to identify struggling students.' },
              { icon: Calendar, color: 'indigo', title: 'Schedule Management', desc: 'Weekly recurring schedules with one-click QR generation from today\'s timetable. Never miss a session.' },
              { icon: AlertTriangle, color: 'orange', title: 'Cheating Logs', desc: 'Detailed violation reports and suspicious student tracking. Maintain academic integrity with confidence.' },
            ].map(({ icon: Icon, color, title, desc }) => (
              <div className="hero-feature-card" key={title}>
                <div className={`hero-feature-icon icon-${color}`}>
                  <Icon size={24} />
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="hero-how-it-works">
        <div className="hero-section-inner">
          <div className="hero-section-header">
            <h2>How It Works</h2>
            <p>Start taking attendance in three simple steps</p>
          </div>

          <div className="hero-steps-grid">
            <div className="hero-steps-line" />
            {[
              { num: 1, icon: QrCode, iconBg: '#e0e7ff', iconColor: '#4f46e5', title: 'Generate QR Code', desc: 'Teachers click one button to generate a unique QR code for their class session with customizable validity duration.' },
              { num: 2, icon: Smartphone, iconBg: '#dcfce7', iconColor: '#16a34a', title: 'Students Scan', desc: 'Students use their phones to scan the QR code. Location and device data is captured to prevent cheating.' },
              { num: 3, icon: Cloud, iconBg: '#dbeafe', iconColor: '#2563eb', title: 'Data Synced', desc: 'Attendance is automatically recorded and synced to Google Sheets. View analytics and reports in real-time.' },
            ].map(({ num, icon: Icon, iconBg, iconColor, title, desc }) => (
              <div className="hero-step-card" key={num}>
                <div className="hero-step-number">{num}</div>
                <div className="hero-step-icon" style={{ background: iconBg }}>
                  <Icon size={28} color={iconColor} />
                </div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>

          <div className="hero-how-cta">
            <button className="hero-cta-primary" onClick={handleGoogleLogin}>
              Get Started for Free
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="hero-security">
        <div className="hero-section-inner">
          <div className="hero-security-card">
            <Shield size={64} style={{ margin: '0 auto 1.5rem', opacity: 0.9, display: 'block' }} />
            <h2>Built with Security in Mind</h2>
            <p>
              GPS geofencing, duplicate device detection, and encrypted data sync ensure academic integrity.
              Your data is secure with Google's infrastructure.
            </p>
            <div className="hero-security-badges">
              <div className="hero-security-badge"><CheckCircle size={20} /><span>Encrypted Data</span></div>
              <div className="hero-security-badge"><CheckCircle size={20} /><span>GDPR Compliant</span></div>
              <div className="hero-security-badge"><CheckCircle size={20} /><span>Google OAuth</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="hero-footer">
        <div className="hero-footer-inner">
          <div className="hero-footer-grid">
            <div>
              <div className="hero-footer-brand">
                <AttendQRLogo size={40} />
                <span>AttendQR</span>
              </div>
              <p>Built for universities to simplify attendance management.</p>
            </div>
            <div>
              <h4>Product</h4>
              <ul>
                <li><a href="#features" onClick={(e) => { e.preventDefault(); scrollTo('features'); }}>Features</a></li>
                <li><a href="#security" onClick={(e) => { e.preventDefault(); scrollTo('security'); }}>Security</a></li>
              </ul>
            </div>
          </div>
          <div className="hero-footer-bottom">
            <p>&copy; {new Date().getFullYear()} AttendQR. Built for universities. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
