import { type NextRequest, NextResponse } from "next/server"
import { validateAndFormatCookies, extractLinkedInCookies } from "@/lib/cookie-validator"

export async function POST(req: NextRequest) {
  try {
    const { cookies } = await req.json()

    if (!cookies || !cookies.trim()) {
      return NextResponse.json({ error: "Missing cookies" }, { status: 400 })
    }

    // Validate and format cookies
    const cookieValidation = validateAndFormatCookies(cookies)

    if (!cookieValidation.isValid) {
      return NextResponse.json(
        {
          error: "Invalid cookie format",
          details: cookieValidation.errors,
          expected: "name1=value1;name2=value2 (no spaces after semicolons)",
        },
        { status: 400 },
      )
    }

    // Check for authentication cookies
    if (!cookieValidation.authCookies.hasLiAt && !cookieValidation.authCookies.hasJSESSIONID) {
      return NextResponse.json(
        {
          error: "Missing authentication cookies",
          details: "Cookies must include either 'li_at' or 'JSESSIONID'",
        },
        { status: 400 },
      )
    }

    // Extract only important LinkedIn cookies
    const importantCookies = extractLinkedInCookies(cookieValidation.formatted)
    const formattedImportantCookies = Object.entries(importantCookies)
      .map(([name, value]) => `${name}=${value}`)
      .join(";")

    return NextResponse.json({
      success: true,
      cookies: formattedImportantCookies,
      message: "LinkedIn cookies validated and formatted successfully",
      authCookies: cookieValidation.authCookies,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error.message || "Failed to process cookies",
      },
      { status: 500 },
    )
  }
}
