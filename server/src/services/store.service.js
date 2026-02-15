const {
  db,
  stmts,
  syncToCloud,
  debouncedSync,
  serializeSession,
  deserializeSession,
  serializeTeacher,
  deserializeTeacher,
  serializeAttendance,
  deserializeAttendance,
  deserializeCheating,
} = require('./database');

/**
 * SQLite-backed data store.
 * All reads/writes go directly to the database — no JSON files, no manual caching.
 * SQLite WAL mode + page cache handles performance.
 */

// ══════════════ Teachers ══════════════

function getTeacherStore() {
  return stmts.getAllTeachers.all().map(deserializeTeacher);
}

function findTeacherByEmail(email) {
  return deserializeTeacher(stmts.findTeacherByEmail.get(email));
}

function findTeacherById(id) {
  return deserializeTeacher(stmts.findTeacherById.get(id));
}

function addTeacher(teacher) {
  const t = serializeTeacher(teacher);
  stmts.insertTeacher.run(t.id, t.email, t.name, t.picture, t.google_tokens, t.settings, t.created_at);
  debouncedSync();
  return teacher;
}

function updateTeacher(id, updates) {
  const existing = findTeacherById(id);
  if (!existing) return null;
  const merged = { ...existing, ...updates };
  const row = serializeTeacher(merged);
  stmts.updateTeacher.run(row.email, row.name, row.picture, row.google_tokens, row.settings, id);
  debouncedSync();
  return merged;
}

// ══════════════ Sessions ══════════════

function addSession(session) {
  const s = serializeSession(session);
  stmts.insertSession.run(
    s.id, s.teacher_id, s.session_type, s.subject_name, s.year,
    s.section_or_group, s.classroom_location, s.geofence_radius, s.spreadsheet_id,
    s.spreadsheet_url, s.drive_folder, s.qr_code_data_url, s.attendance_url,
    s.created_at, s.expires_at, s.is_active, s.attendee_count
  );
  debouncedSync();
  return session;
}

function getSession(sessionId) {
  return deserializeSession(stmts.getSession.get(sessionId));
}

function updateSessionFields(sessionId, updates) {
  // Build a partial update — only set non-undefined fields
  const current = stmts.getSession.get(sessionId);
  if (!current) return null;
  const deserialized = deserializeSession(current);
  const merged = { ...deserialized, ...updates };
  const params = serializeSession(merged);
  // Also handle explicit fields not in serializeSession mapping
  if (updates.deactivatedAt !== undefined) params.deactivated_at = updates.deactivatedAt;
  if (updates.isActive !== undefined) params.is_active = updates.isActive ? 1 : 0;

  stmts.updateSession.run(
    params.spreadsheet_id,
    params.spreadsheet_url,
    params.drive_folder,
    params.qr_code_data_url,
    params.attendance_url,
    params.is_active,
    params.deactivated_at || null,
    params.expires_at,
    params.attendee_count,
    sessionId
  );

  debouncedSync();
  return { ...deserialized, ...updates };
}

function deactivateSession(sessionId) {
  stmts.deactivateSession.run(new Date().toISOString(), sessionId);
}

function deactivateExpiredSessions() {
  const now = new Date().toISOString();
  return stmts.deactivateExpired.run(now, now);
}

function getActiveSessionsByTeacher(teacherId) {
  // Auto-expire first
  deactivateExpiredSessions();
  return stmts.getActiveSessionsByTeacher.all(teacherId).map(deserializeSession);
}

function getAllSessionsByTeacher(teacherId) {
  deactivateExpiredSessions();
  return stmts.getAllSessionsByTeacher.all(teacherId).map(deserializeSession);
}

// Attendee tracking (separate table — much cheaper than array manipulation)
const _updateAttendeeCount = db.prepare('UPDATE sessions SET attendee_count = ? WHERE id = ?');

function addSessionAttendee(sessionId, email) {
  stmts.addAttendee.run(sessionId, email);
  const count = stmts.getAttendeeCount.get(sessionId).count;
  _updateAttendeeCount.run(count, sessionId);
}

function hasSessionAttendee(sessionId, email) {
  return !!stmts.hasAttendee.get(sessionId, email);
}

function getSessionAttendeeEmails(sessionId) {
  return stmts.getAttendeeEmails.all(sessionId).map(r => r.email);
}

// ══════════════ Attendance ══════════════

function addAttendanceRecord(record) {
  const r = serializeAttendance(record);
  const result = stmts.insertAttendance.run(
    r.session_id, r.student_name, r.email, r.ip_address, r.mac_address,
    r.latitude, r.longitude, r.timestamp, r.status, r.violations
  );
  debouncedSync();
  return result.lastInsertRowid;
}

function getAttendanceBySession(sessionId) {
  return stmts.getAttendanceBySession.all(sessionId).map(deserializeAttendance);
}

function getAttendanceByTeacher(teacherId) {
  return stmts.getAttendanceBySessions.all(teacherId).map(deserializeAttendance);
}

function getAttendanceByEmail(email) {
  return stmts.getAttendanceByEmail.all(email).map(deserializeAttendance);
}

function markAttendanceSynced(id) {
  stmts.markAttendanceSynced.run(id);
}

function getAttendanceStats(sessionId) {
  return stmts.getAttendanceStats.get(sessionId);
}

// Backward compat — used by analytics routes
function getAttendanceStore() {
  return db.prepare('SELECT * FROM attendance').all().map(deserializeAttendance);
}

function saveAttendanceStore() {
  // No-op — individual inserts handle this now
}

// ══════════════ Cheating Logs ══════════════

function addCheatingLog(log) {
  const result = stmts.insertCheatingLog.run(
    log.sessionId || null,
    log.studentName,
    log.email,
    log.violationType || null,
    log.details || null,
    log.distance != null ? log.distance : null,
    log.ipAddress || null,
    log.macAddress || null,
    log.timestamp || new Date().toISOString()
  );
  debouncedSync();
  return result.lastInsertRowid;
}

function getCheatingBySession(sessionId) {
  return stmts.getCheatingBySession.all(sessionId).map(deserializeCheating);
}

function getCheatingByEmail(email) {
  return stmts.getCheatingByEmail.all(email).map(deserializeCheating);
}

function markCheatingSynced(id) {
  stmts.markCheatingSynced.run(id);
}

// Backward compat
function getCheatingStore() {
  return stmts.getAllCheatingLogs.all().map(deserializeCheating);
}

function saveCheatingStore() {
  // No-op
}

// ══════════════ JSON Generic Stores ══════════════
// (schedules, courses — small data, keep as JSON blobs)

function getJsonStore(name) {
  const row = stmts.getJsonStore.get(name);
  if (!row) return [];
  try { return JSON.parse(row.data); } catch { return []; }
}

function saveJsonStore(name, data) {
  const json = JSON.stringify(data);
  stmts.upsertJsonStore.run(name, json, json);
  debouncedSync();
}

function getScheduleStore() { return getJsonStore('schedules'); }
function saveScheduleStore(data) { saveJsonStore('schedules', data); }
function getCourseStore() { return getJsonStore('courses'); }
function saveCourseStore(data) { saveJsonStore('courses', data); }

// ══════════════ Shutdown ══════════════

function flushAllStores() {
  // SQLite writes are durable already. Just checkpoint WAL.
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (e) {
    console.warn('[DB] WAL checkpoint error:', e.message);
  }
  // Push changes to Turso cloud
  syncToCloud();
}

function closeDatabase() {
  flushAllStores();
  db.close();
}

// ══════════════ Stats ══════════════

function getStoreStats() {
  return {
    attendance: stmts.countAttendance.get().count,
    sessions: db.prepare('SELECT COUNT(*) as count FROM sessions').get().count,
    cheating: stmts.countCheating.get().count,
    teachers: db.prepare('SELECT COUNT(*) as count FROM teachers').get().count,
  };
}

module.exports = {
  // Teacher
  getTeacherStore,
  findTeacherByEmail,
  findTeacherById,
  addTeacher,
  updateTeacher,

  // Session (new targeted methods)
  addSession,
  getSession,
  updateSessionFields,
  deactivateSession,
  deactivateExpiredSessions,
  getActiveSessionsByTeacher,
  getAllSessionsByTeacher,
  addSessionAttendee,
  hasSessionAttendee,
  getSessionAttendeeEmails,

  // Attendance (new targeted + backward compat)
  addAttendanceRecord,
  getAttendanceBySession,
  getAttendanceByTeacher,
  getAttendanceByEmail,
  markAttendanceSynced,
  getAttendanceStats,
  getAttendanceStore,      // backward compat (analytics)
  saveAttendanceStore,     // no-op

  // Cheating (new targeted + backward compat)
  addCheatingLog,
  getCheatingBySession,
  getCheatingByEmail,
  markCheatingSynced,
  getCheatingStore,        // backward compat
  saveCheatingStore,       // no-op

  // JSON stores (schedules, courses)
  getScheduleStore,
  saveScheduleStore,
  getCourseStore,
  saveCourseStore,

  // Lifecycle
  flushAllStores,
  closeDatabase,
  getStoreStats,
};
