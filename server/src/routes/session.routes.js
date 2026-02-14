const express = require('express');
const { body } = require('express-validator');
const config = require('../config');
const { authenticate, requireTeacher } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const SessionService = require('../services/session.service');
const DriveService = require('../services/drive.service');
const { findTeacherById } = require('../services/store.service');
const { driveQueue } = require('../services/queue.service');

const router = express.Router();

/**
 * POST /api/sessions/generate
 * Generate a QR code FIRST (instant), then create Drive resources in background
 */
router.post(
  '/generate',
  authenticate,
  requireTeacher,
  [
    body('sessionType').isIn(['lecture', 'td', 'lab']).withMessage('Invalid session type'),
    body('subjectName').notEmpty().withMessage('Subject name required'),
    body('year').isInt({ min: 1, max: 5 }).withMessage('Valid year required'),
    body('sectionOrGroup').notEmpty().withMessage('Section or group required'),
  ],
  validate,
  async (req, res) => {
    try {
      const teacher = findTeacherById(req.user.id);
      if (!teacher || !teacher.googleTokens) {
        return res.status(401).json({ error: 'Google Drive not connected' });
      }

      const {
        sessionType,
        subjectName,
        year,
        sectionOrGroup,
        classroomLocation,
        geofenceRadius,
      } = req.body;

      // ── FAST PATH: Generate QR immediately (no Drive wait) ──
      const result = await SessionService.generateQRCode({
        teacherId: req.user.id,
        sessionType,
        subjectName,
        year,
        sectionOrGroup,
        classroomLocation: classroomLocation || null,
        geofenceRadius: geofenceRadius || teacher.settings?.defaultGeofenceRadius,
        spreadsheetId: null,   // updated async
        driveFolder: null,     // updated async
      });

      // Respond instantly with QR code
      res.json({
        success: true,
        sessionId: result.sessionId,
        qrCodeDataUrl: result.qrCodeDataUrl,
        attendanceUrl: result.attendanceUrl,
        expiresAt: result.expiresAt,
        spreadsheetUrl: null,
        driveStatus: 'creating',
      });

      // ── BACKGROUND: Create Drive resources and link to session ──
      // Keyed by sessionId — each session setup runs independently in parallel
      driveQueue.enqueue(
        async () => {
          const driveService = new DriveService(teacher.googleTokens.access_token);

          const folder = await driveService.createFolderStructure(
            sessionType,
            year,
            sectionOrGroup,
            config.academicYear
          );

          const today = new Date().toISOString().split('T')[0];
          const sheetTitle = `${subjectName}_${sessionType.toUpperCase()}_${today}`;
          const sheet = await driveService.createAttendanceSheet(sheetTitle, folder.id);

          // Update session with Drive info
          SessionService.updateSession(result.sessionId, {
            spreadsheetId: sheet.spreadsheetId,
            spreadsheetUrl: sheet.spreadsheetUrl,
            driveFolder: folder,
          });
        },
        `drive-setup-${result.sessionId}`,
        result.sessionId
      );
    } catch (error) {
      console.error('QR generation error:', error);
      res.status(500).json({ error: 'Failed to generate QR code' });
    }
  }
);

/**
 * GET /api/sessions/active
 * Get all active sessions for current teacher
 */
router.get('/active', authenticate, requireTeacher, (req, res) => {
  const sessions = SessionService.getActiveSessionsForTeacher(req.user.id);
  res.json({ sessions });
});

/**
 * GET /api/sessions/history
 * Get session history for current teacher
 */
router.get('/history', authenticate, requireTeacher, (req, res) => {
  const sessions = SessionService.getAllSessionsForTeacher(req.user.id);
  res.json({ sessions: sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

/**
 * GET /api/sessions/:id
 * Get session details (includes QR code data)
 */
router.get('/:id', authenticate, async (req, res) => {
  const session = SessionService.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // If qrCodeDataUrl is missing (older sessions), regenerate it
  if (!session.qrCodeDataUrl && session.isActive) {
    const regen = await SessionService.regenerateQRCode(req.params.id);
    if (regen) {
      return res.json({
        session: { ...session, qrCodeDataUrl: regen.qrCodeDataUrl, attendanceUrl: regen.attendanceUrl },
      });
    }
  }

  res.json({ session });
});

/**
 * POST /api/sessions/:id/deactivate
 * Deactivate a session
 */
router.post('/:id/deactivate', authenticate, requireTeacher, (req, res) => {
  const session = SessionService.getSession(req.params.id);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  if (session.teacherId !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  SessionService.deactivateSession(req.params.id);
  res.json({ success: true, message: 'Session deactivated' });
});

/**
 * POST /api/sessions/:id/extend
 * Extend session validity
 */
router.post(
  '/:id/extend',
  authenticate,
  requireTeacher,
  [body('additionalMinutes').isInt({ min: 1, max: 120 })],
  validate,
  (req, res) => {
    const session = SessionService.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.teacherId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updated = SessionService.extendSession(req.params.id, req.body.additionalMinutes);
    res.json({ success: true, session: updated });
  }
);

/**
 * GET /api/sessions/:id/validate
 * Check if session is valid (used by student-facing app)
 */
router.get('/:id/validate', (req, res) => {
  const result = SessionService.isSessionValid(req.params.id);
  res.json(result);
});

module.exports = router;
