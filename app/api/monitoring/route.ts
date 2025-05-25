import { type NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { cookieManager } from "@/lib/cookie-manager"
import { requestCache } from "@/lib/request-cache"
import { userAgentManager } from "@/lib/user-agent-manager"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const action = searchParams.get("action")

  try {
    switch (action) {
      case "logs":
        return handleLogsRequest(searchParams)
      case "metrics":
        return handleMetricsRequest()
      case "cleanup":
        return handleCleanupRequest()
      default:
        return NextResponse.json({
          endpoints: {
            "GET /api/monitoring?action=logs": "Get application logs",
            "GET /api/monitoring?action=metrics": "Get system metrics",
            "GET /api/monitoring?action=cleanup": "Trigger cleanup operations",
          },
        })
    }
  } catch (error) {
    logger.error("Monitoring endpoint error", { error: error.message, action })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

async function handleLogsRequest(searchParams: URLSearchParams) {
  const level = searchParams.get("level")
  const sessionId = searchParams.get("sessionId")
  const userId = searchParams.get("userId")
  const since = searchParams.get("since")
  const limit = Number.parseInt(searchParams.get("limit") || "100")

  const filter: any = {}
  if (level) filter.level = level
  if (sessionId) filter.sessionId = sessionId
  if (userId) filter.userId = userId
  if (since) filter.since = since

  const logs = logger.getLogs(filter).slice(-limit)
  const stats = logger.getLogStats()

  return NextResponse.json({
    logs,
    stats,
    filter,
    count: logs.length,
  })
}

async function handleMetricsRequest() {
  const metrics = {
    timestamp: new Date().toISOString(),
    system: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
    },
    cookieManager: cookieManager.getCookieStats(),
    requestCache: requestCache.getCacheStats(),
    userAgentManager: userAgentManager.getUsageStats(),
    logger: logger.getLogStats(),
  }

  return NextResponse.json(metrics)
}

async function handleCleanupRequest() {
  logger.info("Manual cleanup triggered")

  // Perform cleanup operations
  cookieManager.cleanupExpiredCookies()

  // Clean up cache
  const cacheStatsBefore = requestCache.getCacheStats()
  // requestCache has internal cleanup, but we can trigger it by checking a non-existent key
  requestCache.has("cleanup-trigger")
  const cacheStatsAfter = requestCache.getCacheStats()

  const result = {
    timestamp: new Date().toISOString(),
    operations: {
      cookieCleanup: "completed",
      cacheCleanup: {
        before: cacheStatsBefore,
        after: cacheStatsAfter,
      },
    },
  }

  logger.info("Cleanup completed", result)

  return NextResponse.json(result)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { action } = body

  try {
    switch (action) {
      case "clearLogs":
        logger.clearLogs()
        return NextResponse.json({ message: "Logs cleared successfully" })

      case "clearCache":
        requestCache.clear()
        return NextResponse.json({ message: "Cache cleared successfully" })

      case "resetUserAgents":
        userAgentManager.resetUsageHistory()
        return NextResponse.json({ message: "User agent history reset" })

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
  } catch (error) {
    logger.error("Monitoring POST action failed", { error: error.message, action })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
