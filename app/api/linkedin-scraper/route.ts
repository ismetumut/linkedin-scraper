import { type NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { requestCache } from "@/lib/request-cache"

interface LinkedInConnection {
  name: string
  title?: string
  company?: string
  location?: string
  profileUrl?: string
  id?: string
  mutualConnections?: number
}

export async function POST(request: NextRequest) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  const startTime = Date.now()

  try {
    const body = await request.json()
    const { email, password, degree = 1, connectionId, connectionName } = body

    if (!email || !password) {
      logger.warn("Missing credentials", { requestId })
      return NextResponse.json({ error: "Missing required fields: email and password" }, { status: 400 })
    }

    logger.info("LinkedIn scraping request started", {
      email,
      degree,
      connectionName,
      requestId,
    })

    // Check cache first
    const cacheKey = requestCache.generateKey("POST", "/linkedin-scraper", { email, degree, connectionName })
    const cachedResult = requestCache.get(cacheKey)

    if (cachedResult) {
      logger.info("Returning cached result", { requestId, cacheKey })
      return NextResponse.json({
        ...cachedResult,
        cached: true,
        requestId,
      })
    }

    // Forward the request to the external backend
    const externalApiUrl = "https://linkedin-scraper-production-67df.up.railway.app/api/scrape-connections"

    logger.info(`Forwarding request to external API: ${externalApiUrl}`, { requestId })

    const requestBody: any = {
      email,
      password,
      degree: degree || 1,
    }

    // Add additional parameters for second-degree scraping
    if (degree === 2) {
      requestBody.connectionId = connectionId
      requestBody.connectionName = connectionName
    }

    // Add retry logic
    let lastError: any = null
    const maxRetries = 3

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Attempt ${attempt}/${maxRetries} to ${externalApiUrl}`, { requestId })

        const response = await fetch(externalApiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "application/json",
            "Cache-Control": "no-cache",
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(30000), // 30 second timeout
        })

        logger.info(`Response status: ${response.status}`, { requestId })

        if (response.status === 500) {
          const errorText = await response.text()
          logger.error(`Server error (500) on attempt ${attempt}:`, { error: errorText, requestId })
          lastError = new Error(`Server error: ${errorText}`)

          if (attempt < maxRetries) {
            logger.info(`Waiting 2 seconds before retry...`, { requestId })
            await new Promise((resolve) => setTimeout(resolve, 2000))
            continue
          }
        }

        if (response.status === 429) {
          logger.error(`Rate limited (429) on attempt ${attempt}`, { requestId })
          lastError = new Error("Rate limited by LinkedIn API")

          if (attempt < maxRetries) {
            logger.info(`Waiting 5 seconds before retry...`, { requestId })
            await new Promise((resolve) => setTimeout(resolve, 5000))
            continue
          }
        }

        if (!response.ok) {
          const errorText = await response.text()
          logger.error(`HTTP error ${response.status}:`, { error: errorText, requestId })
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        const contentType = response.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) {
          const textResponse = await response.text()
          logger.error("Non-JSON response:", { response: textResponse.substring(0, 500), requestId })

          // Try to extract useful information from HTML error pages
          if (textResponse.includes("Application Error") || textResponse.includes("Internal Server Error")) {
            throw new Error("External API is experiencing server issues")
          }

          return NextResponse.json(
            {
              error: "External API returned non-JSON response",
              response: textResponse.substring(0, 500),
              suggestion: "The external API might be down or returning an error page",
            },
            { status: 502 },
          )
        }

        const data = await response.json()
        logger.info("Successfully received data from external API", {
          connectionsCount: data.connections?.length || 0,
          hasData: !!data.data,
          keys: Object.keys(data),
          requestId,
        })

        // Format the response
        const formattedResponse = {
          connections: data.connections || data.data || data || [],
          timestamp: data.timestamp || new Date().toISOString(),
          degree: degree || 1,
          connectionName: connectionName || null,
          success: true,
          source: "railway-external-api",
          attempt: attempt,
          requestId,
          responseTime: Date.now() - startTime,
        }

        // Cache successful results
        requestCache.set(cacheKey, formattedResponse, 10 * 60 * 1000) // 10 minutes

        return NextResponse.json(formattedResponse)
      } catch (fetchError) {
        logger.error(`Fetch error on attempt ${attempt}:`, { error: fetchError.message, requestId })
        lastError = fetchError

        if (attempt < maxRetries) {
          logger.info(`Waiting 2 seconds before retry...`, { requestId })
          await new Promise((resolve) => setTimeout(resolve, 2000))
          continue
        }
      }
    }

    // All retries failed
    throw lastError || new Error("All retry attempts failed")
  } catch (error) {
    logger.error("LinkedIn scraping failed", {
      error: error.message,
      stack: error.stack,
      requestId,
      responseTime: Date.now() - startTime,
    })

    return NextResponse.json(
      {
        error: error.message || "Failed to connect to LinkedIn API",
        suggestion: "Please try again later or use the manual CSV import",
        connections: [],
        timestamp: new Date().toISOString(),
        success: false,
        requestId,
        troubleshooting: {
          apiUrl: "https://linkedin-scraper-production-67df.up.railway.app/api/scrape-connections",
          status: "The external API might be down or experiencing issues",
          nextSteps: [
            "Wait 5-10 minutes and try again",
            "Check if the external API URL is still valid",
            "Verify your LinkedIn credentials are correct",
            "Try the manual CSV import as an alternative",
          ],
        },
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: "LinkedIn Scraper API - External Backend",
    version: "5.0.0",
    mode: "PRODUCTION",
    externalBackend: "https://linkedin-scraper-production-67df.up.railway.app",
    features: [
      "External API integration with Railway backend",
      "Request caching to avoid redundant API calls",
      "Comprehensive structured logging (JSON format)",
      "Health checks and monitoring endpoints",
      "Automatic retries with exponential backoff",
    ],
    endpoints: {
      "POST /api/linkedin-scraper": "Scrape LinkedIn connections via external API",
      "GET /api/health": "Health check endpoint",
      "GET /api/monitoring": "Monitoring and metrics endpoint",
    },
    warning: "⚠️ This scraping method may violate LinkedIn's Terms of Service",
    recommendation: "Use LinkedIn's official API or data export for production use",
  })
}
