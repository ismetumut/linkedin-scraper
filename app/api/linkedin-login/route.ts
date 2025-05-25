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
      // Çerezleri ayrıştır ve doğru formatta birleştir
      initialCookies = parseCookieHeader(setCookieHeader)
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
      const newCookies = parseCookieHeader(loginCookieHeader)
      cookies = cookies ? mergeCookieStrings(cookies, newCookies) : newCookies
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

// Set-Cookie header'ını ayrıştırıp name=value; formatında string döndürür
function parseCookieHeader(setCookieHeader: string): string {
  const cookiePairs: string[] = []

  // Set-Cookie header'ı virgülle ayrılmış olabilir
  setCookieHeader.split(/,(?=[^ =;]+=[^;]+)/).forEach((cookieString) => {
    // Her bir çerez string'ini ayrıştır
    const cookieParts = cookieString.split(";")[0].trim()
    const equalIndex = cookieParts.indexOf("=")

    if (equalIndex > 0) {
      const name = cookieParts.substring(0, equalIndex).trim()
      const value = cookieParts.substring(equalIndex + 1).trim()

      if (name && value) {
        cookiePairs.push(`${name}=${value}`)
      }
    }
  })

  return cookiePairs.join("; ")
}

// İki çerez string'ini birleştirir, aynı isimli çerezlerde ikinci string'deki değer kullanılır
function mergeCookieStrings(cookies1: string, cookies2: string): string {
  const cookieMap = new Map<string, string>()

  // İlk çerez string'ini ayrıştır
  cookies1.split("; ").forEach((cookie) => {
    const [name, value] = cookie.split("=")
    if (name && value) cookieMap.set(name, value)
  })

  // İkinci çerez string'ini ayrıştır ve varsa üzerine yaz
  cookies2.split("; ").forEach((cookie) => {
    const [name, value] = cookie.split("=")
    if (name && value) cookieMap.set(name, value)
  })

  // Birleştirilmiş çerez string'ini oluştur
  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ")
}
