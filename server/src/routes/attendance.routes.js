const express = require('express');
const { body } = require('express-validator');
const { authenticate, requireTeacher } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const SessionService = require('../services/session.service');
const AntiCheatingService = require('../services/anticheating.service');
const DriveService = require('../services/drive.service');
const { attendanceQueue } = require('../services/queue.service');
const {
  findTeacherById,
  getAttendanceStore,
  saveAttendanceStore,
} = require('../services/store.service');

const router = express.Router();

/**
 * POST /api/attendance/submit
 * Student submits attendance (public endpoint - no auth required)
 * Optimized: local save + instant response, Drive write queued in background
 */
router.post(
  '/submit',
  [
    body('sessionId').notEmpty().withMessage('Session ID required'),
    body('studentName').notEmpty().trim().withMessage('Full name required'),
    body('email').isEmail().withMessage('Valid university email required'),
  ],
  validate,
  async (req, res) => {
    try {
      const {
        sessionId,
        studentName,
        email,
        macAddress,
        latitude,
        longitude,
      } = req.body;

      const ipAddress =
        req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.connection?.remoteAddress ||
        req.ip;

      // 1. Validate session (from cache — no disk read)
      const sessionCheck = SessionService.isSessionValid(sessionId);
      if (!sessionCheck.valid) {
        return res.json({ success: true, message: 'Attendance submitted successfully' });
      }

      const session = sessionCheck.session;

      // 2. Duplicate check (from cache)
      if (SessionService.hasStudentSubmitted(sessionId, email)) {
        return res.json({ success: true, message: 'Attendance already recorded' });
      }

      // 3. Anti-cheating (lightweight — no I/O)
      const validationResult = await AntiCheatingService.validateSubmission({
        sessionId,
        studentName,
        email,
        ipAddress,
        macAddress: macAddress || 'N/A',
        studentLocation: latitude && longitude ? { lat: latitude, lng: longitude } : null,
        classroomLocation: session.classroomLocation,
        geofenceRadius: session.geofenceRadius,
      });

      // 4. Record attendance locally (writes to cache, debounced disk)
      const record = {
        sessionId,
        studentName,
        email,
        ipAddress,
        macAddress: macAddress || 'N/A',
        latitude: latitude || 'N/A',
        longitude: longitude || 'N/A',
        timestamp: new Date().toISOString(),
        status: validationResult.isValid ? 'PRESENT' : 'FLAGGED',
        violations: validationResult.violations,
      };

      const attendance = getAttendanceStore();
      attendance.push(record);
      saveAttendanceStore(attendance);

      // Update session attendee count (cache)
      SessionService.addAttendee(sessionId, email);

      // ── RESPOND INSTANTLY ──
      res.json({ success: true, message: 'Attendance submitted successfully' });

      // 5. Queue Drive write in background (non-blocking)
      if (session.spreadsheetId) {
        attendanceQueue.enqueue(async () => {
          try {
            const teacher = findTeacherById(session.teacherId);
            if (!teacher?.googleTokens) return;

            const driveService = new DriveService(teacher.googleTokens.access_token);
            await driveService.appendAttendanceRecord(session.spreadsheetId, {
              timestamp: record.timestamp,
              studentName: record.studentName,
              email: record.email,
              status: record.status,
              ipAddress: record.ipAddress,
              macAddress: record.macAddress,
              latitude: record.latitude,
              longitude: record.longitude,
            });

            // If flagged, queue violation log
            if (!validationResult.isValid) {
              const config = require('../config');
              const cheatingSheetId = await driveService.getOrCreateCheatingLog(config.academicYear);
              for (const v of validationResult.violations) {
                await driveService.logViolation(cheatingSheetId, {
                  timestamp: record.timestamp,
                  studentName: record.studentName,
                  email: record.email,
                  violationType: v.type,
                  details: v.details,
                  distance: v.distance,
                  ipAddress: record.ipAddress,
                  macAddress: record.macAddress,
                });
              }
            }
          } catch (err) {
            console.error('[AttendanceQueue] Drive write failed:', err.message);
          }
        }, `attendance-${sessionId}-${email}`);
      }
    } catch (error) {
      console.error('Attendance submit error:', error);
      res.status(500).json({ error: 'Failed to submit attendance' });
    }
  }
);

/**
 * GET /api/attendance/session/:sessionId
 * Get attendance records for a specific session (teacher only)
 */
router.get('/session/:sessionId', authenticate, requireTeacher, (req, res) => {
  const attendance = getAttendanceStore();
  const sessionRecords = attendance.filter(r => r.sessionId === req.params.sessionId);
  res.json({
    records: sessionRecords,
    total: sessionRecords.length,
    present: sessionRecords.filter(r => r.status === 'PRESENT').length,
    flagged: sessionRecords.filter(r => r.status === 'FLAGGED').length,
  });
});

/**
 * GET /api/attendance/student/:email
 * Get attendance for a specific student across all sessions (teacher only)
 */
router.get('/student/:email', authenticate, requireTeacher, (req, res) => {
  const attendance = getAttendanceStore();
  const studentRecords = attendance.filter(r => r.email === req.params.email);
  res.json({ records: studentRecords, total: studentRecords.length });
});

/**
 * GET /api/attendance/stats
 * Get overall attendance statistics (teacher only)
 */
router.get('/stats', authenticate, requireTeacher, (req, res) => {
  const attendance = getAttendanceStore();
  const teacherSessions = SessionService.getAllSessionsForTeacher(req.user.id);
  const teacherSessionIds = teacherSessions.map(s => s.id);

  const teacherAttendance = attendance.filter(r => teacherSessionIds.includes(r.sessionId));

  const totalSessions = teacherSessions.length;
  const totalSubmissions = teacherAttendance.length;
  const presentCount = teacherAttendance.filter(r => r.status === 'PRESENT').length;
  const flaggedCount = teacherAttendance.filter(r => r.status === 'FLAGGED').length;

  // Get unique students
  const uniqueStudents = [...new Set(teacherAttendance.map(r => r.email))];

  // Attendance by session type
  const bySessionType = {};
  teacherSessions.forEach(session => {
    if (!bySessionType[session.sessionType]) {
      bySessionType[session.sessionType] = { sessions: 0, submissions: 0 };
    }
    bySessionType[session.sessionType].sessions++;
    bySessionType[session.sessionType].submissions += attendance.filter(
      r => r.sessionId === session.id
    ).length;
  });

  res.json({
    totalSessions,
    totalSubmissions,
    presentCount,
    flaggedCount,
    uniqueStudents: uniqueStudents.length,
    averageAttendance:
      totalSessions > 0 ? Math.round(totalSubmissions / totalSessions) : 0,
    bySessionType,
  });
});

module.exports = router;
