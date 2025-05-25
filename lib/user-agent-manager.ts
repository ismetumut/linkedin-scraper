class UserAgentManager {
  private userAgents: string[] = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0",
  ]

  private usageHistory: Map<string, { count: number; lastUsed: number }> = new Map()
  private readonly COOLDOWN_PERIOD = 30 * 60 * 1000 // 30 minutes

  getRandomUserAgent(): string {
    // Filter out recently used user agents
    const availableUserAgents = this.userAgents.filter((ua) => {
      const usage = this.usageHistory.get(ua)
      if (!usage) return true

      const timeSinceLastUse = Date.now() - usage.lastUsed
      return timeSinceLastUse > this.COOLDOWN_PERIOD
    })

    // If all user agents are in cooldown, use the least recently used
    const userAgentPool = availableUserAgents.length > 0 ? availableUserAgents : this.userAgents

    // Select user agent with weighted randomness (prefer less used ones)
    const weights = userAgentPool.map((ua) => {
      const usage = this.usageHistory.get(ua)
      const usageCount = usage?.count || 0
      return Math.max(1, 10 - usageCount) // Higher weight for less used user agents
    })

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
    let random = Math.random() * totalWeight

    for (let i = 0; i < userAgentPool.length; i++) {
      random -= weights[i]
      if (random <= 0) {
        const selectedUserAgent = userAgentPool[i]
        this.recordUsage(selectedUserAgent)
        return selectedUserAgent
      }
    }

    // Fallback to first user agent
    const fallback = userAgentPool[0]
    this.recordUsage(fallback)
    return fallback
  }

  private recordUsage(userAgent: string): void {
    const current = this.usageHistory.get(userAgent) || { count: 0, lastUsed: 0 }
    this.usageHistory.set(userAgent, {
      count: current.count + 1,
      lastUsed: Date.now(),
    })
  }

  getUsageStats(): Array<{ userAgent: string; count: number; lastUsed: string }> {
    return Array.from(this.usageHistory.entries()).map(([userAgent, usage]) => ({
      userAgent: userAgent.substring(0, 50) + "...",
      count: usage.count,
      lastUsed: new Date(usage.lastUsed).toISOString(),
    }))
  }

  resetUsageHistory(): void {
    this.usageHistory.clear()
  }
}

export const userAgentManager = new UserAgentManager()
