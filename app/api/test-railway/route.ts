import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Test different possible endpoints
    const endpoints = [
      "https://linkedin-scraper-production-67df.up.railway.app/",
      "https://linkedin-scraper-production-67df.up.railway.app/api",
      "https://linkedin-scraper-production-67df.up.railway.app/api/scrape-connections",
      "https://linkedin-scraper-production-67df.up.railway.app/api/scrape",
      "https://linkedin-scraper-production-67df.up.railway.app/scrape-connections",
      "https://linkedin-scraper-production-67df.up.railway.app/scrape",
      "https://linkedin-scraper-production-67df.up.railway.app/health",
    ]

    const results = {}

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "application/json, text/html",
          },
        })

        let responseData
        const contentType = response.headers.get("content-type")

        if (contentType && contentType.includes("application/json")) {
          responseData = await response.json()
        } else {
          responseData = await response.text()
          // Truncate long HTML responses
          if (responseData.length > 100) {
            responseData = responseData.substring(0, 100) + "... (truncated)"
          }
        }

        results[endpoint] = {
          status: response.status,
          contentType,
          data: responseData,
        }
      } catch (error) {
        results[endpoint] = {
          error: error.message,
        }
      }
    }

    return NextResponse.json({
      message: "Railway API endpoint test results",
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Error testing Railway endpoints",
        message: error.message,
      },
      { status: 500 },
    )
  }
}
