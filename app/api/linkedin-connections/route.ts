import { type NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio" // Explicit import
import { validateAndFormatCookies } from "@/lib/cookie-validator"

// ENV değişkeninden anahtarı alın
const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY || ""

// Debug mode for detailed error reporting
const DEBUG_MODE = true

export async function POST(req: NextRequest) {
  const startTime = Date.now()
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    steps: [],
    errors: [],
    requestId: Math.random().toString(36).substring(2, 15),
  }

  try {
    const { cookies, profileUrl } = await req.json()

    debugInfo.steps.push({
      step: "parse_request",
      hasCookies: !!cookies,
      cookieLength: cookies ? cookies.length : 0,
      profileUrl: profileUrl || "default",
      timestamp: Date.now() - startTime,
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

    if (!cookies || !cookies.trim()) {
      debugInfo.errors.push("Missing cookies")
      return NextResponse.json(
        {
          error: "Missing cookies",
          debug: DEBUG_MODE ? debugInfo : undefined,
        },
        { status: 400 },
      )
    }

    // Validate and format cookies
    const cookieValidation = validateAndFormatCookies(cookies)
    debugInfo.steps.push({
      step: "validate_cookies",
      isValid: cookieValidation.isValid,
      errors: cookieValidation.errors,
      hasLiAt: cookieValidation.authCookies.hasLiAt,
      hasJSESSIONID: cookieValidation.authCookies.hasJSESSIONID,
      timestamp: Date.now() - startTime,
    })

    if (!cookieValidation.isValid) {
      debugInfo.errors.push({
        step: "cookie_validation",
        errors: cookieValidation.errors,
      })
      return NextResponse.json(
        {
          error: "Invalid cookie format",
          details: cookieValidation.errors,
          expected: "name1=value1;name2=value2 (no spaces after semicolons)",
          debug: DEBUG_MODE ? debugInfo : undefined,
        },
        { status: 400 },
      )
    }

    const formattedCookies = cookieValidation.formatted

    // Varsayılan olarak kendi bağlantılarınızı çekin, aksi takdirde belirtilen profil URL'sini kullanın
    const url = profileUrl || "https://www.linkedin.com/mynetwork/invite-connect/connections/"

    console.log(`[${debugInfo.requestId}] Fetching LinkedIn connections from: ${url}`)
    console.log(`[${debugInfo.requestId}] Using cookies format: ${formattedCookies.substring(0, 20)}...`)

    debugInfo.steps.push({
      step: "prepare_request",
      url,
      cookieFormat: "valid",
      timestamp: Date.now() - startTime,
    })

    // ScrapingBee ile isteği yap
    const apiUrl = `https://app.scrapingbee.com/api/v1/`
    const params = new URLSearchParams({
      api_key: SCRAPINGBEE_API_KEY,
      url,
      render_js: "false",
      cookies: formattedCookies,
      premium_proxy: "true", // LinkedIn için önerilir
      country_code: "us",
      return_page_source: "true",
      wait: "2000", // Wait for page to load
      block_resources: "false", // Load all resources
      custom_google: "true", // Use Google Chrome user agent
    }).toString()

    const beeRes = await fetch(`${apiUrl}?${params}`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    })

    debugInfo.steps.push({
      step: "scrapingbee_response",
      status: beeRes.status,
      headers: Object.fromEntries(beeRes.headers.entries()),
      timestamp: Date.now() - startTime,
    })

    if (!beeRes.ok) {
      const errorText = await beeRes.text()
      console.error(`[${debugInfo.requestId}] ScrapingBee error:`, errorText.substring(0, 200))
      debugInfo.errors.push({
        step: "scrapingbee_request",
        status: beeRes.status,
        error: errorText.substring(0, 500),
      })
      return NextResponse.json(
        {
          error: "ScrapingBee failed",
          details: errorText.substring(0, 500),
          status: beeRes.status,
          debug: DEBUG_MODE ? debugInfo : undefined,
        },
        { status: 500 },
      )
    }

    const html = await beeRes.text()
    console.log(`[${debugInfo.requestId}] Received HTML length: ${html.length}`)

    debugInfo.steps.push({
      step: "parse_html",
      htmlLength: html.length,
      isLoginPage: html.includes("Please log in") || html.includes("Sign in"),
      timestamp: Date.now() - startTime,
    })

    // HTML içeriğini kontrol et
    if (html.includes("Please log in") || html.includes("Sign in")) {
      console.error(`[${debugInfo.requestId}] LinkedIn session expired or invalid cookies`)
      debugInfo.errors.push({
        step: "session_validation",
        error: "LinkedIn session expired or invalid cookies",
        htmlSample: html.substring(0, 200),
      })
      return NextResponse.json(
        {
          error: "LinkedIn session expired or invalid cookies",
          html: html.substring(0, 200),
          debug: DEBUG_MODE ? debugInfo : undefined,
        },
        { status: 401 },
      )
    }

    // Check if HTML is valid before loading into cheerio
    if (!html || html.trim().length === 0) {
      console.error(`[${debugInfo.requestId}] Empty HTML received from ScrapingBee`)
      debugInfo.errors.push({
        step: "html_validation",
        error: "Empty HTML received",
      })
      return NextResponse.json(
        {
          error: "Empty HTML received from ScrapingBee",
          details: "The response body was empty or contained only whitespace",
          debug: DEBUG_MODE ? debugInfo : undefined,
        },
        { status: 500 },
      )
    }

    try {
      // cheerio ile bağlantıları çıkaralım
      const $ = cheerio.load(html)
      const connections: any[] = []

      debugInfo.steps.push({
        step: "cheerio_load",
        success: true,
        timestamp: Date.now() - startTime,
      })

      // Farklı seçicileri dene (LinkedIn'in HTML yapısı değişebilir)
      const selectors = [
        ".mn-connection-card",
        ".connection-card",
        ".search-result",
        "[data-test-connection]",
        ".entity-result",
        ".scaffold-finite-scroll__content > .relative",
        ".artdeco-list__item",
      ]

      let totalElementsFound = 0

      selectors.forEach((selector) => {
        const elements = $(selector)
        totalElementsFound += elements.length

        elements.each((_, element) => {
          try {
            // İsim çıkar
            const nameElement = $(element).find(
              ".mn-connection-card__name, .connection-card__name, .search-result__result-link, [data-test-connection-name], .entity-result__title-text a, .t-16, .t-bold, .artdeco-entity-lockup__title",
            )
            const name = nameElement.text().trim()

            // Unvan çıkar
            const titleElement = $(element).find(
              ".mn-connection-card__occupation, .connection-card__occupation, .subline-level-1, [data-test-connection-occupation], .entity-result__primary-subtitle, .t-14, .t-black--light, .artdeco-entity-lockup__subtitle",
            )
            const title = titleElement.text().trim()

            // Şirket çıkar
            const companyElement = $(element).find(
              ".entity-result__secondary-subtitle, .t-12, .t-black--light, .artdeco-entity-lockup__caption",
            )
            const company = companyElement.text().trim()

            // Profil URL'sini çıkar
            const linkElement = $(element).find('a[href*="/in/"]')
            const profileUrl = linkElement.attr("href") || ""

            // URL'den ID çıkar
            const id = profileUrl.split("/in/")[1]?.split("/")[0] || ""

            // Konum çıkar
            const locationElement = $(element).find(
              ".entity-result__secondary-subtitle:nth-child(2), .t-12:nth-child(2), .artdeco-entity-lockup__metadata",
            )
            const location = locationElement.text().trim()

            if (name) {
              connections.push({
                name,
                title: title || undefined,
                company: company || undefined,
                location: location || undefined,
                profileUrl: profileUrl.startsWith("http") ? profileUrl : `https://www.linkedin.com${profileUrl}`,
                id,
              })
            }
          } catch (error) {
            console.error(`[${debugInfo.requestId}] Connection parsing error:`, error)
            debugInfo.errors.push({
              step: "connection_parsing",
              error: error.message,
            })
          }
        })
      })

      debugInfo.steps.push({
        step: "parse_connections",
        totalElementsFound,
        connectionsExtracted: connections.length,
        timestamp: Date.now() - startTime,
      })

      // Bağlantı bulunamadıysa
      if (connections.length === 0) {
        console.log(`[${debugInfo.requestId}] No connections found, returning sample of HTML:`, html.substring(0, 500))
        debugInfo.errors.push({
          step: "connections_extraction",
          error: "No connections found",
          totalElementsFound,
          htmlSample: html.substring(0, 500),
        })
        return NextResponse.json({
          error: "No connections found",
          htmlSample: html.substring(0, 500),
          connections: [],
          debug: DEBUG_MODE ? debugInfo : undefined,
        })
      }

      return NextResponse.json({
        connections,
        count: connections.length,
        success: true,
        debug: DEBUG_MODE ? debugInfo : undefined,
      })
    } catch (error) {
      console.error(`[${debugInfo.requestId}] Error parsing HTML with cheerio:`, error)
      debugInfo.errors.push({
        step: "cheerio_parsing",
        error: error.message,
        stack: error.stack,
      })
      return NextResponse.json(
        {
          error: "Failed to parse LinkedIn HTML",
          details: error.message,
          htmlSample: html.substring(0, 500),
          debug: DEBUG_MODE ? debugInfo : undefined,
        },
        { status: 500 },
      )
    }
  } catch (error: any) {
    console.error(`LinkedIn connections API error:`, error)
    debugInfo.errors.push({
      step: "exception",
      error: error.message,
      stack: error.stack,
    })
    return NextResponse.json(
      {
        error: error.message || "Unknown error occurred",
        stack: error.stack,
        success: false,
        debug: DEBUG_MODE ? debugInfo : undefined,
      },
      { status: 500 },
    )
  }
}
