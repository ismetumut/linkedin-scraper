import { type Browser, type Page, chromium } from "playwright"

interface BrowserSession {
  browser: Browser
  page: Page
  cookies: any[]
  lastActivity: number
  isAuthenticated: boolean
  userAgent: string
}

class BrowserManager {
  private sessions: Map<string, BrowserSession> = new Map()
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes
  private readonly MAX_SESSIONS = 5

  async createSession(sessionId: string): Promise<BrowserSession> {
    // Clean up old sessions
    await this.cleanupExpiredSessions()

    if (this.sessions.size >= this.MAX_SESSIONS) {
      throw new Error("Maximum browser sessions reached")
    }

    const userAgent = this.getRandomUserAgent()

    const browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
      ],
    })

    const context = await browser.newContext({
      userAgent,
      viewport: { width: 1366, height: 768 },
      locale: "en-US",
      timezoneId: "America/New_York",
      permissions: [],
      extraHTTPHeaders: {
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        DNT: "1",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    })

    const page = await context.newPage()

    // Set up request interception for better performance
    await page.route("**/*", (route) => {
      const resourceType = route.request().resourceType()
      if (["image", "stylesheet", "font", "media"].includes(resourceType)) {
        route.abort()
      } else {
        route.continue()
      }
    })

    const session: BrowserSession = {
      browser,
      page,
      cookies: [],
      lastActivity: Date.now(),
      isAuthenticated: false,
      userAgent,
    }

    this.sessions.set(sessionId, session)
    return session
  }

  async getSession(sessionId: string): Promise<BrowserSession | null> {
    const session = this.sessions.get(sessionId)
    if (!session) return null

    // Check if session is expired
    if (Date.now() - session.lastActivity > this.SESSION_TIMEOUT) {
      await this.closeSession(sessionId)
      return null
    }

    session.lastActivity = Date.now()
    return session
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session) {
      try {
        await session.browser.close()
      } catch (error) {
        console.error(`Error closing browser session ${sessionId}:`, error)
      }
      this.sessions.delete(sessionId)
    }
  }

  async closeAllSessions(): Promise<void> {
    const promises = Array.from(this.sessions.keys()).map((id) => this.closeSession(id))
    await Promise.all(promises)
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now()
    const expiredSessions = Array.from(this.sessions.entries())
      .filter(([_, session]) => now - session.lastActivity > this.SESSION_TIMEOUT)
      .map(([id, _]) => id)

    for (const sessionId of expiredSessions) {
      await this.closeSession(sessionId)
    }
  }

  private getRandomUserAgent(): string {
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    ]
    return userAgents[Math.floor(Math.random() * userAgents.length)]
  }

  getSessionCount(): number {
    return this.sessions.size
  }

  getSessionInfo(): Array<{ id: string; lastActivity: number; isAuthenticated: boolean }> {
    return Array.from(this.sessions.entries()).map(([id, session]) => ({
      id,
      lastActivity: session.lastActivity,
      isAuthenticated: session.isAuthenticated,
    }))
  }
}

export const browserManager = new BrowserManager()
