const express = require('express');
const jwt = require('jsonwebtoken');
const { google } = require('googleapis');
const config = require('../config');
const { findTeacherByEmail, addTeacher, updateTeacher, findTeacherById } = require('../services/store.service');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Cookie options for JWT — httpOnly prevents XSS token theft
const cookieOpts = () => ({
  httpOnly: true,
  secure: config.nodeEnv === 'production',   // HTTPS only in prod
  sameSite: 'lax',                           // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000,          // 7 days (matches JWT expiry)
  path: '/',
});

/**
 * GET /api/auth/google
 * Redirect to Google OAuth consent screen
 */
router.get('/google', (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: config.google.scopes,
    prompt: 'consent',
  });

  res.json({ authUrl });
});

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth callback
 */
router.get('/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect(`${config.clientUrl}/login?error=no_code`);
    }

    const oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // Find or create teacher
    let teacher = findTeacherByEmail(userInfo.email);
    if (!teacher) {
      teacher = addTeacher({
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture,
        role: 'teacher',
        googleTokens: tokens,
        createdAt: new Date().toISOString(),
        settings: {
          defaultGeofenceRadius: config.defaultGeofenceRadius,
          qrCodeValidityMinutes: config.qrCodeValidityMinutes,
        },
      });
    } else {
      teacher = updateTeacher(teacher.id, {
        googleTokens: tokens,
        lastLogin: new Date().toISOString(),
      });
    }

    // Generate JWT — always set role to 'teacher' (role doesn't need to be in DB)
    const jwtToken = jwt.sign(
      {
        id: teacher.id,
        email: teacher.email,
        name: teacher.name,
        role: 'teacher',
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn }
    );

    // Set httpOnly cookie (prevents XSS token theft) and redirect
    res.cookie('token', jwtToken, cookieOpts());
    res.redirect(`${config.clientUrl}/auth/callback?success=true`);
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.redirect(`${config.clientUrl}/login?error=auth_failed`);
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, (req, res) => {
  const teacher = findTeacherById(req.user.id);
  if (!teacher) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { googleTokens, ...safeTeacher } = teacher;
  res.json({ user: { ...safeTeacher, role: 'teacher' } });
});

/**
 * POST /api/auth/logout
 * Clear JWT cookie
 */
router.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, path: '/' });
  res.json({ success: true });
});

/**
 * PUT /api/auth/settings
 * Update user settings
 */
router.put('/settings', authenticate, (req, res) => {
  const { settings } = req.body;
  const teacher = updateTeacher(req.user.id, { settings });
  if (!teacher) {
    return res.status(404).json({ error: 'User not found' });
  }
  const { googleTokens, ...safeTeacher } = teacher;
  res.json({ user: { ...safeTeacher, role: 'teacher' } });
});

module.exports = router;
