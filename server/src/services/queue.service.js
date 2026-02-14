/**
 * Keyed Concurrent Write Queue
 *
 * Processes tasks in parallel across different keys (e.g., sessions),
 * but sequentially within the same key (prevents race conditions on same spreadsheet).
 *
 * Features:
 * - Configurable concurrency (parallel lanes)
 * - Backpressure (max queue size, rejects when full)
 * - Automatic retry with exponential backoff
 * - onSuccess/onFailure callbacks for resource cleanup
 * - Per-key ordering guarantees (same spreadsheet writes stay sequential)
 * - Stats tracking for monitoring
 */

class KeyedConcurrentQueue {
  /**
   * @param {string} name - Queue name for logging
   * @param {Object} opts
   * @param {number} opts.concurrency - Max parallel lanes (default 5)
   * @param {number} opts.maxSize     - Backpressure limit (default 10000)
   * @param {number} opts.retries     - Max retries per task (default 2)
   * @param {number} opts.retryDelay  - Base retry delay ms (default 1000)
   */
  constructor(name, { concurrency = 5, maxSize = 10000, retries = 2, retryDelay = 1000 } = {}) {
    this.name = name;
    this._lanes = new Map();       // key → [{ task, label, retries, onSuccess, onFailure }]
    this._activeLanes = new Set(); // keys currently being processed
    this._concurrency = concurrency;
    this._maxSize = maxSize;
    this._maxRetries = retries;
    this._retryDelay = retryDelay;
    this._totalItems = 0;
    this._processed = 0;
    this._failed = 0;
  }

  /**
   * Add a task to the queue.
   * @param {Function} task         - Async function to execute
   * @param {string}   label        - Description for logging
   * @param {string}   key          - Lane key (tasks with same key run sequentially)
   * @param {Object}   [callbacks]  - { onSuccess, onFailure } optional callbacks
   * @returns {boolean} true if enqueued, false if rejected (backpressure)
   */
  enqueue(task, label = 'task', key = 'default', { onSuccess, onFailure } = {}) {
    if (this._totalItems >= this._maxSize) {
      console.warn(`[${this.name}] Backpressure: queue full (${this._maxSize}), dropping "${label}"`);
      if (onFailure) try { onFailure(new Error('Queue full - backpressure')); } catch (e) { /* ignore */ }
      return false;
    }

    if (!this._lanes.has(key)) {
      this._lanes.set(key, []);
    }
    this._lanes.get(key).push({ task, label, retries: 0, onSuccess, onFailure });
    this._totalItems++;
    this._drain();
    return true;
  }

  /**
   * Start processing available lanes up to concurrency limit.
   * Each lane processes its items sequentially; different lanes run in parallel.
   */
  _drain() {
    for (const [key, items] of this._lanes) {
      if (this._activeLanes.size >= this._concurrency) break;
      if (this._activeLanes.has(key) || items.length === 0) continue;

      this._activeLanes.add(key);
      this._processLane(key).finally(() => {
        this._activeLanes.delete(key);
        // Clean up empty lanes to free memory
        if (this._lanes.has(key) && this._lanes.get(key).length === 0) {
          this._lanes.delete(key);
        }
        this._drain(); // check if more lanes can start
      });
    }
  }

  /**
   * Process all items in a single lane sequentially
   */
  async _processLane(key) {
    const items = this._lanes.get(key);
    while (items && items.length > 0) {
      const item = items.shift();
      this._totalItems--;
      try {
        await item.task();
        this._processed++;
        if (item.onSuccess) try { item.onSuccess(); } catch (e) { /* ignore */ }
      } catch (err) {
        if (item.retries < this._maxRetries) {
          item.retries++;
          console.warn(`[${this.name}] Retry "${item.label}" (${item.retries}/${this._maxRetries}): ${err.message}`);
          await new Promise(r => setTimeout(r, this._retryDelay * Math.pow(2, item.retries - 1)));
          items.unshift(item); // re-add at front of this lane
          this._totalItems++;
        } else {
          this._failed++;
          console.error(`[${this.name}] Failed "${item.label}" after ${this._maxRetries} retries: ${err.message}`);
          if (item.onFailure) try { item.onFailure(err); } catch (e) { /* ignore */ }
        }
      }
    }
  }

  /** Total items waiting across all lanes */
  get length() { return this._totalItems; }

  /** Number of lanes actively being processed */
  get active() { return this._activeLanes.size; }

  /** Full stats snapshot for monitoring */
  get stats() {
    return {
      queued: this._totalItems,
      active: this._activeLanes.size,
      lanes: this._lanes.size,
      processed: this._processed,
      failed: this._failed,
    };
  }
}

// ── Queue Singletons ──

// Drive queue: parallel session setups (each teacher's sheet is independent)
const driveQueue = new KeyedConcurrentQueue('DriveQueue', {
  concurrency: 5,     // 5 parallel sheet creations
  maxSize: 5000,      // backpressure at 5000 pending
  retries: 2,
  retryDelay: 1500,
});

// Attendance queue: parallel across sessions, sequential within same session
// (prevents race conditions writing to the same spreadsheet row)
const attendanceQueue = new KeyedConcurrentQueue('AttendanceQueue', {
  concurrency: 10,    // 10 different sessions write in parallel
  maxSize: 50000,     // handle burst of 50k pending writes
  retries: 2,
  retryDelay: 1000,
});

module.exports = { driveQueue, attendanceQueue };
