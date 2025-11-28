/**
 * Response Cache for Local LLM
 * Caches LLM responses to avoid redundant queries
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class LocalLLMCache {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.maxSize = options.maxSize || 1000;
    this.ttlMs = options.ttlMs || 30 * 60 * 1000; // 30 minutes default
    this.persistPath = options.persistPath || null;

    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;

    if (this.persistPath) {
      this._loadFromDisk();
    }
  }

  /**
   * Generate cache key from prompt and options
   * @param {string} prompt - The prompt
   * @param {Object} options - Generation options
   * @returns {string}
   */
  _generateKey(prompt, options = {}) {
    const content = JSON.stringify({ prompt, options });
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Get cached response if available
   * @param {string} prompt - The prompt
   * @param {Object} options - Generation options
   * @returns {string|null}
   */
  get(prompt, options = {}) {
    if (!this.enabled) return null;

    const key = this._generateKey(prompt, options);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return entry.value;
  }

  /**
   * Store response in cache
   * @param {string} prompt - The prompt
   * @param {Object} options - Generation options
   * @param {string} value - The response to cache
   */
  set(prompt, options, value) {
    if (!this.enabled) return;

    const key = this._generateKey(prompt, options);

    // Enforce max size with LRU eviction
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });

    if (this.persistPath) {
      this._saveToDisk();
    }
  }

  /**
   * Clear all cached entries
   */
  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;

    if (this.persistPath && fs.existsSync(this.persistPath)) {
      fs.unlinkSync(this.persistPath);
    }
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? (this.hits / total * 100).toFixed(1) + '%' : '0%'
    };
  }

  /**
   * Prune expired entries
   */
  prune() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Load cache from disk
   * @private
   */
  _loadFromDisk() {
    try {
      if (fs.existsSync(this.persistPath)) {
        const data = JSON.parse(fs.readFileSync(this.persistPath, 'utf-8'));
        const now = Date.now();

        for (const [key, entry] of Object.entries(data.entries || {})) {
          // Only load non-expired entries
          if (now - entry.timestamp <= this.ttlMs) {
            this.cache.set(key, entry);
          }
        }
      }
    } catch (error) {
      // Silently fail - cache is optional
      this.cache.clear();
    }
  }

  /**
   * Save cache to disk
   * @private
   */
  _saveToDisk() {
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const data = {
        version: 1,
        savedAt: Date.now(),
        entries: Object.fromEntries(this.cache)
      };

      fs.writeFileSync(this.persistPath, JSON.stringify(data, null, 2));
    } catch (error) {
      // Silently fail - persistence is optional
    }
  }
}

module.exports = LocalLLMCache;
