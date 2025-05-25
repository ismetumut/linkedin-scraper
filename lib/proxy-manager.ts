interface ProxyConfig {
  host: string
  port: number
  username?: string
  password?: string
  type: "http" | "https" | "socks5"
  country?: string
  city?: string
  isResidential: boolean
}

interface ProxyStats {
  proxy: string
  successCount: number
  failureCount: number
  lastUsed: number
  averageResponseTime: number
  isBlacklisted: boolean
}

class ProxyManager {
  private proxies: ProxyConfig[] = []
  private proxyStats: Map<string, ProxyStats> = new Map()
  private currentProxyIndex = 0
  private readonly PROXY_COOLDOWN = 5 * 60 * 1000 // 5 minutes
  private readonly MAX_FAILURES = 3
  private readonly BLACKLIST_DURATION = 30 * 60 * 1000 // 30 minutes

  // Add residential proxies (you would get these from a proxy service)
  addResidentialProxies(proxies: ProxyConfig[]): void {
    this.proxies.push(...proxies.filter((p) => p.isResidential))
    console.log(`📡 Added ${proxies.length} residential proxies`)
  }

  // Add datacenter proxies as fallback
  addDatacenterProxies(proxies: ProxyConfig[]): void {
    this.proxies.push(...proxies.filter((p) => !p.isResidential))
    console.log(`🏢 Added ${proxies.length} datacenter proxies`)
  }

  // Get next available proxy with rotation
  getNextProxy(): ProxyConfig | null {
    if (this.proxies.length === 0) {
      console.warn("⚠️ No proxies available")
      return null
    }

    const availableProxies = this.getAvailableProxies()

    if (availableProxies.length === 0) {
      console.warn("⚠️ All proxies are in cooldown or blacklisted")
      return this.getLeastRecentlyUsedProxy()
    }

    // Prefer residential proxies
    const residentialProxies = availableProxies.filter((p) => p.isResidential)
    const proxyPool = residentialProxies.length > 0 ? residentialProxies : availableProxies

    // Round-robin with randomization
    const randomOffset = Math.floor(Math.random() * proxyPool.length)
    const selectedProxy = proxyPool[(this.currentProxyIndex + randomOffset) % proxyPool.length]

    this.currentProxyIndex = (this.currentProxyIndex + 1) % proxyPool.length

    this.recordProxyUsage(selectedProxy, "used")
    console.log(
      `🔄 Selected proxy: ${selectedProxy.host}:${selectedProxy.port} (${selectedProxy.country || "Unknown"})`,
    )

    return selectedProxy
  }

  private getAvailableProxies(): ProxyConfig[] {
    const now = Date.now()

    return this.proxies.filter((proxy) => {
      const proxyKey = `${proxy.host}:${proxy.port}`
      const stats = this.proxyStats.get(proxyKey)

      if (!stats) return true

      // Check if blacklisted
      if (stats.isBlacklisted && now - stats.lastUsed < this.BLACKLIST_DURATION) {
        return false
      }

      // Check cooldown
      if (now - stats.lastUsed < this.PROXY_COOLDOWN) {
        return false
      }

      return true
    })
  }

  private getLeastRecentlyUsedProxy(): ProxyConfig {
    let oldestProxy = this.proxies[0]
    let oldestTime = Date.now()

    for (const proxy of this.proxies) {
      const proxyKey = `${proxy.host}:${proxy.port}`
      const stats = this.proxyStats.get(proxyKey)

      if (!stats || stats.lastUsed < oldestTime) {
        oldestTime = stats?.lastUsed || 0
        oldestProxy = proxy
      }
    }

    return oldestProxy
  }

  recordProxyUsage(proxy: ProxyConfig, result: "used" | "success" | "failure", responseTime?: number): void {
    const proxyKey = `${proxy.host}:${proxy.port}`
    const stats = this.proxyStats.get(proxyKey) || {
      proxy: proxyKey,
      successCount: 0,
      failureCount: 0,
      lastUsed: 0,
      averageResponseTime: 0,
      isBlacklisted: false,
    }

    stats.lastUsed = Date.now()

    switch (result) {
      case "success":
        stats.successCount++
        if (responseTime) {
          stats.averageResponseTime = (stats.averageResponseTime + responseTime) / 2
        }
        stats.isBlacklisted = false
        break

      case "failure":
        stats.failureCount++
        if (stats.failureCount >= this.MAX_FAILURES) {
          stats.isBlacklisted = true
          console.warn(`🚫 Blacklisted proxy: ${proxyKey} (${stats.failureCount} failures)`)
        }
        break
    }

    this.proxyStats.set(proxyKey, stats)
  }

  getProxyForPlaywright(proxy: ProxyConfig) {
    return {
      server: `${proxy.type}://${proxy.host}:${proxy.port}`,
      username: proxy.username,
      password: proxy.password,
    }
  }

  getProxyStats(): ProxyStats[] {
    return Array.from(this.proxyStats.values())
  }

  resetBlacklist(): void {
    for (const stats of this.proxyStats.values()) {
      stats.isBlacklisted = false
      stats.failureCount = 0
    }
    console.log("✅ Proxy blacklist reset")
  }

  // Initialize with some example residential proxy endpoints
  initializeExampleProxies(): void {
    // These are example configurations - replace with real proxy service endpoints
    const exampleProxies: ProxyConfig[] = [
      {
        host: "residential-proxy-1.example.com",
        port: 8080,
        username: "user1",
        password: "pass1",
        type: "http",
        country: "US",
        city: "New York",
        isResidential: true,
      },
      {
        host: "residential-proxy-2.example.com",
        port: 8080,
        username: "user2",
        password: "pass2",
        type: "http",
        country: "US",
        city: "Los Angeles",
        isResidential: true,
      },
      {
        host: "residential-proxy-3.example.com",
        port: 8080,
        username: "user3",
        password: "pass3",
        type: "http",
        country: "CA",
        city: "Toronto",
        isResidential: true,
      },
    ]

    // Only add if no proxies are configured
    if (this.proxies.length === 0) {
      console.log("🔧 No proxies configured, running without proxy rotation")
      // this.addResidentialProxies(exampleProxies)
    }
  }
}

export const proxyManager = new ProxyManager()
