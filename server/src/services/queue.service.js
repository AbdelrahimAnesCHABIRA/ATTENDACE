/**
 * Write Queue Service
 * Queues Google Drive/Sheets writes so they don't block request handlers.
 * Processes writes sequentially with retry logic.
 */

class WriteQueue {
  constructor() {
    this._queue = [];
    this._processing = false;
    this._maxRetries = 2;
    this._retryDelay = 1000;
  }

  /**
   * Add a write task to the queue
   * @param {Function} task - async function to execute
   * @param {string} label - description for logging
   */
  enqueue(task, label = 'queue-task') {
    this._queue.push({ task, label, retries: 0 });
    this._process();
  }

  /**
   * Process queue items sequentially
   */
  async _process() {
    if (this._processing) return;
    this._processing = true;

    while (this._queue.length > 0) {
      const item = this._queue.shift();
      try {
        await item.task();
      } catch (err) {
        if (item.retries < this._maxRetries) {
          item.retries++;
          console.warn(`[Queue] Retrying "${item.label}" (${item.retries}/${this._maxRetries}):`, err.message);
          // Re-add to front with a small delay
          this._queue.unshift(item);
          await new Promise(r => setTimeout(r, this._retryDelay * item.retries));
        } else {
          console.error(`[Queue] Failed "${item.label}" after ${this._maxRetries} retries:`, err.message);
        }
      }
    }

    this._processing = false;
  }

  /**
   * Get queue depth
   */
  get length() {
    return this._queue.length;
  }
}

// Singletons: one for Drive operations, one for attendance writes
module.exports = {
  driveQueue: new WriteQueue(),
  attendanceQueue: new WriteQueue(),
};
