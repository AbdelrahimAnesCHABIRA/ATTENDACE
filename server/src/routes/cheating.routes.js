const express = require('express');
const { authenticate, requireTeacherOrAdmin } = require('../middleware/auth.middleware');
const AntiCheatingService = require('../services/anticheating.service');

const router = express.Router();

/**
 * GET /api/cheating/violations
 * Get cheating violations with optional filters
 */
router.get('/violations', authenticate, requireTeacherOrAdmin, (req, res) => {
  const { sessionId, email, violationType, startDate, endDate } = req.query;

  const violations = AntiCheatingService.getViolations({
    sessionId,
    email,
    violationType,
    startDate,
    endDate,
  });

  res.json({
    violations,
    total: violations.length,
  });
});

/**
 * GET /api/cheating/suspicious
 * Get students with suspicious patterns
 */
router.get('/suspicious', authenticate, requireTeacherOrAdmin, (req, res) => {
  const minViolations = parseInt(req.query.minViolations) || 3;
  const suspicious = AntiCheatingService.getSuspiciousStudents(minViolations);
  res.json({ students: suspicious });
});

/**
 * GET /api/cheating/stats
 * Get cheating statistics overview
 */
router.get('/stats', authenticate, requireTeacherOrAdmin, (req, res) => {
  const allViolations = AntiCheatingService.getViolations();

  const byType = {};
  allViolations.forEach(v => {
    byType[v.violationType] = (byType[v.violationType] || 0) + 1;
  });

  const uniqueStudents = [...new Set(allViolations.map(v => v.email))];

  res.json({
    totalViolations: allViolations.length,
    uniqueStudentsFlagged: uniqueStudents.length,
    byType,
    recentViolations: allViolations.slice(-10).reverse(),
  });
});

module.exports = router;
