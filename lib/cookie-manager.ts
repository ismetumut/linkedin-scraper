interface CookieData {
  cookies: Record<string, string> | string // Tek string ya da key-value olarak desteklenir
  timestamp: number
  sessionId: string
  email?: string
  isValid: boolean
  domain?: string
  path?: string
}

class CookieManager {
  private cookieStore: Map<string, CookieData> = new Map()
  private readonly COOKIE_EXPIRY = 24 * 60 * 60 * 1000 // 24 saat

  constructor() {
    // Her 2 saatte bir expired cookie'leri temizle
    setInterval(() => this.cleanupExpiredCookies(), 2 * 60 * 60 * 1000)
  }

  saveCookies(sessionId: string, cookies: Record<string, string> | string, email?: string, domain?: string, path?: string): void {
    const cookieData: CookieData = {
      cookies,
      timestamp: Date.now(),
      sessionId,
      email,
      isValid: true,
      domain,
      path,
    }
    this.cookieStore.set(sessionId, cookieData)
  }

  getCookies(sessionId: string): Record<string, string> | string | null {
    const cookieData = this.cookieStore.get(sessionId)
    if (!cookieData) return null
    if (Date.now() - cookieData.timestamp > this.COOKIE_EXPIRY) {
      this.cookieStore.delete(sessionId)
      return null
    }
    return cookieData.isValid ? cookieData.cookies : null
  }

  invalidateCookies(sessionId: string): void {
    const cookieData = this.cookieStore.get(sessionId)
    if (cookieData) {
      cookieData.isValid = false
    }
  }

  refreshCookies(sessionId: string, newCookies: Record<string, string> | string): void {
    this.saveCookies(sessionId, newCookies)
  }

  cleanupExpiredCookies(): void {
    const now = Date.now()
    for (const [sessionId, cookieData] of this.cookieStore.entries()) {
      if (now - cookieData.timestamp > this.COOKIE_EXPIRY) {
        this.cookieStore.delete(sessionId)
      }
    }
  }

  getCookieStats() {
    const now = Date.now()
    let valid = 0, expired = 0
    for (const cookieData of this.cookieStore.values()) {
      if (now - cookieData.timestamp > this.COOKIE_EXPIRY) expired++
      else if (cookieData.isValid) valid++
    }
    return {
      total: this.cookieStore.size,
      valid,
      expired,
    }
  }

  clearAll() {
    this.cookieStore.clear()
  }

  getAllCookies(): CookieData[] {
    return Array.from(this.cookieStore.values())
  }
}

export const cookieManager = new CookieManager()
