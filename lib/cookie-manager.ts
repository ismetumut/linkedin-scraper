interface CookieData {
  cookies: Record<string, string>
  timestamp: number
  email: string
  isValid: boolean
}

class CookieManager {
  private cookieStore: Map<string, CookieData> = new Map()
  private readonly COOKIE_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

  saveCookies(email: string, cookies: Record<string, string>): void {
    const cookieData: CookieData = {
      cookies,
      timestamp: Date.now(),
      email,
      isValid: true,
    }
    this.cookieStore.set(email, cookieData)
  }

  getCookies(email: string): Record<string, string> | null {
    const cookieData = this.cookieStore.get(email)
    if (!cookieData) return null

    // Check if cookies are expired
    if (Date.now() - cookieData.timestamp > this.COOKIE_EXPIRY) {
      this.cookieStore.delete(email)
      return null
    }

    return cookieData.isValid ? cookieData.cookies : null
  }

  invalidateCookies(email: string): void {
    const cookieData = this.cookieStore.get(email)
    if (cookieData) {
      cookieData.isValid = false
    }
  }

  refreshCookies(email: string, newCookies: Record<string, string>): void {
    this.saveCookies(email, newCookies)
  }

  cleanupExpiredCookies(): void {
    const now = Date.now()
    for (const [email, cookieData] of this.cookieStore.entries()) {
      if (now - cookieData.timestamp > this.COOKIE_EXPIRY) {
        this.cookieStore.delete(email)
      }
    }
  }

  getCookieStats(): { total: number; valid: number; expired: number } {
    const now = Date.now()
    let valid = 0
    let expired = 0

    for (const cookieData of this.cookieStore.values()) {
      if (now - cookieData.timestamp > this.COOKIE_EXPIRY) {
        expired++
      } else if (cookieData.isValid) {
        valid++
      }
    }

    return {
      total: this.cookieStore.size,
      valid,
      expired,
    }
  }
}

export const cookieManager = new CookieManager()
