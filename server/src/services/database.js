/**
 * SQLite Database Layer
 *
 * Single-file embedded database — ACID-safe, zero-config, portable.
 * Uses WAL mode for concurrent reads and fast writes.
 *
 * Tables:
 *  - teachers        — teacher accounts & Google tokens
 *  - sessions        — QR code sessions
 *  - session_attendees — per-session duplicate tracking
 *  - attendance      — student attendance records
 *  - cheating_logs   — anti-cheat violation records
 *  - json_stores     — generic key-value for schedules, courses, etc.
 */

const Database = require('libsql');
const path = require('path');
const fs = require('fs');

// Database file location
const DB_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}
const DB_PATH = path.join(DB_DIR, 'attendance.db');

// Open database — with optional Turso cloud sync for persistent storage
const hasTurso = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);
const syncOptions = {};
if (hasTurso) {
  syncOptions.syncUrl = process.env.TURSO_DATABASE_URL;
  syncOptions.authToken = process.env.TURSO_AUTH_TOKEN;
  console.log('[DB] Turso cloud sync enabled:', process.env.TURSO_DATABASE_URL);
} else {
  console.log('[DB] Local SQLite only (set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN to enable cloud sync)');
}

const db = new Database(DB_PATH, syncOptions);

// ── Performance settings ──
// Wrapped individually — libsql with Turso sync may fail if remote is unreachable
const safePragma = (p) => { try { db.pragma(p); } catch (e) { console.warn(`[DB] Pragma "${p}" skipped:`, e.message); } };
safePragma('journal_mode = WAL');
safePragma('synchronous = NORMAL');
safePragma('cache_size = -64000');
safePragma('busy_timeout = 5000');
safePragma('temp_store = MEMORY');
safePragma('mmap_size = 268435456');
safePragma('foreign_keys = ON');

// ── Schema ──
try {
db.exec(`
  CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    picture TEXT,
    google_tokens TEXT,
    settings TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    session_type TEXT NOT NULL,
    subject_name TEXT NOT NULL,
    year INTEGER,
    section_or_group TEXT,
    classroom_location TEXT,
    geofence_radius INTEGER DEFAULT 100,
    spreadsheet_id TEXT,
    spreadsheet_url TEXT,
    drive_folder TEXT,
    qr_code_data_url TEXT,
    attendance_url TEXT,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    deactivated_at TEXT,
    attendee_count INTEGER DEFAULT 0,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
  );

  CREATE TABLE IF NOT EXISTS session_attendees (
    session_id TEXT NOT NULL,
    email TEXT NOT NULL,
    PRIMARY KEY (session_id, email),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    email TEXT NOT NULL,
    ip_address TEXT,
    mac_address TEXT,
    latitude TEXT,
    longitude TEXT,
    timestamp TEXT NOT NULL,
    status TEXT NOT NULL,
    violations TEXT,
    synced INTEGER DEFAULT 0,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
  );

  CREATE TABLE IF NOT EXISTS cheating_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    student_name TEXT NOT NULL,
    email TEXT NOT NULL,
    violation_type TEXT,
    details TEXT,
    distance REAL,
    ip_address TEXT,
    mac_address TEXT,
    timestamp TEXT NOT NULL,
    synced INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS json_stores (
    name TEXT PRIMARY KEY,
    data TEXT NOT NULL DEFAULT '[]'
  );

  -- Indexes for hot queries
  CREATE INDEX IF NOT EXISTS idx_sessions_teacher_active
    ON sessions(teacher_id, is_active);
  CREATE INDEX IF NOT EXISTS idx_sessions_expires
    ON sessions(expires_at);
  CREATE INDEX IF NOT EXISTS idx_attendance_session
    ON attendance(session_id);
  CREATE INDEX IF NOT EXISTS idx_attendance_synced
    ON attendance(synced, timestamp);
  CREATE INDEX IF NOT EXISTS idx_attendance_email
    ON attendance(email);
  CREATE INDEX IF NOT EXISTS idx_cheating_session
    ON cheating_logs(session_id);
  CREATE INDEX IF NOT EXISTS idx_cheating_synced
    ON cheating_logs(synced, timestamp);
  CREATE INDEX IF NOT EXISTS idx_cheating_email
    ON cheating_logs(email);
`);
} catch (e) {
  console.error('[DB] Schema creation error (may be OK if tables exist):', e.message);
}

// ── Prepared Statements ──
// (better-sqlite3 caches these internally — this is just for clarity)

const stmts = {
  // Teachers
  findTeacherByEmail: db.prepare('SELECT * FROM teachers WHERE email = ?'),
  findTeacherById: db.prepare('SELECT * FROM teachers WHERE id = ?'),
  insertTeacher: db.prepare(`
    INSERT INTO teachers (id, email, name, picture, google_tokens, settings, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  updateTeacher: db.prepare(`
    UPDATE teachers SET
      email = COALESCE(?, email),
      name = COALESCE(?, name),
      picture = COALESCE(?, picture),
      google_tokens = COALESCE(?, google_tokens),
      settings = COALESCE(?, settings)
    WHERE id = ?
  `),
  getAllTeachers: db.prepare('SELECT * FROM teachers'),

  // Sessions
  insertSession: db.prepare(`
    INSERT INTO sessions (id, teacher_id, session_type, subject_name, year,
      section_or_group, classroom_location, geofence_radius, spreadsheet_id,
      spreadsheet_url, drive_folder, qr_code_data_url, attendance_url,
      created_at, expires_at, is_active, attendee_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  getSession: db.prepare('SELECT * FROM sessions WHERE id = ?'),
  getActiveSessionsByTeacher: db.prepare(
    'SELECT * FROM sessions WHERE teacher_id = ? AND is_active = 1'
  ),
  getAllSessionsByTeacher: db.prepare(
    'SELECT * FROM sessions WHERE teacher_id = ? ORDER BY created_at DESC'
  ),
  updateSession: db.prepare(`
    UPDATE sessions SET
      spreadsheet_id = COALESCE(?, spreadsheet_id),
      spreadsheet_url = COALESCE(?, spreadsheet_url),
      drive_folder = COALESCE(?, drive_folder),
      qr_code_data_url = COALESCE(?, qr_code_data_url),
      attendance_url = COALESCE(?, attendance_url),
      is_active = COALESCE(?, is_active),
      deactivated_at = COALESCE(?, deactivated_at),
      expires_at = COALESCE(?, expires_at),
      attendee_count = COALESCE(?, attendee_count)
    WHERE id = ?
  `),
  deactivateSession: db.prepare(
    'UPDATE sessions SET is_active = 0, deactivated_at = ? WHERE id = ?'
  ),
  deactivateExpired: db.prepare(
    "UPDATE sessions SET is_active = 0, deactivated_at = ? WHERE is_active = 1 AND expires_at < ?"
  ),
  stripQRFromOldSessions: db.prepare(
    "UPDATE sessions SET qr_code_data_url = NULL WHERE is_active = 0 AND deactivated_at < ? AND qr_code_data_url IS NOT NULL"
  ),

  // Session Attendees
  addAttendee: db.prepare(
    'INSERT OR IGNORE INTO session_attendees (session_id, email) VALUES (?, ?)'
  ),
  hasAttendee: db.prepare(
    'SELECT 1 FROM session_attendees WHERE session_id = ? AND email = ?'
  ),
  getAttendeeCount: db.prepare(
    'SELECT COUNT(*) as count FROM session_attendees WHERE session_id = ?'
  ),
  getAttendeeEmails: db.prepare(
    'SELECT email FROM session_attendees WHERE session_id = ?'
  ),

  // Attendance
  insertAttendance: db.prepare(`
    INSERT INTO attendance (session_id, student_name, email, ip_address, mac_address,
      latitude, longitude, timestamp, status, violations, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `),
  getAttendanceBySession: db.prepare(
    'SELECT * FROM attendance WHERE session_id = ?'
  ),
  getAttendanceByEmail: db.prepare(
    'SELECT * FROM attendance WHERE email = ?'
  ),
  getAttendanceBySessions: db.prepare(
    'SELECT * FROM attendance WHERE session_id IN (SELECT id FROM sessions WHERE teacher_id = ?)'
  ),
  markAttendanceSynced: db.prepare(
    'UPDATE attendance SET synced = 1 WHERE id = ?'
  ),
  getUnsyncedAttendance: db.prepare(
    'SELECT * FROM attendance WHERE synced = 0'
  ),
  purgeOldSyncedAttendance: db.prepare(
    "DELETE FROM attendance WHERE synced = 1 AND timestamp < ?"
  ),
  countAttendance: db.prepare('SELECT COUNT(*) as count FROM attendance'),
  getAttendanceStats: db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'PRESENT' THEN 1 ELSE 0 END) as present,
      SUM(CASE WHEN status = 'FLAGGED' THEN 1 ELSE 0 END) as flagged
    FROM attendance WHERE session_id = ?
  `),

  // Cheating Logs
  insertCheatingLog: db.prepare(`
    INSERT INTO cheating_logs (session_id, student_name, email, violation_type,
      details, distance, ip_address, mac_address, timestamp, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `),
  getCheatingBySession: db.prepare(
    'SELECT * FROM cheating_logs WHERE session_id = ?'
  ),
  getCheatingByEmail: db.prepare(
    'SELECT * FROM cheating_logs WHERE email = ?'
  ),
  getAllCheatingLogs: db.prepare('SELECT * FROM cheating_logs'),
  markCheatingSynced: db.prepare(
    'UPDATE cheating_logs SET synced = 1 WHERE id = ?'
  ),
  purgeOldSyncedCheating: db.prepare(
    "DELETE FROM cheating_logs WHERE synced = 1 AND timestamp < ?"
  ),
  countCheating: db.prepare('SELECT COUNT(*) as count FROM cheating_logs'),

  // JSON generic stores (schedules, courses)
  getJsonStore: db.prepare('SELECT data FROM json_stores WHERE name = ?'),
  upsertJsonStore: db.prepare(
    'INSERT INTO json_stores (name, data) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET data = ?'
  ),
};

// ── Helper: serialize/deserialize session rows ──

function serializeSession(s) {
  return {
    id: s.id,
    teacher_id: s.teacherId,
    session_type: s.sessionType,
    subject_name: s.subjectName,
    year: s.year,
    section_or_group: s.sectionOrGroup,
    classroom_location: s.classroomLocation ? JSON.stringify(s.classroomLocation) : null,
    geofence_radius: s.geofenceRadius || 100,
    spreadsheet_id: s.spreadsheetId || null,
    spreadsheet_url: s.spreadsheetUrl || null,
    drive_folder: s.driveFolder ? JSON.stringify(s.driveFolder) : null,
    qr_code_data_url: s.qrCodeDataUrl || null,
    attendance_url: s.attendanceUrl || null,
    created_at: s.createdAt,
    expires_at: s.expiresAt,
    is_active: s.isActive ? 1 : 0,
    attendee_count: s.attendeeCount || 0,
  };
}

function deserializeSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    teacherId: row.teacher_id,
    sessionType: row.session_type,
    subjectName: row.subject_name,
    year: row.year,
    sectionOrGroup: row.section_or_group,
    classroomLocation: row.classroom_location ? JSON.parse(row.classroom_location) : null,
    geofenceRadius: row.geofence_radius,
    spreadsheetId: row.spreadsheet_id,
    spreadsheetUrl: row.spreadsheet_url,
    driveFolder: row.drive_folder ? JSON.parse(row.drive_folder) : null,
    qrCodeDataUrl: row.qr_code_data_url,
    attendanceUrl: row.attendance_url,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    isActive: !!row.is_active,
    deactivatedAt: row.deactivated_at,
    attendeeCount: row.attendee_count,
  };
}

function serializeTeacher(t) {
  return {
    id: t.id,
    email: t.email,
    name: t.name || null,
    picture: t.picture || null,
    google_tokens: t.googleTokens ? JSON.stringify(t.googleTokens) : null,
    settings: t.settings ? JSON.stringify(t.settings) : null,
    created_at: t.createdAt || new Date().toISOString(),
  };
}

function deserializeTeacher(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    picture: row.picture,
    googleTokens: row.google_tokens ? JSON.parse(row.google_tokens) : null,
    settings: row.settings ? JSON.parse(row.settings) : null,
    createdAt: row.created_at,
  };
}

function serializeAttendance(r) {
  return {
    session_id: r.sessionId,
    student_name: r.studentName,
    email: r.email,
    ip_address: r.ipAddress || null,
    mac_address: r.macAddress || null,
    latitude: r.latitude != null ? String(r.latitude) : null,
    longitude: r.longitude != null ? String(r.longitude) : null,
    timestamp: r.timestamp,
    status: r.status,
    violations: r.violations ? JSON.stringify(r.violations) : null,
  };
}

function deserializeAttendance(row) {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    studentName: row.student_name,
    email: row.email,
    ipAddress: row.ip_address,
    macAddress: row.mac_address,
    latitude: row.latitude,
    longitude: row.longitude,
    timestamp: row.timestamp,
    status: row.status,
    violations: row.violations ? JSON.parse(row.violations) : [],
    _synced: !!row.synced,
  };
}

function deserializeCheating(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    sessionId: row.session_id,
    studentName: row.student_name,
    email: row.email,
    violationType: row.violation_type,
    details: row.details,
    distance: row.distance,
    ipAddress: row.ip_address,
    macAddress: row.mac_address,
    timestamp: row.timestamp,
    _synced: !!row.synced,
  };
}

/**
 * Sync local database with Turso cloud.
 * Called at startup (pull remote data) and periodically (push local changes).
 */
async function syncDatabase() {
  if (!hasTurso) {
    console.log('[DB] No Turso credentials — using local SQLite only');
    return;
  }
  try {
    console.log('[DB] Syncing with Turso cloud...');
    await Promise.resolve(db.sync());
    console.log('[DB] Sync complete');
  } catch (e) {
    console.error('[DB] Sync error (will continue with local DB):', e.message);
  }
}

/**
 * Fire-and-forget sync to cloud (non-blocking).
 * Called after writes (cleanup, flush) to push changes.
 */
function syncToCloud() {
  if (!hasTurso) return;
  try {
    Promise.resolve(db.sync()).catch(e => console.warn('[DB] Background sync error:', e.message));
  } catch (e) {
    console.warn('[DB] Background sync error:', e.message);
  }
}

module.exports = {
  db,
  stmts,
  syncDatabase,
  syncToCloud,
  serializeSession,
  deserializeSession,
  serializeTeacher,
  deserializeTeacher,
  serializeAttendance,
  deserializeAttendance,
  deserializeCheating,
};
