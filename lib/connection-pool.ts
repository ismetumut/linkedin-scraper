interface PooledConnection {
  id: string
  lastUsed: number
  inUse: boolean
  requestCount: number
  headers: Record<string, string>
}

class ConnectionPool {
  private connections: Map<string, PooledConnection> = new Map()
  private readonly MAX_CONNECTIONS = 10
  private readonly CONNECTION_TIMEOUT = 5 * 60 * 1000 // 5 minutes
  private readonly MAX_REQUESTS_PER_CONNECTION = 100

  async getConnection(sessionId: string): Promise<PooledConnection> {
    // Clean up expired connections
    this.cleanupExpiredConnections()

    let connection = this.connections.get(sessionId)

    if (!connection || this.isConnectionExpired(connection)) {
      connection = this.createConnection(sessionId)
      this.connections.set(sessionId, connection)
    }

    connection.inUse = true
    connection.lastUsed = Date.now()
    connection.requestCount++

    return connection
  }

  releaseConnection(sessionId: string): void {
    const connection = this.connections.get(sessionId)
    if (connection) {
      connection.inUse = false
      connection.lastUsed = Date.now()

      // Remove connection if it has exceeded max requests
      if (connection.requestCount >= this.MAX_REQUESTS_PER_CONNECTION) {
        this.connections.delete(sessionId)
      }
    }
  }

  private createConnection(sessionId: string): PooledConnection {
    return {
      id: sessionId,
      lastUsed: Date.now(),
      inUse: false,
      requestCount: 0,
      headers: {
        "User-Agent": this.getRandomUserAgent(),
        Accept: "application/vnd.linkedin.normalized+json+2.1",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        DNT: "1",
        Connection: "keep-alive",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
      },
    }
  }

  private isConnectionExpired(connection: PooledConnection): boolean {
    return Date.now() - connection.lastUsed > this.CONNECTION_TIMEOUT
  }

  private cleanupExpiredConnections(): void {
    const now = Date.now()
    for (const [sessionId, connection] of this.connections.entries()) {
      if (now - connection.lastUsed > this.CONNECTION_TIMEOUT && !connection.inUse) {
        this.connections.delete(sessionId)
      }
    }
  }

  private getRandomUserAgent(): string {
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
    ]
    return userAgents[Math.floor(Math.random() * userAgents.length)]
  }

  getPoolStats(): { total: number; inUse: number; available: number } {
    let inUse = 0
    for (const connection of this.connections.values()) {
      if (connection.inUse) inUse++
    }

    return {
      total: this.connections.size,
      inUse,
      available: this.connections.size - inUse,
    }
  }
}

export const connectionPool = new ConnectionPool()
