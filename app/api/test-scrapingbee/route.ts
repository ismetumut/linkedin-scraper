import { NextResponse } from "next/server"

// ENV değişkeninden anahtarı alın
const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY || ""

export async function GET() {
  try {
    if (!SCRAPINGBEE_API_KEY) {
      return NextResponse.json({ error: "SCRAPINGBEE_API_KEY not configured" }, { status: 500 })
    }

    // ScrapingBee ile basit bir test isteği yap
    const testUrl = "https://httpbin.org/get"
    const apiUrl = `https://app.scrapingbee.com/api/v1/`
    const params = new URLSearchParams({
      api_key: SCRAPINGBEE_API_KEY,
      url: testUrl,
      render_js: "false",
    }).toString()

    const response = await fetch(`${apiUrl}?${params}`)

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "ScrapingBee test failed",
          status: response.status,
          details: await response.text(),
        },
        { status: 500 },
      )
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      message: "ScrapingBee is working correctly!",
      apiKeyConfigured: true,
      testResponse: data,
    })
  } catch (error) {
    console.error("ScrapingBee test error:", error)
    return NextResponse.json(
      {
        error: "Failed to test ScrapingBee",
        message: error.message,
      },
      { status: 500 },
    )
  }
}
