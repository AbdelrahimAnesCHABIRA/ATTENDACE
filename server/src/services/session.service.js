const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const {
  addSession,
  getSession,
  updateSessionFields,
  deactivateSession: dbDeactivateSession,
  getActiveSessionsByTeacher,
  getAllSessionsByTeacher,
  addSessionAttendee,
  hasSessionAttendee,
} = require('./store.service');

/**
 * QR Code & Session Service
 * Manages QR code generation and active attendance sessions.
 * Now uses SQLite via store.service — no array manipulation.
 */
class SessionService {
  /**
   * Generate a unique QR code for a session
   */
  static async generateQRCode(sessionData) {
    const sessionId = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.qrCodeValidityMinutes * 60 * 1000);

    // Generate QR code data URL
    const attendanceUrl = `${config.clientUrl}/attend/${sessionId}`;
    const qrPayload = JSON.stringify({
      sessionId,
      url: attendanceUrl,
    });

    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    const session = {
      id: sessionId,
      teacherId: sessionData.teacherId,
      sessionType: sessionData.sessionType,
      subjectName: sessionData.subjectName,
      year: sessionData.year,
      sectionOrGroup: sessionData.sectionOrGroup,
      classroomLocation: sessionData.classroomLocation,
      geofenceRadius: sessionData.geofenceRadius || config.defaultGeofenceRadius,
      spreadsheetId: sessionData.spreadsheetId,
      spreadsheetUrl: null,
      driveFolder: sessionData.driveFolder,
      qrCodeDataUrl,
      attendanceUrl,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isActive: true,
      attendeeCount: 0,
    };

    // Store session in SQLite
    addSession(session);

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
   * Get session by ID
   */
  static getSession(sessionId) {
    return getSession(sessionId);
  }

  /**
   * Check if a session is still active and valid
   */
  static isSessionValid(sessionId) {
    const session = getSession(sessionId);
    if (!session) return { valid: false, reason: 'Session not found' };
    if (!session.isActive) return { valid: false, reason: 'Session is no longer active' };
    if (new Date() > new Date(session.expiresAt)) {
      dbDeactivateSession(sessionId);
      return { valid: false, reason: 'Session has expired' };
    }
    return { valid: true, session };
  }

  /**
   * Update session properties (e.g., link Drive spreadsheet)
   */
  static updateSession(sessionId, updates) {
    return updateSessionFields(sessionId, updates);
  }

  /**
   * Deactivate a session
   */
  static deactivateSession(sessionId) {
    dbDeactivateSession(sessionId);
  }

  /**
   * Add attendee to session tracking
   */
  static addAttendee(sessionId, studentEmail) {
    addSessionAttendee(sessionId, studentEmail);
  }

  /**
   * Check if student already submitted for this session
   */
  static hasStudentSubmitted(sessionId, email) {
    return hasSessionAttendee(sessionId, email);
  }

  /**
   * Get all active sessions for a teacher (auto-expires stale ones)
   */
  static getActiveSessionsForTeacher(teacherId) {
    return getActiveSessionsByTeacher(teacherId);
  }

  /**
   * Get all sessions for a teacher (including inactive)
   */
  static getAllSessionsForTeacher(teacherId) {
    return getAllSessionsByTeacher(teacherId);
  }

  /**
   * Regenerate QR code for an existing session
   */
  static async regenerateQRCode(sessionId) {
    const session = getSession(sessionId);
    if (!session) return null;

    const attendanceUrl = `${config.clientUrl}/attend/${sessionId}`;
    const qrPayload = JSON.stringify({ sessionId, url: attendanceUrl });

    const qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });

    updateSessionFields(sessionId, { qrCodeDataUrl, attendanceUrl });

    return { qrCodeDataUrl, attendanceUrl, session };
  }

  /**
   * Extend session expiry time
   */
  static extendSession(sessionId, additionalMinutes) {
    const session = getSession(sessionId);
    if (!session) return null;
    const currentExpiry = new Date(session.expiresAt);
    const newExpiry = new Date(currentExpiry.getTime() + additionalMinutes * 60 * 1000);
    return updateSessionFields(sessionId, {
      expiresAt: newExpiry.toISOString(),
      isActive: true,
    });
  }
}

module.exports = SessionService;
