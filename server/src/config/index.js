require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/auth/google/callback',
    scopes: [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  },
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  defaultGeofenceRadius: parseInt(process.env.DEFAULT_GEOFENCE_RADIUS, 10) || 100,
  qrCodeValidityMinutes: parseInt(process.env.QR_CODE_VALIDITY_MINUTES, 10) || 15,
  academicYear: process.env.ACADEMIC_YEAR || '2025-2026',
};
