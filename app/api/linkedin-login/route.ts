import { type NextRequest, NextResponse } from "next/server"

// ENV değişkeninden anahtarı alın
const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY || ""

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!SCRAPINGBEE_API_KEY) {
      return NextResponse.json({ error: "SCRAPINGBEE_API_KEY not configured" }, { status: 500 })
    }
    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 })
    }

    // 1. Önce login sayfasını çek ve CSRF token al
    const loginPageUrl = "https://www.linkedin.com/login"
    const loginPageParams = new URLSearchParams({
      api_key: SCRAPINGBEE_API_KEY,
      url: loginPageUrl,
      render_js: "false",
      premium_proxy: "true",
      country_code: "us",
    }).toString()

    const loginPageRes = await fetch(`https://app.scrapingbee.com/api/v1/?${loginPageParams}`)
    if (!loginPageRes.ok) {
      return NextResponse.json(
        {
          error: "Failed to fetch login page",
          details: await loginPageRes.text(),
        },
        { status: 500 },
      )
    }

    const loginPageHtml = await loginPageRes.text()

    // CSRF token'ı çıkar
    const csrfTokenMatch = loginPageHtml.match(/name="csrfToken" value="([^"]+)"/)
    if (!csrfTokenMatch || !csrfTokenMatch[1]) {
      return NextResponse.json({ error: "Could not extract CSRF token" }, { status: 500 })
    }
    const csrfToken = csrfTokenMatch[1]

    // Login sayfasından çerezleri al
    const setCookieHeader = loginPageRes.headers.get("set-cookie")
    let initialCookies = ""
    if (setCookieHeader) {
      // Çerezleri ayrıştır
      initialCookies = setCookieHeader
        .split(",")
        .map((cookie) => cookie.split(";")[0].trim())
        .join("; ")
    }

    // 2. Giriş yap
    const loginUrl = "https://www.linkedin.com/checkpoint/lg/login-submit"
    const formData = new URLSearchParams({
      session_key: email,
      session_password: password,
      csrfToken: csrfToken,
      loginCsrfParam: csrfToken,
    }).toString()

    const loginParams = new URLSearchParams({
      api_key: SCRAPINGBEE_API_KEY,
      url: loginUrl,
      render_js: "false",
      premium_proxy: "true",
      country_code: "us",
      cookies: initialCookies,
      body: formData,
      method: "POST",
      headers: JSON.stringify({
        "Content-Type": "application/x-www-form-urlencoded",
      }),
    }).toString()

    const loginRes = await fetch(`https://app.scrapingbee.com/api/v1/?${loginParams}`)
    if (!loginRes.ok) {
      return NextResponse.json(
        {
          error: "Login request failed",
          details: await loginRes.text(),
        },
        { status: 500 },
      )
    }

    // Giriş sonrası çerezleri al
    const loginCookieHeader = loginRes.headers.get("set-cookie")
    let cookies = initialCookies
    if (loginCookieHeader) {
      const newCookies = loginCookieHeader
        .split(",")
        .map((cookie) => cookie.split(";")[0].trim())
        .join("; ")

      cookies = cookies ? `${cookies}; ${newCookies}` : newCookies
    }

    // Önemli çerezleri kontrol et
    if (!cookies.includes("li_at=") && !cookies.includes("JSESSIONID=")) {
      return NextResponse.json(
        {
          error: "Login failed - no authentication cookies received",
          cookies: cookies,
        },
        { status: 401 },
      )
    }

    // 3. Giriş başarılı mı kontrol et
    const checkUrl = "https://www.linkedin.com/feed/"
    const checkParams = new URLSearchParams({
      api_key: SCRAPINGBEE_API_KEY,
      url: checkUrl,
      render_js: "false",
      premium_proxy: "true",
      country_code: "us",
      cookies,
    }).toString()

    const checkRes = await fetch(`https://app.scrapingbee.com/api/v1/?${checkParams}`)
    if (!checkRes.ok) {
      return NextResponse.json(
        {
          error: "Failed to verify login",
          details: await checkRes.text(),
        },
        { status: 500 },
      )
    }

    const checkHtml = await checkRes.text()

    // Giriş başarılı mı kontrol et
    if (checkHtml.includes("login") && checkHtml.includes("session_password")) {
      return NextResponse.json(
        {
          error: "Login verification failed - redirected to login page",
          htmlSample: checkHtml.substring(0, 200),
        },
        { status: 401 },
      )
    }

    return NextResponse.json({
      success: true,
      cookies,
      message: "Successfully logged in to LinkedIn",
    })
  } catch (error: any) {
    console.error("LinkedIn login API error:", error)
    return NextResponse.json(
      {
        error: error.message || "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}
