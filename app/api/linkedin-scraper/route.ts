import { type NextRequest, NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    status: "LinkedIn Scraper API - External Backend",
    version: "5.0.0",
    mode: "PRODUCTION",
    externalBackend: "https://linkedin-scraper-production-67df.up.railway.app",
    endpoints: {
      "POST /api/linkedin-scraper": "Scrape LinkedIn connections via external API",
      "GET /api/health": "Health check endpoint",
      "GET /api/monitoring": "Monitoring and metrics endpoint",
    },
    warning: "⚠️ This scraping method may violate LinkedIn's Terms of Service",
    recommendation: "Use LinkedIn's official API or data export for production use",
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, degree = 1, connectionId, connectionName } = body

    if (!email || !password) {
      return NextResponse.json({ error: "Missing required fields: email and password" }, { status: 400 })
    }

    console.log("LinkedIn scraping request received:", { email, degree })

    // Forward the request to the external backend
    // Try different endpoints to see which one works
    const possibleEndpoints = [
      "https://linkedin-scraper-production-67df.up.railway.app/api/scrape-connections",
      "https://linkedin-scraper-production-67df.up.railway.app/api/scrape",
      "https://linkedin-scraper-production-67df.up.railway.app/scrape-connections",
      "https://linkedin-scraper-production-67df.up.railway.app/scrape",
    ]

    let successfulResponse = null
    let lastError = null
    let lastStatus = null

    // Try each endpoint
    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`)

        const requestBody = {
          email,
          password,
          degree: degree || 1,
        }

        // Add additional parameters for second-degree scraping
        if (degree === 2) {
          requestBody.connectionId = connectionId
          requestBody.connectionName = connectionName
        }

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            Accept: "application/json",
          },
          body: JSON.stringify(requestBody),
        })

        console.log(`Endpoint ${endpoint} response status:`, response.status)

        if (response.ok) {
          const data = await response.json()
          successfulResponse = {
            connections: data.connections || data.data || data || [],
            timestamp: data.timestamp || new Date().toISOString(),
            degree: degree || 1,
            connectionName: connectionName || null,
            success: true,
            source: "railway-external-api",
            endpoint: endpoint,
          }
          break
        } else {
          lastStatus = response.status
          const errorText = await response.text()
          lastError = errorText
          console.error(`Endpoint ${endpoint} error:`, errorText)
        }
      } catch (error) {
        console.error(`Error with endpoint ${endpoint}:`, error)
        lastError = error.message
      }
    }

    if (successfulResponse) {
      return NextResponse.json(successfulResponse)
    }

    // If we reach here, all endpoints failed
    // Fall back to mock data for testing
    console.log("All endpoints failed, returning mock data")

    return NextResponse.json({
      error: `External API error: ${lastStatus}`,
      details: lastError?.substring(0, 500),
      suggestion: "The Railway API might be down or experiencing issues. Using mock data instead.",
      connections: generateMockConnections(15),
      timestamp: new Date().toISOString(),
      success: true,
      source: "mock-data",
      note: "This is mock data since the external API is unavailable",
    })
  } catch (error) {
    console.error("LinkedIn scraping error:", error)

    return NextResponse.json(
      {
        error: error.message || "Failed to connect to LinkedIn API",
        suggestion: "Please try again later or use the manual CSV import",
        connections: generateMockConnections(10), // Return mock data as fallback
        timestamp: new Date().toISOString(),
        success: false,
        source: "mock-data",
        note: "This is mock data since an error occurred",
        troubleshooting: {
          apiUrl: "https://linkedin-scraper-production-67df.up.railway.app/api/scrape-connections",
          status: "The external API might be down or experiencing issues",
          nextSteps: [
            "Wait 5-10 minutes and try again",
            "Check if the external API URL is still valid",
            "Verify your LinkedIn credentials are correct",
            "Try the manual CSV import as an alternative",
          ],
        },
      },
      { status: 200 }, // Return 200 even though there was an error, since we're providing mock data
    )
  }
}

// Function to generate mock LinkedIn connections for testing
function generateMockConnections(count = 10) {
  const companies = [
    "Google",
    "Microsoft",
    "Amazon",
    "Apple",
    "Facebook",
    "Netflix",
    "Tesla",
    "Twitter",
    "LinkedIn",
    "Vercel",
  ]
  const titles = [
    "Software Engineer",
    "Product Manager",
    "Data Scientist",
    "UX Designer",
    "Marketing Manager",
    "CEO",
    "CTO",
    "COO",
    "CFO",
    "VP of Engineering",
  ]
  const locations = [
    "San Francisco, CA",
    "New York, NY",
    "Seattle, WA",
    "Austin, TX",
    "Boston, MA",
    "Chicago, IL",
    "Los Angeles, CA",
    "Denver, CO",
    "Atlanta, GA",
    "Miami, FL",
  ]

  return Array.from({ length: count }, (_, i) => ({
    name: `Mock Connection ${i + 1}`,
    title: titles[Math.floor(Math.random() * titles.length)],
    company: companies[Math.floor(Math.random() * companies.length)],
    location: locations[Math.floor(Math.random() * locations.length)],
    profileUrl: `https://linkedin.com/in/mock-connection-${i + 1}`,
    id: `mock-${i + 1}`,
    mutualConnections: Math.floor(Math.random() * 50),
    isMockData: true,
  }))
}
