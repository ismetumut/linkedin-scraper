import { cookieManager } from "./cookie-manager"

interface SessionData {
  cookies: any[]
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
  userAgent: string
  fingerprint: any
  lastActivity: number
  isValid: boolean
}

class SessionPersistence {
  private sessions: Map<string, SessionData> = new Map()
  private readonly SESSION_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

  // Her email işlemi küçük harfe
  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
  }

  private updateSession(email: string, patch: Partial<SessionData>) {
    email = this.normalizeEmail(email)
    const existing = this.sessions.get(email)
    if (!existing) return
    this.sessions.set(email, { ...existing, ...patch })
  }

  async saveSession(email: string, page: any, fingerprint: any): Promise<void> {
    email = this.normalizeEmail(email)
    try {
      console.log(`💾 Saving session for ${email}...`)
      const cookies = await page.context().cookies()
      const localStorage = await page.evaluate(() => {
        const data: Record<string, string> = {}
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i)
          if (key) data[key] = window.localStorage.getItem(key) || ""
        }
        return data
      })
      const sessionStorage = await page.evaluate(() => {
        const data: Record<string, string> = {}
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i)
          if (key) data[key] = window.sessionStorage.getItem(key) || ""
        }
        return data
      })
      const userAgent = await page.evaluate(() => navigator.userAgent)
      const sessionData: SessionData = {
        cookies,
        localStorage,
        sessionStorage,
        userAgent,
        fingerprint,
        lastActivity: Date.now(),
        isValid: true,
      }
      this.sessions.set(email, sessionData)
      cookieManager.saveCookies(email, cookies)
      console.log(`✅ Session saved for ${email}`)
    } catch (error) {
      console.error(`❌ Failed to save session for ${email}:`, error)
    }
  }

  async restoreSession(email: string, page: any): Promise<boolean> {
    email = this.normalizeEmail(email)
    try {
      const sessionData = this.sessions.get(email)
      if (!sessionData) {
        console.log(`📭 No session found for ${email}`)
        return false
      }
      // Expiry check
      if (Date.now() - sessionData.lastActivity > this.SESSION_EXPIRY) {
        console.log(`⏰ Session expired for ${email}`)
        this.deleteSession(email)
        return false
      }
      if (!sessionData.isValid) {
        console.log(`❌ Invalid session for ${email}`)
        return false
      }
      console.log(`🔄 Restoring session for ${email}...`)
      if (sessionData.cookies.length > 0) await page.context().addCookies(sessionData.cookies)
      if (Object.keys(sessionData.localStorage).length > 0) {
        await page.evaluate((data) => {
          for (const [key, value] of Object.entries(data)) {
            window.localStorage.setItem(key, value)
          }
        }, sessionData.localStorage)
      }
      if (Object.keys(sessionData.sessionStorage).length > 0) {
        await page.evaluate((data) => {
          for (const [key, value] of Object.entries(data)) {
            window.sessionStorage.setItem(key, value)
          }
        }, sessionData.sessionStorage)
      }
      this.updateSession(email, { lastActivity: Date.now() })
      console.log(`✅ Session restored for ${email}`)
      return true
    } catch (error) {
      this.invalidateSession(email)
      console.error(`❌ Failed to restore session for ${email}:`, error)
      return false
    }
  }

  invalidateSession(email: string): void {
    email = this.normalizeEmail(email)
    this.updateSession(email, { isValid: false })
    console.log(`🚫 Session invalidated for ${email}`)
  }

  deleteSession(email: string): void {
    email = this.normalizeEmail(email)
    this.sessions.delete(email)
    cookieManager.invalidateCookies(email)
    console.log(`🗑️ Session deleted for ${email}`)
  }

  cleanupExpiredSessions(): void {
    const now = Date.now()
    let cleanedCount = 0
    for (const [email, sessionData] of this.sessions.entries()) {
      if (now - sessionData.lastActivity > this.SESSION_EXPIRY) {
        this.sessions.delete(email)
        cleanedCount++
      }
    }
    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`)
    }
  }

  getSessionInfo(email: string): Partial<SessionData> | null {
    email = this.normalizeEmail(email)
    const sessionData = this.sessions.get(email)
    if (!sessionData) return null
    return {
      userAgent: sessionData.userAgent,
      lastActivity: sessionData.lastActivity,
      isValid: sessionData.isValid,
    }
  }

  getAllSessions(): Array<{ email: string; lastActivity: number; isValid: boolean }> {
    return Array.from(this.sessions.entries()).map(([email, data]) => ({
      email,
      lastActivity: data.lastActivity,
      isValid: data.isValid,
    }))
  }

  getSessionStats(): { total: number; valid: number; expired: number } {
    const now = Date.now()
    let valid = 0
    let expired = 0
    for (const sessionData of this.sessions.values()) {
      if (now - sessionData.lastActivity > this.SESSION_EXPIRY) {
        expired++
      } else if (sessionData.isValid) {
        valid++
      }
    }
    return { total: this.sessions.size, valid, expired }
  }

  async verifySession(email: string, page: any): Promise<boolean> {
    email = this.normalizeEmail(email)
    try {
      const restored = await this.restoreSession(email, page)
      if (!restored) return false
      await page.goto("https://www.linkedin.com/feed", {
        waitUntil: "networkidle",
        timeout: 15000,
      })
      const isLoggedIn = await page.evaluate(() => {
        return !!(
          document.querySelector("[data-test-global-nav-profile]") ||
          document.querySelector(".global-nav__me") ||
          document.querySelector(".feed-identity-module")
        )
      })
      if (!isLoggedIn) {
        this.invalidateSession(email)
        console.log(`❌ Session verification failed for ${email}`)
        return false
      }
      console.log(`✅ Session verified for ${email}`)
      return true
    } catch (error) {
      this.invalidateSession(email)
      console.error(`❌ Session verification error for ${email}:`, error)
      return false
    }
  }
}

export const sessionPersistence = new SessionPersistence()
