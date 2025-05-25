import { NextResponse } from "next/server"
import * as cheerio from "cheerio"

export async function GET() {
  try {
    // Test cheerio functionality
    const html = "<html><body><div class='test'>Hello World</div></body></html>"

    // Try loading HTML with cheerio
    const $ = cheerio.load(html)
    const text = $(".test").text()

    return NextResponse.json({
      success: true,
      message: "Cheerio is working correctly",
      version: cheerio.version,
      parsedText: text,
      moduleType: typeof cheerio,
      loadType: typeof cheerio.load,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Cheerio test failed",
        message: error.message,
        stack: error.stack,
      },
      { status: 500 },
    )
  }
}
