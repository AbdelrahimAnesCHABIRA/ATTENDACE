/**
 * Resource Manager
 *
 * Periodic cleanup of SQLite database:
 * 1. Purge old synced attendance records
 * 2. Strip QR data from expired sessions
 * 3. Purge old synced cheating logs
 * 4. Report memory and DB stats
 */

const { db, stmts, syncToCloud } = require('./database');
const { getStoreStats } = require('./store.service');

// ── Timing constants ──
const SYNC_GRACE_MS = 10 * 60 * 1000;       // 10 min: keep synced records for teacher viewing
const QR_STRIP_MS = 30 * 60 * 1000;         // 30 min: strip QR data URLs from expired sessions

let _cleanupInterval = null;

/**
 * Start periodic cleanup timer
 */
function startPeriodicCleanup(intervalMs = 5 * 60 * 1000) {
  if (_cleanupInterval) clearInterval(_cleanupInterval);
  _cleanupInterval = setInterval(() => cleanup(), intervalMs);
  console.log(`[ResourceManager] Periodic cleanup every ${Math.round(intervalMs / 1000)}s`);
}

/**
 * Stop the cleanup timer
 */
function stopPeriodicCleanup() {
  if (_cleanupInterval) {
    clearInterval(_cleanupInterval);
    _cleanupInterval = null;
  }
}

/**
 * Run one cleanup cycle
 */
function cleanup() {
  const stats = { attendancePurged: 0, cheatingPurged: 0, qrStripped: 0 };

  // ── 1. Purge old synced attendance ──
  const graceDate = new Date(Date.now() - SYNC_GRACE_MS).toISOString();
  const attendanceResult = stmts.purgeOldSyncedAttendance.run(graceDate);
  stats.attendancePurged = attendanceResult.changes;

  // ── 2. Strip QR data from old expired sessions ──
  const qrDate = new Date(Date.now() - QR_STRIP_MS).toISOString();
  const qrResult = stmts.stripQRFromOldSessions.run(qrDate);
  stats.qrStripped = qrResult.changes;

  // ── 3. Purge old synced cheating logs ──
  const cheatingResult = stmts.purgeOldSyncedCheating.run(graceDate);
  stats.cheatingPurged = cheatingResult.changes;

  // ── Log summary ──
  const total = stats.attendancePurged + stats.cheatingPurged + stats.qrStripped;
  if (total > 0) {
    console.log(
      `[ResourceManager] Cleanup: ${stats.attendancePurged} attendance, ` +
      `${stats.cheatingPurged} cheating purged, ${stats.qrStripped} QR stripped`
    );
  }

  // Push cleanup changes to Turso cloud
  syncToCloud();

  return stats;
}

/**
 * Process memory stats
 */
function getMemoryStats() {
  const mem = process.memoryUsage();
  return {
    heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024 * 10) / 10,
    heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024 * 10) / 10,
    rssMB: Math.round(mem.rss / 1024 / 1024 * 10) / 10,
  };
}

module.exports = {
  startPeriodicCleanup,
  stopPeriodicCleanup,
  cleanup,
  getMemoryStats,
  getStoreStats,
};
