/**
 * In-Memory Cache with TTL
 * Eliminates repeated disk reads for hot data (sessions, teachers).
 * All store reads go through cache first; writes update cache + disk.
 */

class CacheService {
  constructor() {
    this._stores = new Map();   // storeName → { data, dirty, timer }
    this._ttl = 30_000;         // default 30s TTL for auto-refresh
    this._writeDebounce = 2_000; // batch disk writes every 2s
    this._pendingWrites = new Map();
  }

  /**
   * Get a full store from cache or load from disk
   */
  get(storeName, loader) {
    const cached = this._stores.get(storeName);
    if (cached && cached.data !== null) {
      return cached.data;
    }
    const data = loader();
    this._stores.set(storeName, { data, ts: Date.now() });
    return data;
  }

  /**
   * Update cache and schedule debounced disk write
   */
  set(storeName, data, writer) {
    this._stores.set(storeName, { data, ts: Date.now() });

    // Debounced write — batches rapid writes into one disk I/O
    if (this._pendingWrites.has(storeName)) {
      clearTimeout(this._pendingWrites.get(storeName));
    }
    this._pendingWrites.set(
      storeName,
      setTimeout(() => {
        writer(data);
        this._pendingWrites.delete(storeName);
      }, this._writeDebounce)
    );
  }

  /**
   * Force immediate flush to disk (for critical writes)
   */
  flush(storeName, writer) {
    const cached = this._stores.get(storeName);
    if (cached && cached.data !== null) {
      if (this._pendingWrites.has(storeName)) {
        clearTimeout(this._pendingWrites.get(storeName));
        this._pendingWrites.delete(storeName);
      }
      writer(cached.data);
    }
  }

  /**
   * Invalidate a specific store
   */
  invalidate(storeName) {
    this._stores.delete(storeName);
  }

  /**
   * Flush all pending writes (call on shutdown)
   */
  flushAll(writerMap) {
    for (const [storeName, timeout] of this._pendingWrites.entries()) {
      clearTimeout(timeout);
      const cached = this._stores.get(storeName);
      if (cached && cached.data !== null && writerMap[storeName]) {
        writerMap[storeName](cached.data);
      }
    }
    this._pendingWrites.clear();
  }
}

// Singleton
module.exports = new CacheService();
