interface CacheEntry {
  data: any
  timestamp: number
  ttl: number
  key: string
}

class RequestCache {
  private cache: Map<string, CacheEntry> = new Map()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes
  private readonly MAX_CACHE_SIZE = 1000

  set(key: string, data: any, ttl: number = this.DEFAULT_TTL): void {
    // Clean up if cache is too large
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.cleanup()
    }

    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl,
      key,
    }

    this.cache.set(key, entry)
  }

  get(key: string): any | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    // Check if entry is expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return false
    }

    return true
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  private cleanup(): void {
    const now = Date.now()
    const entries = Array.from(this.cache.entries())

    // Remove expired entries
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }

    // If still too large, remove oldest entries
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const sortedEntries = entries
        .filter(([key]) => this.cache.has(key))
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)

      const toRemove = sortedEntries.slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.2))
      for (const [key] of toRemove) {
        this.cache.delete(key)
      }
    }
  }

  getCacheStats(): { size: number; hitRate: number; memoryUsage: string } {
    const size = this.cache.size
    const memoryUsage = `${Math.round(JSON.stringify(Array.from(this.cache.values())).length / 1024)} KB`

    return {
      size,
      hitRate: 0, // Would need to track hits/misses for accurate calculation
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
