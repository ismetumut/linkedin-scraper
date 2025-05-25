import { type NextRequest, NextResponse } from "next/server"

interface LinkedInConnection {
  name: string
  title?: string
  company?: string
  location?: string
  profileUrl?: string
  id?: string
  mutualConnections?: number
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, degree = 1, connectionId, connectionName } = body

    if (!email || !password) {
      return NextResponse.json({ error: "Missing required fields: email and password" }, { status: 400 })
    }

    console.log("LinkedIn scraping request received:", { email, degree })

    // Forward the request to the external backend
    const externalApiUrl = "https://linkedin-scraper-production-67df.up.railway.app/api/scrape-connections"

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

    console.log("Forwarding to Railway API:", externalApiUrl)

    const response = await fetch(externalApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    console.log("Railway API response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Railway API error:", errorText)
      return NextResponse.json(
        {
          error: `External API error: ${response.status}`,
          details: errorText.substring(0, 500),
          suggestion: "The Railway API might be down or experiencing issues",
        },
        { status: response.status },
      )
    }

    const data = await response.json()
    console.log("Successfully received data from Railway API")

    // Format the response
    const formattedResponse = {
      connections: data.connections || data.data || data || [],
      timestamp: data.timestamp || new Date().toISOString(),
      degree: degree || 1,
      connectionName: connectionName || null,
      success: true,
      source: "railway-external-api",
    }

    return NextResponse.json(formattedResponse)
  } catch (error) {
    console.error("LinkedIn scraping error:", error)

    return NextResponse.json(
      {
        error: error.message || "Failed to connect to LinkedIn API",
        suggestion: "Please try again later or use the manual CSV import",
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
            "Try the manual CSV import as an alternative",
          ],
        },
      },
      { status: 500 },
    )
  }
}
