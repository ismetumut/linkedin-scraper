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

    console.log("Starting LinkedIn login process for:", email)

    // 1. Önce login sayfasını çek ve CSRF token al
    const loginPageUrl = "https://www.linkedin.com/login"
    const loginPageParams = new URLSearchParams({
      api_key: SCRAPINGBEE_API_KEY,
      url: loginPageUrl,
      render_js: "false",
      premium_proxy: "true",
      country_code: "us",
    }).toString()

    console.log("Fetching LinkedIn login page...")
    const loginPageRes = await fetch(`https://app.scrapingbee.com/api/v1/?${loginPageParams}`)
    if (!loginPageRes.ok) {
      const errorText = await loginPageRes.text()
      console.error("Failed to fetch login page:", errorText)
      return NextResponse.json(
        {
          error: "Failed to fetch login page",
          details: errorText,
          status: loginPageRes.status,
        },
        { status: 500 },
      )
    }

    const loginPageHtml = await loginPageRes.text()
    console.log("Login page HTML length:", loginPageHtml.length)

    // Use regex to extract CSRF token instead of cheerio
    const csrfTokenMatch = loginPageHtml.match(/name="csrfToken" value="([^"]+)"/)
    if (!csrfTokenMatch || !csrfTokenMatch[1]) {
      console.error("Could not extract CSRF token from HTML")
      // Log a sample of the HTML to debug
      console.log("HTML sample:", loginPageHtml.substring(0, 500))
      return NextResponse.json({ error: "Could not extract CSRF token" }, { status: 500 })
    }
    const csrfToken = csrfTokenMatch[1]
    console.log("CSRF token extracted:", csrfToken.substring(0, 10) + "...")

    // Login sayfasından çerezleri al
    const setCookieHeader = loginPageRes.headers.get("set-cookie")
    let initialCookies = ""
    if (setCookieHeader) {
      // Çerezleri ayrıştır ve doğru formatta birleştir
      initialCookies = parseCookieHeader(setCookieHeader)
      console.log("Initial cookies obtained:", initialCookies.substring(0, 20) + "...")
    } else {
      console.log("No initial cookies found in response")
    }

    // 2. Giriş yap
    const loginUrl = "https://www.linkedin.com/checkpoint/lg/login-submit"
    const formData = new URLSearchParams({
      session_key: email,
      session_password: password,
      csrfToken: csrfToken,
      loginCsrfParam: csrfToken,
    }).toString()

    console.log("Submitting login form to LinkedIn...")
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
      const errorText = await loginRes.text()
      console.error("Login request failed:", errorText)
      return NextResponse.json(
        {
          error: "Login request failed",
          details: errorText,
          status: loginRes.status,
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
      console.log("Login cookies obtained:", cookies.substring(0, 20) + "...")
    } else {
      console.log("No login cookies found in response")
    }

    // Önemli çerezleri kontrol et
    if (!cookies.includes("li_at=") && !cookies.includes("JSESSIONID=")) {
      console.error("No authentication cookies received")
      return NextResponse.json(
        {
          error: "Login failed - no authentication cookies received",
          cookies: cookies,
        },
        { status: 401 },
      )
    }

    // 3. Giriş başarılı mı kontrol et
    console.log("Verifying login success...")
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
      const errorText = await checkRes.text()
      console.error("Failed to verify login:", errorText)
      return NextResponse.json(
        {
          error: "Failed to verify login",
          details: errorText,
          status: checkRes.status,
        },
        { status: 500 },
      )
    }

    const checkHtml = await checkRes.text()
    console.log("Verification page HTML length:", checkHtml.length)

    // Giriş başarılı mı kontrol et
    if (checkHtml.includes("login") && checkHtml.includes("session_password")) {
      console.error("Login verification failed - redirected to login page")
      return NextResponse.json(
        {
          error: "Login verification failed - redirected to login page",
          htmlSample: checkHtml.substring(0, 200),
        },
        { status: 401 },
      )
    }

    console.log("Login successful for:", email)
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
        stack: error.stack, // Include stack trace for debugging
      },
      { status: 500 },
    )
  }
}

// Set-Cookie header'ını ayrıştırıp name=value; formatında string döndürür
function parseCookieHeader(setCookieHeader: string): string {
  if (!setCookieHeader) return ""

  const cookiePairs: string[] = []

  try {
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
  } catch (error) {
    console.error("Error parsing cookie header:", error)
    // Return whatever we've parsed so far
  }

  // ScrapingBee format: no spaces after semicolons
  return cookiePairs.join(";")
}

// İki çerez string'ini birleştirir, aynı isimli çerezlerde ikinci string'deki değer kullanılır
function mergeCookieStrings(cookies1: string, cookies2: string): string {
  if (!cookies1) return cookies2
  if (!cookies2) return cookies1

  const cookieMap = new Map<string, string>()

  try {
    // İlk çerez string'ini ayrıştır
    cookies1.split(/;\s*/).forEach((cookie) => {
      const parts = cookie.split("=")
      if (parts.length >= 2) {
        const name = parts[0].trim()
        const value = parts.slice(1).join("=").trim() // Handle values that contain =
        if (name) cookieMap.set(name, value)
      }
    })

    // İkinci çerez string'ini ayrıştır ve varsa üzerine yaz
    cookies2.split(/;\s*/).forEach((cookie) => {
      const parts = cookie.split("=")
      if (parts.length >= 2) {
        const name = parts[0].trim()
        const value = parts.slice(1).join("=").trim() // Handle values that contain =
        if (name) cookieMap.set(name, value)
      }
    })
  } catch (error) {
    console.error("Error merging cookie strings:", error)
    // Continue with whatever we've parsed so far
  }

  // Birleştirilmiş çerez string'ini oluştur - no spaces after semicolons
  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join(";")
}
