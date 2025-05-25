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

  async saveSession(email: string, page: any, fingerprint: any): Promise<void> {
    try {
      console.log(`💾 Saving session for ${email}...`)

      // Get cookies
      const cookies = await page.context().cookies()

      // Get localStorage data
      const localStorage = await page.evaluate(() => {
        const data: Record<string, string> = {}
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i)
          if (key) {
            data[key] = window.localStorage.getItem(key) || ""
          }
        }
        return data
      })

      // Get sessionStorage data
      const sessionStorage = await page.evaluate(() => {
        const data: Record<string, string> = {}
        for (let i = 0; i < window.sessionStorage.length; i++) {
          const key = window.sessionStorage.key(i)
          if (key) {
            data[key] = window.sessionStorage.getItem(key) || ""
          }
        }
        return data
      })

      // Get user agent
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

      // Also save cookies separately for compatibility
      cookieManager.saveCookies(email, cookies)

      console.log(`✅ Session saved for ${email}`)
    } catch (error) {
      console.error(`❌ Failed to save session for ${email}:`, error)
    }
  }

  async restoreSession(email: string, page: any): Promise<boolean> {
    try {
      const sessionData = this.sessions.get(email)
      if (!sessionData) {
        console.log(`📭 No session found for ${email}`)
        return false
      }

      // Check if session is expired
      if (Date.now() - sessionData.lastActivity > this.SESSION_EXPIRY) {
        console.log(`⏰ Session expired for ${email}`)
        this.sessions.delete(email)
        return false
      }

      if (!sessionData.isValid) {
        console.log(`❌ Invalid session for ${email}`)
        return false
      }

      console.log(`🔄 Restoring session for ${email}...`)

      // Restore cookies
      if (sessionData.cookies.length > 0) {
        await page.context().addCookies(sessionData.cookies)
      }

      // Restore localStorage
      if (Object.keys(sessionData.localStorage).length > 0) {
        await page.evaluate((data) => {
          for (const [key, value] of Object.entries(data)) {
            window.localStorage.setItem(key, value)
          }
        }, sessionData.localStorage)
      }

      // Restore sessionStorage
      if (Object.keys(sessionData.sessionStorage).length > 0) {
        await page.evaluate((data) => {
          for (const [key, value] of Object.entries(data)) {
            window.sessionStorage.setItem(key, value)
          }
        }, sessionData.sessionStorage)
      }

      // Update last activity
      sessionData.lastActivity = Date.now()
      this.sessions.set(email, sessionData)

      console.log(`✅ Session restored for ${email}`)
      return true
    } catch (error) {
      console.error(`❌ Failed to restore session for ${email}:`, error)
      return false
    }
  }

  invalidateSession(email: string): void {
    const sessionData = this.sessions.get(email)
    if (sessionData) {
      sessionData.isValid = false
      this.sessions.set(email, sessionData)
      console.log(`🚫 Session invalidated for ${email}`)
    }
  }

  deleteSession(email: string): void {
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

    return {
      total: this.sessions.size,
      valid,
      expired,
    }
  }

  // Verify session is still valid by checking LinkedIn
  async verifySession(email: string, page: any): Promise<boolean> {
    try {
      const restored = await this.restoreSession(email, page)
      if (!restored) return false

      // Navigate to LinkedIn to check if still logged in
      await page.goto("https://www.linkedin.com/feed", {
        waitUntil: "networkidle",
        timeout: 15000,
      })

      // Check if we're still logged in
      const isLoggedIn = await page.evaluate(() => {
        // Check for elements that indicate we're logged in
        return !!(
          document.querySelector("[data-test-global-nav-profile]") ||
          document.querySelector(".global-nav__me") ||
          document.querySelector(".feed-identity-module")
        )
      })

      if (!isLoggedIn) {
        console.log(`❌ Session verification failed for ${email}`)
        this.invalidateSession(email)
        return false
      }

      console.log(`✅ Session verified for ${email}`)
      return true
    } catch (error) {
      console.error(`❌ Session verification error for ${email}:`, error)
      this.invalidateSession(email)
      return false
    }
  }
}

export const sessionPersistence = new SessionPersistence()
