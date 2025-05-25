import { type NextRequest, NextResponse } from "next/server"
import { requestCache } from "@/lib/request-cache"
import { logger } from "@/lib/logger"

export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // Perform health checks
    const healthChecks = await Promise.allSettled([checkExternalApi(), checkRequestCache(), checkMemoryUsage()])

    const results = healthChecks.map((result, index) => {
      const checkNames = ["externalApi", "requestCache", "memoryUsage"]
      return {
        check: checkNames[index],
        status: result.status === "fulfilled" ? "healthy" : "unhealthy",
        details: result.status === "fulfilled" ? result.value : result.reason?.message,
      }
    })

    const overallStatus = results.every((r) => r.status === "healthy") ? "healthy" : "unhealthy"
    const responseTime = Date.now() - startTime

    const healthReport = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      version: "5.0.0",
      externalBackend: "https://linkedin-scraper-production-67df.up.railway.app",
      checks: results,
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        platform: process.platform,
        nodeVersion: process.version,
      },
    }

    logger.info("Health check completed", {
      status: overallStatus,
      responseTime,
      checks: results.length,
    })

    return NextResponse.json(healthReport, {
      status: overallStatus === "healthy" ? 200 : 503,
    })
  } catch (error) {
    logger.error("Health check failed", { error: error.message })

    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error.message,
      },
      { status: 503 },
    )
  }
}

async function checkExternalApi() {
  try {
    const response = await fetch("https://linkedin-scraper-production-67df.up.railway.app/health", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })

    if (!response.ok) {
      throw new Error(`External API health check failed with status: ${response.status}`)
    }

    const data = await response.json()
    return {
      status: "connected",
      url: "https://linkedin-scraper-production-67df.up.railway.app",
      response: data,
    }
  } catch (error) {
    throw new Error(`External API health check failed: ${error.message}`)
  }
}

async function checkRequestCache() {
  const stats = requestCache.getCacheStats()

  return {
    cacheSize: stats.size,
    memoryUsage: stats.memoryUsage,
    hitRate: stats.hitRate,
  }
}

async function checkMemoryUsage() {
  const memUsage = process.memoryUsage()
  const memUsageMB = {
    rss: Math.round(memUsage.rss / 1024 / 1024),
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    external: Math.round(memUsage.external / 1024 / 1024),
  }

  // Alert if memory usage is too high
  if (memUsageMB.heapUsed > 512) {
    throw new Error(`High memory usage: ${memUsageMB.heapUsed}MB`)
  }

  return memUsageMB
}
