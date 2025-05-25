import { type NextRequest, NextResponse } from "next/server"

// ENV değişkeninden anahtarı alın
const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY || ""

// Debug mode flag
const DEBUG_MODE = true

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    steps: [],
    errors: [],
  }

  try {
    const { email, password } = await req.json()

    debugInfo.steps.push({
      step: "parse_request",
      email: email ? email.substring(0, 3) + "***" : "missing",
      hasPassword: !!password,
    })

    if (!SCRAPINGBEE_API_KEY) {
      debugInfo.errors.push("SCRAPINGBEE_API_KEY not configured")
      return NextResponse.json(
        {
          error: "SCRAPINGBEE_API_KEY not configured",
          debug: DEBUG_MODE ? debugInfo : undefined,
        },
        { status: 500 },
      )
    }

    if (!email || !password) {
      debugInfo.errors.push("Missing email or password")
      return NextResponse.json(
        {
          error: "Missing email or password",
          debug: DEBUG_MODE ? debugInfo : undefined,
        },
        { status: 400 },
      )
    }

    console.log("Starting LinkedIn login process for:", email)

    // Step 1: Fetch login page and extract CSRF token
    debugInfo.steps.push({ step: "fetch_login_page", timestamp: Date.now() - startTime })

    const loginPageUrl = "https://www.linkedin.com/login"
    const loginPageParams = new URLSearchParams({
      api_key: SCRAPINGBEE_API_KEY,
      url: loginPageUrl,
      render_js: "false",
      premium_proxy: "true",
      country_code: "us",
      return_page_source: "true",
      block_resources: "false",
      wait: "1000", // Wait 1 second for page to load
    }).toString()

    console.log("Fetching LinkedIn login page...")
    const loginPageRes = await fetch(`https://app.scrapingbee.com/api/v1/?${loginPageParams}`)

    debugInfo.steps.push({
      step: "login_page_response",
      status: loginPageRes.status,
      headers: Object.fromEntries(loginPageRes.headers.entries()),
    })

    if (!loginPageRes.ok) {
      const errorText = await loginPageRes.text()
      console.error("Failed to fetch login page:", errorText)
      debugInfo.errors.push({
        step: "login_page_fetch",
        status: loginPageRes.status,
        error: errorText.substring(0, 500),
      })
      return NextResponse.json(
        {
          error: "Failed to fetch login page",
          details: errorText.substring(0, 500),
          status: loginPageRes.status,
          debug: DEBUG_MODE ? debugInfo : undefined,
        },
        { status: 500 },
      )
    }

    const loginPageHtml = await loginPageRes.text()
    console.log("Login page HTML length:", loginPageHtml.length)

    debugInfo.steps.push({
      step: "parse_login_page",
      htmlLength: loginPageHtml.length,
      hasLoginForm: loginPageHtml.includes('name="session_key"'),
    })

    // Multiple methods to extract CSRF token
    let csrfToken = null

    // Method 1: Standard input field
    const csrfTokenMatch = loginPageHtml.match(/name="csrfToken"\s+value="([^"]+)"/)
    if (csrfTokenMatch) {
      csrfToken = csrfTokenMatch[1]
      debugInfo.steps.push({ step: "csrf_extracted", method: "input_field" })
    }

    // Method 2: Hidden input field with different formatting
    if (!csrfToken) {
      const csrfTokenMatch2 = loginPageHtml.match(/name=["']csrfToken["']\s+value=["']([^"']+)["']/)
      if (csrfTokenMatch2) {
        csrfToken = csrfTokenMatch2[1]
        debugInfo.steps.push({ step: "csrf_extracted", method: "hidden_input" })
      }
    }

    // Method 3: JavaScript variable
    if (!csrfToken) {
      const csrfTokenMatch3 = loginPageHtml.match(/csrfToken["']\s*:\s*["']([^"']+)["']/)
      if (csrfTokenMatch3) {
        csrfToken = csrfTokenMatch3[1]
        debugInfo.steps.push({ step: "csrf_extracted", method: "js_variable" })
      }
    }

    if (!csrfToken) {
      console.error("Could not extract CSRF token from HTML")
      // Log a sample of the HTML to debug
      const htmlSample = loginPageHtml.substring(0, 1000)
      console.log("HTML sample:", htmlSample)
      debugInfo.errors.push({
        step: "csrf_extraction",
        htmlSample: htmlSample,
        searchPatterns: ['name="csrfToken"', "csrfToken:", "loginCsrfParam"],
      })
      return NextResponse.json(
        {
          error: "Could not extract CSRF token",
          htmlSample: htmlSample,
          debug: DEBUG_MODE ? debugInfo : undefined,
        },
        { status: 500 },
      )
    }

    console.log("CSRF token extracted:", csrfToken.substring(0, 10) + "...")

    // Parse initial cookies from login page
    const setCookieHeader = loginPageRes.headers.get("set-cookie")
    let initialCookies = ""
    if (setCookieHeader) {
      initialCookies = parseCookieHeader(setCookieHeader)
      console.log("Initial cookies obtained:", initialCookies.substring(0, 50) + "...")
      debugInfo.steps.push({
        step: "initial_cookies",
        cookieCount: initialCookies.split(";").length,
        hasBcookie: initialCookies.includes("bcookie"),
      })
    } else {
      console.log("No initial cookies found in response")
      debugInfo.steps.push({ step: "initial_cookies", cookieCount: 0 })
    }

    // Step 2: Submit login form
    debugInfo.steps.push({ step: "submit_login", timestamp: Date.now() - startTime })

    const loginUrl = "https://www.linkedin.com/checkpoint/lg/login-submit"
    const formData = new URLSearchParams({
      session_key: email,
      session_password: password,
      csrfToken: csrfToken,
      loginCsrfParam: csrfToken,
      _d: "d", // Additional parameter sometimes required
      controlId: `d_checkpoint_lg_consumerLogin-login_submit_button`,
      pageInstance: `urn:li:page:d_checkpoint_lg_consumerLogin;${generatePageInstance()}`,
    }).toString()

    console.log("Submitting login form to LinkedIn...")
    debugInfo.steps.push({
      step: "login_form_data",
      formDataLength: formData.length,
      hasAllParams: formData.includes("session_key") && formData.includes("csrfToken"),
    })

    const loginParams = new URLSearchParams({
      api_key: SCRAPINGBEE_API_KEY,
      url: loginUrl,
      render_js: "false",
      premium_proxy: "true",
      country_code: "us",
      cookies: initialCookies,
      forward_headers: "true",
      return_page_source: "true",
      wait: "2000", // Wait 2 seconds for response
      custom_google: "true", // Use Google Chrome user agent
    }).toString()

    // Add form data as POST body
    const loginRes = await fetch(`https://app.scrapingbee.com/api/v1/?${loginParams}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData,
    })

    debugInfo.steps.push({
      step: "login_response",
      status: loginRes.status,
      headers: Object.fromEntries(loginRes.headers.entries()),
    })

    if (!loginRes.ok) {
      const errorText = await loginRes.text()
      console.error("Login request failed:", errorText)
      debugInfo.errors.push({
        step: "login_submit",
        status: loginRes.status,
        error: errorText.substring(0, 500),
      })
      return NextResponse.json(
        {
          error: "Login request failed",
          details: errorText.substring(0, 500),
          status: loginRes.status,
          debug: DEBUG_MODE ? debugInfo : undefined,
        },
        { status: 500 },
      )
    }

    // Parse response and cookies
    const loginResponseText = await loginRes.text()
    debugInfo.steps.push({
      step: "parse_login_response",
      responseLength: loginResponseText.length,
      isRedirect: loginResponseText.includes("window.location"),
      hasChallenge: loginResponseText.includes("challenge") || loginResponseText.includes("captcha"),
    })

    // Extract cookies from login response
    const loginCookieHeader = loginRes.headers.get("set-cookie")
    let cookies = initialCookies
    if (loginCookieHeader) {
      const newCookies = parseCookieHeader(loginCookieHeader)
      cookies = mergeCookieStrings(cookies, newCookies)
      console.log("Login cookies obtained, total length:", cookies.length)
      debugInfo.steps.push({
        step: "login_cookies",
        cookieCount: cookies.split(";").length,
        hasLiAt: cookies.includes("li_at"),
        hasJSESSIONID: cookies.includes("JSESSIONID"),
      })
    }

    // Check for authentication cookies
    const hasAuthCookies = cookies.includes("li_at=") || cookies.includes("JSESSIONID=")
    if (!hasAuthCookies) {
      console.error("No authentication cookies received")

      // Check for specific error conditions
      if (loginResponseText.includes("captcha") || loginResponseText.includes("CAPTCHA")) {
        debugInfo.errors.push({ step: "login_verification", type: "captcha_required" })
        return NextResponse.json(
          {
            error: "LinkedIn requires CAPTCHA verification",
            suggestion: "Try logging in manually first, then use the cookie import feature",
            debug: DEBUG_MODE ? debugInfo : undefined,
          },
          { status: 401 },
        )
      }

      if (loginResponseText.includes("challenge") || loginResponseText.includes("verification")) {
        debugInfo.errors.push({ step: "login_verification", type: "additional_verification" })
        return NextResponse.json(
          {
            error: "LinkedIn requires additional verification",
            suggestion: "Complete verification in your browser, then try again",
            debug: DEBUG_MODE ? debugInfo : undefined,
          },
          { status: 401 },
        )
      }

      debugInfo.errors.push({
        step: "auth_cookies",
        cookies: cookies.substring(0, 100),
        responseSnippet: loginResponseText.substring(0, 200),
      })

      return NextResponse.json(
        {
          error: "Login failed - no authentication cookies received",
          cookies: cookies.substring(0, 100) + "...",
          debug: DEBUG_MODE ? debugInfo : undefined,
        },
        { status: 401 },
      )
    }

    // Step 3: Verify login success
    debugInfo.steps.push({ step: "verify_login", timestamp: Date.now() - startTime })

    console.log("Verifying login success...")
    const checkUrl = "https://www.linkedin.com/feed/"
    const checkParams = new URLSearchParams({
      api_key: SCRAPINGBEE_API_KEY,
      url: checkUrl,
      render_js: "false",
      premium_proxy: "true",
      country_code: "us",
      cookies,
      return_page_source: "true",
      wait: "1000",
    }).toString()

    const checkRes = await fetch(`https://app.scrapingbee.com/api/v1/?${checkParams}`)

    debugInfo.steps.push({
      step: "verify_response",
      status: checkRes.status,
    })

    if (!checkRes.ok) {
      const errorText = await checkRes.text()
      console.error("Failed to verify login:", errorText)
      debugInfo.errors.push({
        step: "verify_login",
        status: checkRes.status,
        error: errorText.substring(0, 500),
      })
      return NextResponse.json(
        {
          error: "Failed to verify login",
          details: errorText.substring(0, 500),
          status: checkRes.status,
          debug: DEBUG_MODE ? debugInfo : undefined,
        },
        { status: 500 },
      )
    }

    const checkHtml = await checkRes.text()
    console.log("Verification page HTML length:", checkHtml.length)

    // Check if we're still on login page
    if (checkHtml.includes("login") && checkHtml.includes("session_password")) {
      console.error("Login verification failed - redirected to login page")
      debugInfo.errors.push({
        step: "verify_content",
        stillOnLoginPage: true,
        htmlSnippet: checkHtml.substring(0, 200),
      })
      return NextResponse.json(
        {
          error: "Login verification failed - redirected to login page",
          htmlSample: checkHtml.substring(0, 200),
          debug: DEBUG_MODE ? debugInfo : undefined,
        },
        { status: 401 },
      )
    }

    // Success!
    debugInfo.steps.push({
      step: "login_success",
      totalTime: Date.now() - startTime,
      cookieCount: cookies.split(";").length,
    })

    console.log("Login successful for:", email)
    return NextResponse.json({
      success: true,
      cookies,
      message: "Successfully logged in to LinkedIn",
      debug: DEBUG_MODE ? debugInfo : undefined,
    })
  } catch (error: any) {
    console.error("LinkedIn login API error:", error)
    debugInfo.errors.push({
      step: "exception",
      error: error.message,
      stack: error.stack,
    })
    return NextResponse.json(
      {
        error: error.message || "Unknown error occurred",
        stack: error.stack,
        debug: DEBUG_MODE ? debugInfo : undefined,
      },
      { status: 500 },
    )
  }
}

// Generate a random page instance ID
function generatePageInstance(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// Enhanced cookie parsing with better error handling
function parseCookieHeader(setCookieHeader: string): string {
  if (!setCookieHeader) return ""

  const cookiePairs: string[] = []
  const processedCookies = new Set<string>()

  try {
    // Split by comma but not commas within cookie values
    const cookieStrings = setCookieHeader.split(/,(?=\s*[^=]+=)/)

    for (const cookieString of cookieStrings) {
      // Extract the cookie name=value pair (before first semicolon)
      const mainCookie = cookieString.split(";")[0].trim()
      const equalIndex = mainCookie.indexOf("=")

      if (equalIndex > 0) {
        const name = mainCookie.substring(0, equalIndex).trim()
        const value = mainCookie.substring(equalIndex + 1).trim()

        // Skip duplicate cookies
        if (!processedCookies.has(name) && name && value) {
          cookiePairs.push(`${name}=${value}`)
          processedCookies.add(name)
        }
      }
    }
  } catch (error) {
    console.error("Error parsing cookie header:", error)
  }

  // ScrapingBee format: no spaces after semicolons
  return cookiePairs.join(";")
}

// Enhanced cookie merging with deduplication
function mergeCookieStrings(cookies1: string, cookies2: string): string {
  if (!cookies1) return cookies2
  if (!cookies2) return cookies1

  const cookieMap = new Map<string, string>()

  try {
    // Parse first cookie string
    for (const cookie of cookies1.split(/;\s*/)) {
      const parts = cookie.split("=")
      if (parts.length >= 2) {
        const name = parts[0].trim()
        const value = parts.slice(1).join("=").trim()
        if (name) cookieMap.set(name, value)
      }
    }

    // Parse second cookie string (overwrites duplicates)
    for (const cookie of cookies2.split(/;\s*/)) {
      const parts = cookie.split("=")
      if (parts.length >= 2) {
        const name = parts[0].trim()
        const value = parts.slice(1).join("=").trim()
        if (name) cookieMap.set(name, value)
      }
    }
  } catch (error) {
    console.error("Error merging cookie strings:", error)
  }

  // Build merged cookie string
  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join(";")
}
