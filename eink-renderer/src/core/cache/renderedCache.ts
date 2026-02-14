interface CacheEntry {
  html: string;
  cachedAt: Date;
  ttl: number;
  templateName: string;
  entitiesFetched: number;
  lastAccessed: Date;
}

const cache = new Map<string, CacheEntry>();
let maxSize = 50;

/**
 * Set cache entry with TTL
 * @param key Cache key
 * @param html Rendered HTML
 * @param ttl Time-to-live in seconds
 * @param metadata Additional metadata
 */
export function set(
  key: string,
  html: string,
  ttl: number,
  metadata: { templateName: string; entitiesFetched: number }
): void {
  // Evict if cache is full (LRU)
  if (cache.size >= maxSize && !cache.has(key)) {
    evictLRU();
  }

  const now = new Date();
  cache.set(key, {
    html,
    cachedAt: now,
    ttl,
    templateName: metadata.templateName,
    entitiesFetched: metadata.entitiesFetched,
    lastAccessed: now,
  });
}

/**
 * Get cache entry (returns null if expired or not found)
 * @param key Cache key
 * @returns Cached HTML or null
 */
export function get(key: string): string | null {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  // Check if expired
  const ageInSeconds = (Date.now() - entry.cachedAt.getTime()) / 1000;
  if (ageInSeconds > entry.ttl) {
    cache.delete(key);
    return null;
  }

  // Update last accessed time for LRU
  entry.lastAccessed = new Date();

  return entry.html;
}

/**
 * Check if key exists and is not expired
 * @param key Cache key
 * @returns True if key exists and not expired
 */
export function has(key: string): boolean {
  return get(key) !== null;
}

/**
 * Clear all cache entries
 */
export function clear(): void {
  cache.clear();
}

/**
 * Get cache statistics
 */
export function getStats(): {
  size: number;
  maxSize: number;
  entries: Array<{ key: string; templateName: string; age: number; size: number }>;
} {
  const entries = Array.from(cache.entries()).map(([key, entry]) => ({
    key,
    templateName: entry.templateName,
    age: Math.floor((Date.now() - entry.cachedAt.getTime()) / 1000),
    size: entry.html.length,
  }));

  return {
    size: cache.size,
    maxSize,
    entries,
  };
}

/**
 * Set maximum cache size
 * @param size Maximum number of entries
 */
export function setMaxSize(size: number): void {
  maxSize = size;

  // Evict entries if current size exceeds new max
  while (cache.size > maxSize) {
    evictLRU();
  }
}

/**
 * Evict least recently used entry
 */
function evictLRU(): void {
  let lruKey: string | null = null;
  let lruTime = new Date();

  for (const [key, entry] of cache.entries()) {
    if (entry.lastAccessed < lruTime) {
      lruTime = entry.lastAccessed;
      lruKey = key;
    }
  }

  if (lruKey) {
    cache.delete(lruKey);
  }
}

/**
 * Get all cache keys
 */
export function keys(): string[] {
  return Array.from(cache.keys());
}
