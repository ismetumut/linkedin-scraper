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

    // Verify the cookies by making a test request to LinkedIn
    const testResult = await testLinkedInCookies(formattedImportantCookies)

    return NextResponse.json({
      success: testResult.success,
      cookies: formattedImportantCookies,
      message: testResult.success
        ? "LinkedIn cookies validated successfully"
        : "Cookies are valid but LinkedIn session may be expired",
      testResult,
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

async function testLinkedInCookies(cookies: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Make a simple request to LinkedIn to verify cookies
    const response = await fetch("https://www.linkedin.com/feed/", {
      headers: {
        Cookie: cookies,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    })

    // Check if we're redirected to login page
    const html = await response.text()
    const isLoginPage = html.includes("login") && html.includes("session_password")

    return {
      success: !isLoginPage,
      error: isLoginPage ? "LinkedIn session expired" : undefined,
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
    }
  }
}
