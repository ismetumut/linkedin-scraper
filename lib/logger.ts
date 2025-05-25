enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

interface LogEntry {
  timestamp: string
  level: keyof typeof LogLevel
  message: string
  metadata?: any
  sessionId?: string
  userId?: string
  requestId?: string
}

class StructuredLogger {
  private logLevel: LogLevel = LogLevel.INFO
  private logs: LogEntry[] = []
  private readonly MAX_LOGS = 10000

  setLogLevel(level: LogLevel): void {
    this.logLevel = level
  }

  error(message: string, metadata?: any, context?: { sessionId?: string; userId?: string; requestId?: string }): void {
    this.log(LogLevel.ERROR, message, metadata, context)
  }

  warn(message: string, metadata?: any, context?: { sessionId?: string; userId?: string; requestId?: string }): void {
    this.log(LogLevel.WARN, message, metadata, context)
  }

  info(message: string, metadata?: any, context?: { sessionId?: string; userId?: string; requestId?: string }): void {
    this.log(LogLevel.INFO, message, metadata, context)
  }

  debug(message: string, metadata?: any, context?: { sessionId?: string; userId?: string; requestId?: string }): void {
    this.log(LogLevel.DEBUG, message, metadata, context)
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: any,
    context?: { sessionId?: string; userId?: string; requestId?: string }
  ): void {
    if (level > this.logLevel) return

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level] as keyof typeof LogLevel,
      message,
      ...(metadata && { metadata }),
      ...(context || {}),
    }

    this.logs.push(entry)
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS)
    }

    // Use different console method based on log level
    switch (level) {
      case LogLevel.ERROR:
        console.error(JSON.stringify(entry, null, 2))
        break
      case LogLevel.WARN:
        console.warn(JSON.stringify(entry, null, 2))
        break
      case LogLevel.INFO:
      case LogLevel.DEBUG:
      default:
        console.log(JSON.stringify(entry, null, 2))
        break
    }
  }

  getLogs(filter?: { level?: keyof typeof LogLevel; sessionId?: string; userId?: string; since?: string }): LogEntry[] {
    let filteredLogs = this.logs

    if (filter) {
      if (filter.level) filteredLogs = filteredLogs.filter((log) => log.level === filter.level)
      if (filter.sessionId) filteredLogs = filteredLogs.filter((log) => log.sessionId === filter.sessionId)
      if (filter.userId) filteredLogs = filteredLogs.filter((log) => log.userId === filter.userId)
      if (filter.since) {
        const sinceDate = new Date(filter.since)
        filteredLogs = filteredLogs.filter((log) => new Date(log.timestamp) >= sinceDate)
      }
    }

    return filteredLogs
  }

  clearLogs(): void {
    this.logs = []
  }

  getLogStats(): { total: number; byLevel: Record<string, number> } {
    const byLevel: Record<string, number> = {}
    for (const log of this.logs) {
      byLevel[log.level] = (byLevel[log.level] || 0) + 1
    }
    return {
      total: this.logs.length,
      byLevel,
    }
  }
}

export const logger = new StructuredLogger()
