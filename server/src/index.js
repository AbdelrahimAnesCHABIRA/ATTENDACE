const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { flushAllStores } = require('./services/store.service');

// Import routes
const authRoutes = require('./routes/auth.routes');
const sessionRoutes = require('./routes/session.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const scheduleRoutes = require('./routes/schedule.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const cheatingRoutes = require('./routes/cheating.routes');
const driveRoutes = require('./routes/drive.routes');

const app = express();

// Trust proxy for accurate IP behind reverse proxy / load balancer
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));

// Rate limiting — separate tiers for teachers vs students
const teacherLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
});

// Student attendance endpoint: allow burst of thousands
const studentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute window
  max: 5,                   // 5 per minute per IP (one student can't spam)
  message: { error: 'Too many attempts, please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth', teacherLimiter);
app.use('/api/sessions', teacherLimiter);
app.use('/api/schedules', teacherLimiter);
app.use('/api/analytics', teacherLimiter);
app.use('/api/cheating', teacherLimiter);
app.use('/api/drive', teacherLimiter);
app.use('/api/attendance/submit', studentLimiter);

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging — lighter in production
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/cheating', cheatingRoutes);
app.use('/api/drive', driveRoutes);

// Root redirect (frontend runs on port 3000 in dev)
app.get('/', (req, res) => {
  if (config.nodeEnv === 'development') {
    res.redirect(config.clientUrl);
  } else {
    res.sendFile(require('path').join(__dirname, '..', '..', 'client', 'build', 'index.html'));
  }
});

// Health check with queue status
app.get('/api/health', (req, res) => {
  const { driveQueue, attendanceQueue } = require('./services/queue.service');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    queues: {
      drive: driveQueue.length,
      attendance: attendanceQueue.length,
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: config.nodeEnv === 'development' ? err.message : 'Internal server error',
    ...(config.nodeEnv === 'development' && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = config.port;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${config.nodeEnv} mode`);
});

// Increase keep-alive for concurrent connections
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Graceful shutdown — flush cached data to disk
function shutdown(signal) {
  console.log(`\n${signal} received. Flushing data to disk...`);
  flushAllStores();
  console.log('Data flushed. Shutting down.');
  server.close(() => process.exit(0));
  // Force exit after 5s
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;
