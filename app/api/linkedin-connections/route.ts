import { type NextRequest, NextResponse } from "next/server"
import cheerio from "cheerio"

// ENV değişkeninden anahtarı alın (Vercel'de SCRAPINGBEE_API_KEY olarak tanımlayın)
const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY || ""

export async function POST(req: NextRequest) {
  try {
    const { cookies, profileUrl } = await req.json()

    if (!SCRAPINGBEE_API_KEY) {
      return NextResponse.json({ error: "SCRAPINGBEE_API_KEY not configured" }, { status: 500 })
    }
    if (!cookies || !cookies.trim()) {
      return NextResponse.json({ error: "Missing cookies" }, { status: 400 })
    }

    // Varsayılan olarak kendi bağlantılarınızı çekin, aksi takdirde belirtilen profil URL'sini kullanın
    const url = profileUrl || "https://www.linkedin.com/mynetwork/invite-connect/connections/"

    console.log(`Fetching LinkedIn connections from: ${url}`)

    // ScrapingBee ile isteği yap
    const apiUrl = `https://app.scrapingbee.com/api/v1/`
    const params = new URLSearchParams({
      api_key: SCRAPINGBEE_API_KEY,
      url,
      render_js: "false",
      cookies, // String olarak: "li_at=xxx; JSESSIONID=xxx;"
      premium_proxy: "true", // LinkedIn için önerilir
      country_code: "us",
    }).toString()

    const beeRes = await fetch(`${apiUrl}?${params}`)

    if (!beeRes.ok) {
      const errorText = await beeRes.text()
      console.error("ScrapingBee error:", errorText)
      return NextResponse.json(
        {
          error: "ScrapingBee failed",
          details: errorText,
          status: beeRes.status,
        },
        { status: 500 },
      )
    }

    const html = await beeRes.text()

    // HTML içeriğini kontrol et
    if (html.includes("Please log in") || html.includes("Sign in")) {
      return NextResponse.json(
        {
          error: "LinkedIn session expired or invalid cookies",
          html: html.substring(0, 200), // İlk 200 karakteri göster
        },
        { status: 401 },
      )
    }

    // cheerio ile bağlantıları çıkaralım
    const $ = cheerio.load(html)
    const connections: any[] = []

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

    selectors.forEach((selector) => {
      $(selector).each((_, element) => {
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
          console.error("Bağlantı öğesi ayrıştırma hatası:", error)
        }
      })
    })

    // Bağlantı bulunamadıysa
    if (connections.length === 0) {
      console.log("No connections found, returning sample of HTML:", html.substring(0, 500))
      return NextResponse.json({
        error: "No connections found",
        htmlSample: html.substring(0, 500),
        connections: [],
      })
    }

    return NextResponse.json({
      connections,
      count: connections.length,
      success: true,
    })
  } catch (error: any) {
    console.error("LinkedIn connections API error:", error)
    return NextResponse.json(
      {
        error: error.message || "Unknown error occurred",
        success: false,
      },
      { status: 500 },
    )
  }
}
