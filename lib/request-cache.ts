interface CacheEntry {
  data: any
  timestamp: number
  ttl: number
  key: string
  lastAccessed: number
}

class RequestCache {
  private cache: Map<string, CacheEntry> = new Map()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000

  private hits = 0
  private misses = 0

  set(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.cleanup()
    }
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl,
      key,
      lastAccessed: Date.now(),
    }
    this.cache.set(key, entry)
  }

  get(key: string): any | null {
    const entry = this.cache.get(key)
    if (!entry) {
      this.misses++
      return null
    }
    // Check expiry
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.misses++
      return null
    }
    entry.lastAccessed = Date.now()
    this.hits++
    return entry.data
  }

  async getOrFetch(
    key: string,
    fetcher: () => Promise<any>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<any> {
    const cached = this.get(key)
    if (cached !== null) return cached
    const data = await fetcher()
    this.set(key, data, ttl)
    return data
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return false
    }
    entry.lastAccessed = Date.now()
    return true
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
    this.hits = 0
    this.misses = 0
  }

  private cleanup(): void {
    const now = Date.now()
    // 1. Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
    // 2. Remove oldest (LRU) if still too large
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const sorted = Array.from(this.cache.entries()).sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed)
      const removeCount = Math.floor(this.MAX_CACHE_SIZE * 0.2)
      for (let i = 0; i < removeCount; i++) {
        this.cache.delete(sorted[i][0])
      }
    }
  }

  getCacheStats(): { size: number; hitRate: number; memoryUsage: string } {
    const size = this.cache.size
    const hitRate = this.hits + this.misses === 0 ? 0 : Number((this.hits / (this.hits + this.misses)).toFixed(2))
    const memoryUsage = `${Math.round(JSON.stringify(Array.from(this.cache.values())).length / 1024)} KB`
    return {
      size,
      hitRate,
      memoryUsage,
    }
  }

  generateKey(method: string, url: string, params?: any): string {
    const baseKey = `${method}:${url}`
    if (params) {
      const sortedParams = Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join("&")
      return `${baseKey}?${sortedParams}`
    }
    return baseKey
  }
}

export const requestCache = new RequestCache()
