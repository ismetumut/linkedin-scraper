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
  private readonly MAX_HISTORY = 1000

  getRandomUserAgent(): string {
    const now = Date.now()

    // Remove old usage history if too big (memory leak önlemi)
    if (this.usageHistory.size > this.MAX_HISTORY) {
      const sorted = Array.from(this.usageHistory.entries()).sort(([, a], [, b]) => a.lastUsed - b.lastUsed)
      sorted.slice(0, this.usageHistory.size - this.MAX_HISTORY).forEach(([ua]) => this.usageHistory.delete(ua))
    }

    // Filter cooldown user-agents
    const availableUserAgents = this.userAgents.filter((ua) => {
      const usage = this.usageHistory.get(ua)
      if (!usage) return true
      return now - usage.lastUsed > this.COOLDOWN_PERIOD
    })

    // LRU fallback pool
    const userAgentPool = availableUserAgents.length > 0 ? availableUserAgents : this.userAgents

    // Ağırlık: Çok az kullanılan çok daha yüksek, yeni UA favori
    const weights = userAgentPool.map((ua) => {
      const usage = this.usageHistory.get(ua)
      const usageCount = usage?.count || 0
      const lastUsed = usage?.lastUsed || 0
      // Az kullanılan ve uzun süredir seçilmeyen daha ağır
      return Math.max(1, 15 - usageCount) + Math.max(0, Math.floor((now - lastUsed) / (this.COOLDOWN_PERIOD / 2)))
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

    // Fallback: ilk UA
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

  // Havuza UA ekle/sil/güncelle
  addUserAgents(agents: string[]) {
    this.userAgents.push(...agents.filter(ua => !this.userAgents.includes(ua)))
  }
  removeUserAgent(ua: string) {
    this.userAgents = this.userAgents.filter(item => item !== ua)
    this.usageHistory.delete(ua)
  }
  setUserAgents(list: string[]) {
    this.userAgents = Array.from(new Set(list))
    this.usageHistory.clear()
  }

  getUserAgents(): string[] {
    return [...this.userAgents]
  }

  getUsageStats(): Array<{ userAgent: string; count: number; lastUsed: string }> {
    return this.userAgents.map((userAgent) => {
      const usage = this.usageHistory.get(userAgent) || { count: 0, lastUsed: 0 }
      return {
        userAgent,
        count: usage.count,
        lastUsed: usage.lastUsed ? new Date(usage.lastUsed).toISOString() : "-",
      }
    })
  }

  resetUsageHistory(): void {
    this.usageHistory.clear()
  }
}

export const userAgentManager = new UserAgentManager()
