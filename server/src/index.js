const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { flushAllStores, closeDatabase } = require('./services/store.service');
const ResourceManager = require('./services/resource-manager.service');

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
app.use(helmet({
  contentSecurityPolicy: false,        // React app handles its own CSP
  crossOriginEmbedderPolicy: false,    // Allow loading Google profile images
}));

// CORS — needed in dev (different ports), same-origin in production
const allowedOrigins = [config.clientUrl];
if (process.env.RENDER_EXTERNAL_HOSTNAME) {
  allowedOrigins.push(`https://${process.env.RENDER_EXTERNAL_HOSTNAME}`);
}
app.use(cors({
  origin: allowedOrigins.filter(Boolean),
  credentials: true,
}));

// Rate limiting — separate tiers for teachers vs students
const teacherLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
});

// Student attendance endpoint: high burst allowed (university WiFi = many students, one IP)
const studentLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 300,                  // 300/min per IP — handles full lecture hall behind one WiFi
  message: { error: 'Too many attempts, please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Global server protection — caps total throughput
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10000,                // 10k requests/min across all IPs
  keyGenerator: () => 'global',
  message: { error: 'Server under heavy load, please retry shortly.' },
});

app.use('/api/auth', teacherLimiter);
app.use('/api/sessions', teacherLimiter);
app.use('/api/schedules', teacherLimiter);
app.use('/api/analytics', teacherLimiter);
app.use('/api/cheating', teacherLimiter);
app.use('/api/drive', teacherLimiter);
app.use('/api/attendance/submit', studentLimiter);
app.use(globalLimiter);

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

// In production, serve the React build as static files
const clientBuildPath = path.join(__dirname, '..', '..', 'client', 'build');
if (config.nodeEnv === 'production') {
  app.use(express.static(clientBuildPath));
}

// Health check with full monitoring
app.get('/api/health', (req, res) => {
  const { driveQueue, attendanceQueue } = require('./services/queue.service');
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    memory: ResourceManager.getMemoryStats(),
    stores: ResourceManager.getStoreStats(),
    queues: {
      drive: driveQueue.stats,
      attendance: attendanceQueue.stats,
    },
    database: 'sqlite',
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

// SPA catch-all — serve React index.html for non-API routes in production
if (config.nodeEnv === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// 404 handler (only for API routes in production, all routes in dev)
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = config.port;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${config.nodeEnv} mode`);
  // Start periodic resource cleanup (every 5 min)
  ResourceManager.startPeriodicCleanup(5 * 60 * 1000);
});

// Increase keep-alive for concurrent connections
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

// Graceful shutdown — flush cached data to disk
function shutdown(signal) {
  console.log(`\n${signal} received. Closing database...`);
  ResourceManager.stopPeriodicCleanup();
  flushAllStores();   // WAL checkpoint
  closeDatabase();    // Close SQLite connection
  console.log('Database closed. Shutting down.');
  server.close(() => process.exit(0));
  // Force exit after 5s
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

module.exports = app;
