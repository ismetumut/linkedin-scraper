import { type NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, targetUrl, degree, connectionId, connectionName } = body

    // Validate input
    if (!email || !password) {
      return NextResponse.json({ error: "Missing required fields: email or password" }, { status: 400 })
    }

    // Use the Railway backend URL
    const apiUrl = targetUrl || "https://linkedin-scraper-production-67df.up.railway.app/api/scrape-connections"

    logger.info(`Attempting to connect to: ${apiUrl} for degree ${degree || 1}`)

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

    logger.info("Request body:", { ...requestBody, password: "[HIDDEN]" })

    // Add retry logic
    let lastError: any = null
    const maxRetries = 3

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`Attempt ${attempt}/${maxRetries} to ${apiUrl}`)

        const response = await fetch(apiUrl, {
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

        logger.info(`Response status: ${response.status}`)
        logger.info(`Response headers:`, Object.fromEntries(response.headers.entries()))

        if (response.status === 500) {
          const errorText = await response.text()
          logger.error(`Server error (500) on attempt ${attempt}:`, errorText)
          lastError = new Error(`Server error: ${errorText}`)

          if (attempt < maxRetries) {
            logger.info(`Waiting 2 seconds before retry...`)
            await new Promise((resolve) => setTimeout(resolve, 2000))
            continue
          }
        }

        if (response.status === 429) {
          logger.error(`Rate limited (429) on attempt ${attempt}`)
          lastError = new Error("Rate limited by LinkedIn API")

          if (attempt < maxRetries) {
            logger.info(`Waiting 5 seconds before retry...`)
            await new Promise((resolve) => setTimeout(resolve, 5000))
            continue
          }
        }

        if (!response.ok) {
          const errorText = await response.text()
          logger.error(`HTTP error ${response.status}:`, errorText)
          throw new Error(`HTTP ${response.status}: ${errorText}`)
        }

        const contentType = response.headers.get("content-type")
        if (!contentType || !contentType.includes("application/json")) {
          const textResponse = await response.text()
          logger.error("Non-JSON response:", textResponse)

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
        logger.info("Successfully received data:", {
          connectionsCount: data.connections?.length || 0,
          hasData: !!data.data,
          keys: Object.keys(data),
        })

        // Success! Format and return the response
        const formattedResponse = {
          connections: data.connections || data.data || data || [],
          timestamp: data.timestamp || new Date().toISOString(),
          degree: degree || 1,
          connectionName: connectionName || null,
          success: true,
          attempt: attempt,
        }

        return NextResponse.json(formattedResponse)
      } catch (fetchError) {
        logger.error(`Fetch error on attempt ${attempt}:`, fetchError)
        lastError = fetchError

        if (attempt < maxRetries) {
          logger.info(`Waiting 2 seconds before retry...`)
          await new Promise((resolve) => setTimeout(resolve, 2000))
          continue
        }
      }
    }

    // All retries failed
    throw lastError || new Error("All retry attempts failed")
  } catch (error) {
    logger.error("Proxy error:", error)

    let errorMessage = "Failed to connect to LinkedIn API"
    let suggestion = "Please try again later"

    if (error instanceof Error) {
      errorMessage = error.message

      if (error.message.includes("timeout")) {
        suggestion = "The API is taking too long to respond. Try again in a few minutes."
      } else if (error.message.includes("500")) {
        suggestion = "The external API is experiencing server issues. Please try again later."
      } else if (error.message.includes("Rate limited")) {
        suggestion = "You're being rate limited. Wait a few minutes before trying again."
      } else if (error.message.includes("fetch")) {
        suggestion = "Network connection issue. Check your internet connection."
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        suggestion: suggestion,
        connections: [],
        timestamp: new Date().toISOString(),
        success: false,
        troubleshooting: {
          apiUrl: "https://linkedin-scraper-production-67df.up.railway.app/api/scrape-connections",
          status: "The external API might be down or experiencing issues",
          nextSteps: [
            "Wait 5-10 minutes and try again",
            "Check if the external API URL is still valid",
            "Verify your LinkedIn credentials are correct",
          ],
        },
      },
      { status: 500 },
    )
  }
}
