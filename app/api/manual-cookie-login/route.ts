import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { cookies } = await req.json()

    if (!cookies || !cookies.trim()) {
      return NextResponse.json({ error: "Missing cookies" }, { status: 400 })
    }

    // Validate that we have authentication cookies
    const hasLiAt = cookies.includes("li_at=")
    const hasJSESSIONID = cookies.includes("JSESSIONID=")

    if (!hasLiAt && !hasJSESSIONID) {
      return NextResponse.json(
        {
          error: "Invalid cookies - missing authentication tokens",
          details: "Cookies must include either 'li_at' or 'JSESSIONID'",
        },
        { status: 400 },
      )
    }

    // Format cookies properly (remove spaces after semicolons)
    const formattedCookies = cookies
      .split(/;\s*/)
      .filter((c) => c.includes("="))
      .join(";")

    return NextResponse.json({
      success: true,
      cookies: formattedCookies,
      message: "Cookies validated and formatted successfully",
      hasLiAt,
      hasJSESSIONID,
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
