const jwt = require('jsonwebtoken');
const config = require('../config');
const { findTeacherById } = require('../services/store.service');

/**
 * Authentication middleware - verifies JWT token
 * Priority: 1) httpOnly cookie (secure), 2) Authorization header (legacy/API)
 */
const authenticate = (req, res, next) => {
  try {
    // Prefer httpOnly cookie (secure), fall back to Authorization header
    const token =
      req.cookies?.token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.split(' ')[1]
        : null);

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      // Clear expired cookie
      res.clearCookie('token', { httpOnly: true, path: '/' });
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Teacher-only role middleware
 */
const requireTeacher = (req, res, next) => {
  if (!req.user || req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Teacher access required' });
  }
  next();
};

/**
 * Admin-only role middleware
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Teacher or Admin middleware
 */
const requireTeacherOrAdmin = (req, res, next) => {
  if (!req.user || !['teacher', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Teacher or Admin access required' });
  }
  next();
};

module.exports = {
  authenticate,
  requireTeacher,
  requireAdmin,
  requireTeacherOrAdmin,
};
