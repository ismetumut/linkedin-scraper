import { type NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"

const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY || ""
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

    // Cookie formatı: li_at=XXX;JSESSIONID="ajax:XXX"
    const formattedCookies = cookies.replace(/\s/g, "");

    const url = profileUrl || "https://www.linkedin.com/mynetwork/invite-connect/connections/"

    debugInfo.steps.push({
      step: "prepare_request",
      url,
      cookieFormat: "valid",
      timestamp: Date.now() - startTime,
    })

    const apiUrl = `https://app.scrapingbee.com/api/v1/`
    const params = new URLSearchParams({
      api_key: SCRAPINGBEE_API_KEY,
      url,
      render_js: "false",
      cookies: formattedCookies,
      premium_proxy: "true",
      country_code: "us",
      return_page_source: "true",
      wait: "2000",
      block_resources: "false",
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

    debugInfo.steps.push({
      step: "parse_html",
      htmlLength: html.length,
      isLoginPage: html.includes("Please log in") || html.includes("Sign in"),
      timestamp: Date.now() - startTime,
    })

    if (html.includes("Please log in") || html.includes("Sign in")) {
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

    if (!html || html.trim().length === 0) {
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

    // cheerio ile bağlantıları çıkar
    const $ = cheerio.load(html)
    const connections: any[] = []

    const selectors = [
      ".mn-connection-card",
      ".connection-card",
      ".search-result",
      "[data-test-connection]",
      ".entity-result",
      ".scaffold-finite-scroll__content > .relative",
      ".artdeco-list__item",
    ]

    selectors.forEach((selector) => {
      const elements = $(selector)
      elements.each((_, element) => {
        try {
          const nameElement = $(element).find(
            ".mn-connection-card__name, .connection-card__name, .search-result__result-link, [data-test-connection-name], .entity-result__title-text a, .t-16, .t-bold, .artdeco-entity-lockup__title",
          )
          const name = nameElement.text().trim()

          const titleElement = $(element).find(
            ".mn-connection-card__occupation, .connection-card__occupation, .subline-level-1, [data-test-connection-occupation], .entity-result__primary-subtitle, .t-14, .t-black--light, .artdeco-entity-lockup__subtitle",
          )
          const title = titleElement.text().trim()

          const companyElement = $(element).find(
            ".entity-result__secondary-subtitle, .t-12, .t-black--light, .artdeco-entity-lockup__caption",
          )
          const company = companyElement.text().trim()

          const linkElement = $(element).find('a[href*="/in/"]')
          const profileUrl = linkElement.attr("href") || ""

          const id = profileUrl.split("/in/")[1]?.split("/")[0] || ""

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
          debugInfo.errors.push({
            step: "connection_parsing",
            error: error.message,
          })
        }
      })
    })

    if (connections.length === 0) {
      return NextResponse.json(
        {
          error: "No connections found",
          sampleHtml: html.substring(0, 500),
          debug: DEBUG_MODE ? debugInfo : undefined,
        },
        { status: 404 }
      );
    }

    // Success!
    return NextResponse.json(
      {
        connections,
        debug: DEBUG_MODE ? debugInfo : undefined,
      },
      { status: 200 }
    );
  } catch (error: any) {
    debugInfo.errors.push({ step: "catch_all", error: error.message });
    return NextResponse.json(
      {
        error: error.message,
        debug: DEBUG_MODE ? debugInfo : undefined,
      },
      { status: 500 }
    );
  }
}
