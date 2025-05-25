import { NextResponse } from "next/server"

export async function GET() {
  // Test various cookie formats
  const testCases = [
    {
      name: "Correct format (no spaces)",
      cookie: "li_at=AQEDATHXuqwF1zLnAAABjRKpC_0AAAGNN;JSESSIONID=ajax:1234567890",
      expected: true,
    },
    {
      name: "Correct format (single cookie)",
      cookie: "session_id=abc123",
      expected: true,
    },
    {
      name: "Incorrect format (spaces after semicolon)",
      cookie: "li_at=AQEDATHXuqwF1zLnAAABjRKpC_0AAAGNN; JSESSIONID=ajax:1234567890",
      expected: false,
    },
    {
      name: "Incorrect format (no equals sign)",
      cookie: "test-cookie",
      expected: false,
    },
    {
      name: "Empty cookie",
      cookie: "",
      expected: false,
    },
  ]

  const results = testCases.map((testCase) => {
    // Validate cookie format
    const isValid = validateCookieFormat(testCase.cookie)
    const formatted = formatCookieString(testCase.cookie)

    return {
      ...testCase,
      isValid,
      formatted,
      passed: isValid === testCase.expected,
    }
  })

  return NextResponse.json({
    message: "Cookie format validation test",
    results,
    summary: {
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
    },
  })
}

function validateCookieFormat(cookie: string): boolean {
  if (!cookie || typeof cookie !== "string") return false
  if (!cookie.includes("=")) return false

  // Check for spaces after semicolons (invalid for ScrapingBee)
  if (cookie.includes("; ")) return false

  // Check each cookie pair
  const pairs = cookie.split(";")
  for (const pair of pairs) {
    if (!pair.includes("=")) return false
    const [name, value] = pair.split("=")
    if (!name || !value) return false
  }

  return true
}

function formatCookieString(cookie: string): string {
  if (!cookie || typeof cookie !== "string") return ""

  // Remove spaces after semicolons and trim each cookie
  return cookie
    .split(/;\s*/)
    .filter((c) => c.includes("="))
    .map((c) => c.trim())
    .join(";")
}
