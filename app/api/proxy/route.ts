import { type NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Railway backend URL
    const apiUrl = "https://linkedin-scraper-production-67df.up.railway.app/api/scrape-connections"

    logger.info(`Proxying request to Railway backend: ${apiUrl}`)

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`Railway API error: ${response.status}`, { error: errorText })
      return NextResponse.json(
        { error: `Railway API error: ${response.status}`, details: errorText },
        { status: response.status },
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    logger.error("Proxy error:", { error: error.message })
    return NextResponse.json({ error: "Failed to connect to Railway API", details: error.message }, { status: 500 })
  }
}
