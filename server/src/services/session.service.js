const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { getSessionStore, saveSessionStore } = require('./store.service');

/**
 * QR Code & Session Service
 * Manages QR code generation and active attendance sessions
 */
class SessionService {
  /**
   * Generate a unique QR code for a session
   */
  static async generateQRCode(sessionData) {
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.qrCodeValidityMinutes * 60 * 1000);

    const session = {
      id: sessionId,
      teacherId: sessionData.teacherId,
      sessionType: sessionData.sessionType,     // lecture, td, lab
      subjectName: sessionData.subjectName,
      year: sessionData.year,
      sectionOrGroup: sessionData.sectionOrGroup,
      classroomLocation: sessionData.classroomLocation, // { lat, lng }
      geofenceRadius: sessionData.geofenceRadius || config.defaultGeofenceRadius,
      spreadsheetId: sessionData.spreadsheetId,
      driveFolder: sessionData.driveFolder,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isActive: true,
      attendeeCount: 0,
      attendees: [],
    };

    // Generate QR code data URL
    const attendanceUrl = `${config.clientUrl}/attend/${sessionId}`;
    const qrPayload = JSON.stringify({
      sessionId,
      url: attendanceUrl,
    });

    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 400,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    // Save QR data URL and attendance URL in the session
    session.qrCodeDataUrl = qrCodeDataUrl;
    session.attendanceUrl = attendanceUrl;

    // Store session
    const sessions = getSessionStore();
    sessions.push(session);
    saveSessionStore(sessions);

    return {
      sessionId,
      qrCodeDataUrl,
      qrPayload,
      attendanceUrl,
      expiresAt: expiresAt.toISOString(),
      session,
    };
  }

  /**
   * Get active session by ID
   */
  static getSession(sessionId) {
    const sessions = getSessionStore();
    return sessions.find(s => s.id === sessionId);
  }

  /**
   * Check if a session is still active and valid
   */
  static isSessionValid(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return { valid: false, reason: 'Session not found' };
    if (!session.isActive) return { valid: false, reason: 'Session is no longer active' };
    if (new Date() > new Date(session.expiresAt)) {
      // Auto-deactivate expired sessions
      this.deactivateSession(sessionId);
      return { valid: false, reason: 'Session has expired' };
    }
    return { valid: true, session };
  }

  /**
   * Update session properties (e.g., link Drive spreadsheet after async creation)
   */
  static updateSession(sessionId, updates) {
    const sessions = getSessionStore();
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index !== -1) {
      sessions[index] = { ...sessions[index], ...updates };
      saveSessionStore(sessions);
      return sessions[index];
    }
    return null;
  }

  /**
   * Deactivate a session
   */
  static deactivateSession(sessionId) {
    const sessions = getSessionStore();
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index !== -1) {
      sessions[index].isActive = false;
      sessions[index].deactivatedAt = new Date().toISOString();
      saveSessionStore(sessions);
    }
  }

  /**
   * Add attendee to session tracking
   */
  static addAttendee(sessionId, studentEmail) {
    const sessions = getSessionStore();
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index !== -1) {
      sessions[index].attendees.push(studentEmail);
      sessions[index].attendeeCount = sessions[index].attendees.length;
      saveSessionStore(sessions);
    }
  }

  /**
   * Check if student already submitted for this session
   */
  static hasStudentSubmitted(sessionId, email) {
    const session = this.getSession(sessionId);
    if (!session) return false;
    return session.attendees.includes(email);
  }

  /**
   * Get all active sessions for a teacher (auto-expires stale ones)
   */
  static getActiveSessionsForTeacher(teacherId) {
    const sessions = getSessionStore();
    const now = new Date();
    let changed = false;

    // Auto-deactivate any expired sessions
    sessions.forEach(s => {
      if (s.isActive && new Date(s.expiresAt) < now) {
        s.isActive = false;
        s.deactivatedAt = now.toISOString();
        changed = true;
      }
    });

    if (changed) saveSessionStore(sessions);

    return sessions.filter(s => s.teacherId === teacherId && s.isActive);
  }

  /**
   * Get all sessions for a teacher (including inactive)
   */
  static getAllSessionsForTeacher(teacherId) {
    const sessions = getSessionStore();
    const now = new Date();
    let changed = false;

    sessions.forEach(s => {
      if (s.isActive && new Date(s.expiresAt) < now) {
        s.isActive = false;
        s.deactivatedAt = now.toISOString();
        changed = true;
      }
    });

    if (changed) saveSessionStore(sessions);

    return sessions.filter(s => s.teacherId === teacherId);
  }

  /**
   * Regenerate QR code for an existing session
   */
  static async regenerateQRCode(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return null;

    const attendanceUrl = `${config.clientUrl}/attend/${sessionId}`;
    const qrPayload = JSON.stringify({ sessionId, url: attendanceUrl });

    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    // Update stored QR data
    const sessions = getSessionStore();
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index !== -1) {
      sessions[index].qrCodeDataUrl = qrCodeDataUrl;
      sessions[index].attendanceUrl = attendanceUrl;
      saveSessionStore(sessions);
    }

    return { qrCodeDataUrl, attendanceUrl, session };
  }

  /**
   * Extend session expiry time
   */
  static extendSession(sessionId, additionalMinutes) {
    const sessions = getSessionStore();
    const index = sessions.findIndex(s => s.id === sessionId);
    if (index !== -1) {
      const currentExpiry = new Date(sessions[index].expiresAt);
      const newExpiry = new Date(currentExpiry.getTime() + additionalMinutes * 60 * 1000);
      sessions[index].expiresAt = newExpiry.toISOString();
      sessions[index].isActive = true;
      saveSessionStore(sessions);
      return sessions[index];
    }
    return null;
  }
}

module.exports = SessionService;
