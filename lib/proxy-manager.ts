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
  blacklistedAt?: number
}

class ProxyManager {
  private proxies: ProxyConfig[] = []
  private proxyStats: Map<string, ProxyStats> = new Map()
  private currentProxyIndex = 0
  private readonly PROXY_COOLDOWN = 5 * 60 * 1000 // 5 minutes
  private readonly MAX_FAILURES = 3
  private readonly BLACKLIST_DURATION = 30 * 60 * 1000 // 30 minutes

  addResidentialProxies(proxies: ProxyConfig[]): void {
    this.proxies.push(...proxies.filter((p) => p.isResidential))
    console.log(`📡 Added ${proxies.length} residential proxies`)
  }

  addDatacenterProxies(proxies: ProxyConfig[]): void {
    this.proxies.push(...proxies.filter((p) => !p.isResidential))
    console.log(`🏢 Added ${proxies.length} datacenter proxies`)
  }

  getNextProxy(preferredCountry?: string): ProxyConfig | null {
    if (this.proxies.length === 0) {
      console.warn("⚠️ No proxies available")
      return null
    }

    // Blacklist süresi dolmuş proxy'leri whitelist'e geri al
    this.cleanupBlacklist()

    let availableProxies = this.getAvailableProxies()
    // Country veya city bazlı öncelik
    if (preferredCountry) {
      const countryProxies = availableProxies.filter(p => p.country === preferredCountry)
      if (countryProxies.length > 0) availableProxies = countryProxies
    }

    if (availableProxies.length === 0) {
      console.warn("⚠️ All proxies are in cooldown or blacklisted")
      return this.getLeastRecentlyUsedProxy()
    }

    // Önce residential, sonra kalanlar
    const residentialProxies = availableProxies.filter(p => p.isResidential)
    const proxyPool = residentialProxies.length > 0 ? residentialProxies : availableProxies

    // Round robin + random
    const randomOffset = Math.floor(Math.random() * proxyPool.length)
    const selectedProxy = proxyPool[(this.currentProxyIndex + randomOffset) % proxyPool.length]
    this.currentProxyIndex = (this.currentProxyIndex + 1) % proxyPool.length

    this.recordProxyUsage(selectedProxy, "used")
    console.log(`🔄 Selected proxy: ${selectedProxy.host}:${selectedProxy.port} (${selectedProxy.country || "Unknown"})`)

    return selectedProxy
  }

  private getAvailableProxies(): ProxyConfig[] {
    const now = Date.now()
    return this.proxies.filter(proxy => {
      const proxyKey = `${proxy.host}:${proxy.port}`
      const stats = this.proxyStats.get(proxyKey)
      if (!stats) return true
      // Blacklist kontrolü
      if (stats.isBlacklisted && stats.blacklistedAt && (now - stats.blacklistedAt < this.BLACKLIST_DURATION)) {
        return false
      }
      // Cooldown
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
      blacklistedAt: undefined,
    }

    stats.lastUsed = Date.now()
    switch (result) {
      case "success":
        stats.successCount++
        if (responseTime) {
          stats.averageResponseTime = stats.averageResponseTime === 0 ? responseTime : (stats.averageResponseTime + responseTime) / 2
        }
        stats.isBlacklisted = false
        stats.failureCount = 0
        stats.blacklistedAt = undefined
        break
      case "failure":
        stats.failureCount++
        if (stats.failureCount >= this.MAX_FAILURES) {
          stats.isBlacklisted = true
          stats.blacklistedAt = Date.now()
          console.warn(`🚫 Blacklisted proxy: ${proxyKey} (${stats.failureCount} failures)`)
        }
        break
      case "used":
      default:
        // nothing
        break
    }

    this.proxyStats.set(proxyKey, stats)
  }

  private cleanupBlacklist() {
    const now = Date.now()
    for (const stats of this.proxyStats.values()) {
      if (stats.isBlacklisted && stats.blacklistedAt && (now - stats.blacklistedAt >= this.BLACKLIST_DURATION)) {
        stats.isBlacklisted = false
        stats.failureCount = 0
        stats.blacklistedAt = undefined
        console.log(`✅ Proxy removed from blacklist: ${stats.proxy}`)
      }
    }
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
      stats.blacklistedAt = undefined
    }
    console.log("✅ Proxy blacklist reset")
  }

  initializeExampleProxies(): void {
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
    if (this.proxies.length === 0) {
      // this.addResidentialProxies(exampleProxies)
      console.log("🔧 No proxies configured, running without proxy rotation")
    }
  }
}

export const proxyManager = new ProxyManager()
