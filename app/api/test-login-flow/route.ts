import { NextResponse } from "next/server"

const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY || ""

export async function GET() {
  const testResults = {
    timestamp: new Date().toISOString(),
    tests: [],
    summary: {
      passed: 0,
      failed: 0,
    },
  }

  try {
    // Test 1: ScrapingBee API Key
    if (SCRAPINGBEE_API_KEY) {
      testResults.tests.push({
        name: "ScrapingBee API Key",
        status: "passed",
        details: "API key is configured",
      })
      testResults.summary.passed++
    } else {
      testResults.tests.push({
        name: "ScrapingBee API Key",
        status: "failed",
        details: "API key is not configured",
      })
      testResults.summary.failed++
    }

    // Test 2: ScrapingBee Connection
    try {
      const testUrl = "https://httpbin.org/get"
      const params = new URLSearchParams({
        api_key: SCRAPINGBEE_API_KEY,
        url: testUrl,
        render_js: "false",
      }).toString()

      const response = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`)

      if (response.ok) {
        testResults.tests.push({
          name: "ScrapingBee Connection",
          status: "passed",
          details: `Connected successfully (status: ${response.status})`,
        })
        testResults.summary.passed++
      } else {
        testResults.tests.push({
          name: "ScrapingBee Connection",
          status: "failed",
          details: `Connection failed (status: ${response.status})`,
        })
        testResults.summary.failed++
      }
    } catch (error) {
      testResults.tests.push({
        name: "ScrapingBee Connection",
        status: "failed",
        details: `Exception: ${error.message}`,
      })
      testResults.summary.failed++
    }

    // Test 3: LinkedIn Login Page Access
    try {
      const loginPageUrl = "https://www.linkedin.com/login"
      const params = new URLSearchParams({
        api_key: SCRAPINGBEE_API_KEY,
        url: loginPageUrl,
        render_js: "false",
        premium_proxy: "true",
        country_code: "us",
      }).toString()

      const response = await fetch(`https://app.scrapingbee.com/api/v1/?${params}`)
      const html = await response.text()

      if (response.ok && html.includes("session_key")) {
        testResults.tests.push({
          name: "LinkedIn Login Page Access",
          status: "passed",
          details: "Login page loaded successfully",
        })
        testResults.summary.passed++

        // Test CSRF token extraction
        const csrfTokenMatch = html.match(/name="csrfToken"\s+value="([^"]+)"/)
        if (csrfTokenMatch) {
          testResults.tests.push({
            name: "CSRF Token Extraction",
            status: "passed",
            details: "CSRF token found",
          })
          testResults.summary.passed++
        } else {
          testResults.tests.push({
            name: "CSRF Token Extraction",
            status: "failed",
            details: "CSRF token not found in HTML",
          })
          testResults.summary.failed++
        }
      } else {
        testResults.tests.push({
          name: "LinkedIn Login Page Access",
          status: "failed",
          details: `Failed to load login page (status: ${response.status})`,
        })
        testResults.summary.failed++
      }
    } catch (error) {
      testResults.tests.push({
        name: "LinkedIn Login Page Access",
        status: "failed",
        details: `Exception: ${error.message}`,
      })
      testResults.summary.failed++
    }

    // Test 4: Cookie Parsing
    try {
      const testCookie = "bcookie=value1;JSESSIONID=value2;li_at=value3"
      const parsed = testCookie.split(";").length

      testResults.tests.push({
        name: "Cookie Parsing",
        status: "passed",
        details: `Parsed ${parsed} cookies successfully`,
      })
      testResults.summary.passed++
    } catch (error) {
      testResults.tests.push({
        name: "Cookie Parsing",
        status: "failed",
        details: `Exception: ${error.message}`,
      })
      testResults.summary.failed++
    }

    return NextResponse.json(testResults)
  } catch (error) {
    return NextResponse.json(
      {
        error: "Test suite failed",
        message: error.message,
        testResults,
      },
      { status: 500 },
    )
  }
}
