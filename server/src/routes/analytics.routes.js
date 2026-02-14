const express = require('express');
const { authenticate, requireTeacher } = require('../middleware/auth.middleware');
const SessionService = require('../services/session.service');
const { getAttendanceStore } = require('../services/store.service');

const router = express.Router();

/**
 * GET /api/analytics/overview
 * Get overall analytics for teacher dashboard
 */
router.get('/overview', authenticate, requireTeacher, (req, res) => {
  const allSessions = SessionService.getAllSessionsForTeacher(req.user.id);
  const attendance = getAttendanceStore();
  const sessionIds = allSessions.map(s => s.id);
  const myAttendance = attendance.filter(r => sessionIds.includes(r.sessionId));

  // Today's stats
  const today = new Date().toISOString().split('T')[0];
  const todaySessions = allSessions.filter(s => s.createdAt.startsWith(today));
  const todayAttendance = myAttendance.filter(r => r.timestamp.startsWith(today));

  // Last 7 days
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekAttendance = myAttendance.filter(r => new Date(r.timestamp) >= weekAgo);

  // Average attendance per session
  const sessionsWithAttendance = {};
  myAttendance.forEach(r => {
    if (!sessionsWithAttendance[r.sessionId]) {
      sessionsWithAttendance[r.sessionId] = 0;
    }
    sessionsWithAttendance[r.sessionId]++;
  });

  const avgAttendancePerSession =
    Object.keys(sessionsWithAttendance).length > 0
      ? Math.round(
          Object.values(sessionsWithAttendance).reduce((a, b) => a + b, 0) /
            Object.keys(sessionsWithAttendance).length
        )
      : 0;

  res.json({
    totalSessions: allSessions.length,
    activeSessions: allSessions.filter(s => s.isActive).length,
    todaySessions: todaySessions.length,
    todayAttendees: todayAttendance.length,
    weeklyAttendees: weekAttendance.length,
    averageAttendancePerSession: avgAttendancePerSession,
    uniqueStudents: [...new Set(myAttendance.map(r => r.email))].length,
    flaggedCount: myAttendance.filter(r => r.status === 'FLAGGED').length,
  });
});

/**
 * GET /api/analytics/trends
 * Get attendance trends over time
 */
router.get('/trends', authenticate, requireTeacher, (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const attendance = getAttendanceStore();
  const allSessions = SessionService.getAllSessionsForTeacher(req.user.id);
  const sessionIds = allSessions.map(s => s.id);
  const myAttendance = attendance.filter(r => sessionIds.includes(r.sessionId));

  // Group by date
  const trends = {};
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  for (let i = 0; i <= days; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    trends[dateStr] = {
      date: dateStr,
      total: 0,
      present: 0,
      flagged: 0,
      sessions: 0,
    };
  }

  myAttendance.forEach(record => {
    const dateStr = record.timestamp.split('T')[0];
    if (trends[dateStr]) {
      trends[dateStr].total++;
      if (record.status === 'PRESENT') trends[dateStr].present++;
      if (record.status === 'FLAGGED') trends[dateStr].flagged++;
    }
  });

  allSessions.forEach(session => {
    const dateStr = session.createdAt.split('T')[0];
    if (trends[dateStr]) {
      trends[dateStr].sessions++;
    }
  });

  res.json({ trends: Object.values(trends) });
});

/**
 * GET /api/analytics/courses
 * Get per-course analytics
 */
router.get('/courses', authenticate, requireTeacher, (req, res) => {
  const allSessions = SessionService.getAllSessionsForTeacher(req.user.id);
  const attendance = getAttendanceStore();

  const courses = {};
  allSessions.forEach(session => {
    const key = `${session.subjectName}_${session.sessionType}`;
    if (!courses[key]) {
      courses[key] = {
        subjectName: session.subjectName,
        sessionType: session.sessionType,
        totalSessions: 0,
        totalAttendees: 0,
        uniqueStudents: new Set(),
        averageAttendance: 0,
      };
    }
    courses[key].totalSessions++;

    const sessionAttendance = attendance.filter(
      r => r.sessionId === session.id && r.status === 'PRESENT'
    );
    courses[key].totalAttendees += sessionAttendance.length;
    sessionAttendance.forEach(r => courses[key].uniqueStudents.add(r.email));
  });

  const courseList = Object.values(courses).map(c => ({
    ...c,
    uniqueStudents: c.uniqueStudents.size,
    averageAttendance:
      c.totalSessions > 0 ? Math.round(c.totalAttendees / c.totalSessions) : 0,
  }));

  res.json({ courses: courseList });
});

/**
 * GET /api/analytics/low-attendance
 * Get students with low attendance
 */
router.get('/low-attendance', authenticate, requireTeacher, (req, res) => {
  const threshold = parseInt(req.query.threshold) || 70;
  const allSessions = SessionService.getAllSessionsForTeacher(req.user.id);
  const attendance = getAttendanceStore();
  const sessionIds = allSessions.map(s => s.id);
  const myAttendance = attendance.filter(r => sessionIds.includes(r.sessionId));

  // Count attendance per student
  const studentStats = {};
  myAttendance.forEach(record => {
    if (!studentStats[record.email]) {
      studentStats[record.email] = {
        email: record.email,
        studentName: record.studentName,
        present: 0,
        flagged: 0,
        total: 0,
      };
    }
    studentStats[record.email].total++;
    if (record.status === 'PRESENT') {
      studentStats[record.email].present++;
    } else {
      studentStats[record.email].flagged++;
    }
  });

  const lowAttendance = Object.values(studentStats)
    .map(s => ({
      ...s,
      attendanceRate:
        s.total > 0 ? Math.round((s.present / allSessions.length) * 100) : 0,
    }))
    .filter(s => s.attendanceRate < threshold)
    .sort((a, b) => a.attendanceRate - b.attendanceRate);

  res.json({ students: lowAttendance, threshold });
});

module.exports = router;
