/**
 * Cache module with TTL support
 * Frontend: localStorage with TTL
 * Backend: in-memory Map with TTL
 */

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  cachedAt: number;
}

export interface CacheOptions {
  ttlMs?: number; // Time to live in milliseconds
  keyPrefix?: string; // Prefix for cache keys
}

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 100; // Max entries per cache

/**
 * Frontend cache (localStorage-based)
 */
class FrontendCache {
  private prefix: string;
  private ttlMs: number;

  constructor(options: CacheOptions = {}) {
    this.prefix = options.keyPrefix || "bags_cache_";
    this.ttlMs = options.ttlMs || DEFAULT_TTL_MS;
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Get cached value (returns null if expired or not found)
   */
  get<T>(key: string): T | null {
    if (typeof window === "undefined") return null;

    try {
      const stored = localStorage.getItem(this.getKey(key));
      if (!stored) return null;

      const entry: CacheEntry<T> = JSON.parse(stored);
      const now = Date.now();

      // Check if expired
      if (now > entry.expiresAt) {
        this.delete(key);
        return null;
      }

      return entry.data;
    } catch {
      // Invalid JSON or localStorage error
      return null;
    }
  }

  /**
   * Set cached value with TTL
   */
  set<T>(key: string, data: T, customTtlMs?: number): void {
    if (typeof window === "undefined") return;

    try {
      const now = Date.now();
      const ttl = customTtlMs ?? this.ttlMs;
      const entry: CacheEntry<T> = {
        data,
        expiresAt: now + ttl,
        cachedAt: now,
      };

      // Cleanup old entries if cache is too large
      this.cleanup();

      localStorage.setItem(this.getKey(key), JSON.stringify(entry));
    } catch (err: any) {
      // localStorage quota exceeded or other error
      if (err?.name === "QuotaExceededError") {
        // Try to free space by removing oldest entries
        this.cleanup(true);
        try {
          localStorage.setItem(this.getKey(key), JSON.stringify({
            data,
            expiresAt: Date.now() + (customTtlMs ?? this.ttlMs),
            cachedAt: Date.now(),
          }));
        } catch {
          // Still failed, give up
        }
      }
    }
  }

  /**
   * Delete cached value
   */
  delete(key: string): void {
    if (typeof window === "undefined") return;
    try {
      localStorage.removeItem(this.getKey(key));
    } catch {
      // Ignore errors
    }
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Clear all cache entries with this prefix
   */
  clear(): void {
    if (typeof window === "undefined") return;
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keys.push(key);
        }
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {
      // Ignore errors
    }
  }

  /**
   * Cleanup expired entries and enforce size limit
   */
  private cleanup(force: boolean = false): void {
    if (typeof window === "undefined") return;

    try {
      const now = Date.now();
      const entries: Array<{ key: string; cachedAt: number }> = [];

      // Collect all cache entries
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith(this.prefix)) continue;

        try {
          const stored = localStorage.getItem(key);
          if (!stored) continue;

          const entry = JSON.parse(stored) as CacheEntry<unknown>;
          
          // Remove expired entries
          if (now > entry.expiresAt) {
            localStorage.removeItem(key);
            continue;
          }

          entries.push({
            key,
            cachedAt: entry.cachedAt,
          });
        } catch {
          // Invalid entry, remove it
          localStorage.removeItem(key);
        }
      }

      // If too many entries, remove oldest
      if (entries.length > MAX_CACHE_SIZE || force) {
        entries.sort((a, b) => a.cachedAt - b.cachedAt);
        const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
        toRemove.forEach((e) => localStorage.removeItem(e.key));
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Backend cache (in-memory Map-based)
 */
class BackendCache {
  private cache: Map<string, CacheEntry<unknown>>;
  private prefix: string;
  private ttlMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.prefix = options.keyPrefix || "bags_cache_";
    this.ttlMs = options.ttlMs || DEFAULT_TTL_MS;
    
    // Start cleanup interval (every 5 minutes)
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  /**
   * Get cached value (returns null if expired or not found)
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(this.getKey(key));
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(this.getKey(key));
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached value with TTL
   */
  set<T>(key: string, data: T, customTtlMs?: number): void {
    const now = Date.now();
    const ttl = customTtlMs ?? this.ttlMs;
    const entry: CacheEntry<T> = {
      data,
      expiresAt: now + ttl,
      cachedAt: now,
    };

    // Enforce size limit
    if (this.cache.size >= MAX_CACHE_SIZE) {
      this.cleanup(true);
    }

    this.cache.set(this.getKey(key), entry);
  }

  /**
   * Delete cached value
   */
  delete(key: string): void {
    this.cache.delete(this.getKey(key));
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(force: boolean = false): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        toDelete.push(key);
      }
    }

    toDelete.forEach((k) => this.cache.delete(k));

    // If still too large, remove oldest entries
    if (force && this.cache.size > MAX_CACHE_SIZE) {
      const entries = Array.from(this.cache.entries())
        .map(([key, entry]) => ({ key, cachedAt: entry.cachedAt }))
        .sort((a, b) => a.cachedAt - b.cachedAt);

      const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE);
      toRemove.forEach((e) => this.cache.delete(e.key));
    }
  }

  /**
   * Destroy cache and cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

// Singleton instances
let frontendCacheInstance: FrontendCache | null = null;
let backendCacheInstance: BackendCache | null = null;

/**
 * Get frontend cache instance (client-side only)
 */
export function getFrontendCache(options?: CacheOptions): FrontendCache {
  if (typeof window === "undefined") {
    throw new Error("Frontend cache only available in browser");
  }
  if (!frontendCacheInstance) {
    frontendCacheInstance = new FrontendCache(options);
  }
  return frontendCacheInstance;
}

/**
 * Get backend cache instance (server-side only)
 */
export function getBackendCache(options?: CacheOptions): BackendCache {
  if (typeof window !== "undefined") {
    throw new Error("Backend cache only available on server");
  }
  if (!backendCacheInstance) {
    backendCacheInstance = new BackendCache(options);
  }
  return backendCacheInstance;
}

/**
 * Cache key generators
 */
export const cacheKeys = {
  scanResult: (mint: string, chain: string = "mainnet") => `scan:${chain}:${mint}`,
  tokenMetadata: (mint: string, chain: string = "mainnet") => `token:${chain}:${mint}`,
  heliusDas: (id: string) => `helius:das:${id}`,
  jupiterQuote: (inputMint: string, outputMint: string, amount: string, slippage: string) => 
    `jupiter:quote:${inputMint}:${outputMint}:${amount}:${slippage}`,
};

/**
 * Stale-while-revalidate helper
 * Returns cached data immediately if available, then fetches fresh data
 */
export async function staleWhileRevalidate<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    cache: FrontendCache | BackendCache;
    ttlMs?: number;
    staleThresholdMs?: number; // Consider stale after this (default: 80% of TTL)
  }
): Promise<{ data: T; fromCache: boolean; stale: boolean }> {
  const ttl = options.ttlMs || DEFAULT_TTL_MS;
  const staleThreshold = options.staleThresholdMs ?? Math.floor(ttl * 0.8);

  // Try to get from cache
  const cached = options.cache.get<T>(key);
  const now = Date.now();

  if (cached) {
    // Check if stale (but still valid)
    const entry = options.cache.get<CacheEntry<T>>(key);
    const isStale = entry ? (now - entry.cachedAt) > staleThreshold : false;

    // Return cached data immediately
    const result = { data: cached, fromCache: true, stale: isStale };

    // If stale, fetch fresh data in background (fire and forget)
    if (isStale) {
      fetcher()
        .then((fresh) => {
          options.cache.set(key, fresh, ttl);
        })
        .catch(() => {
          // Ignore errors, keep using stale data
        });
    }

    return result;
  }

  // No cache, fetch fresh
  const fresh = await fetcher();
  options.cache.set(key, fresh, ttl);
  return { data: fresh, fromCache: false, stale: false };
}
