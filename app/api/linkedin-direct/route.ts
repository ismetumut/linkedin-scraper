import { type NextRequest, NextResponse } from "next/server"
import * as cheerio from "cheerio"
import fetch from "node-fetch"

// LinkedIn'e bağlanmak için kullanılacak sabit değerler
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:109.0) Gecko/20100101 Firefox/121.0",
]

// Rate limiting için basit bir çözüm
const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 dakika
  maxRequests: 5, // 15 dakikada maksimum 5 istek
  requests: new Map<string, number[]>(),
}

export async function GET() {
  return NextResponse.json({
    status: "LinkedIn Direct Scraper API",
    version: "1.0.0",
    mode: "PRODUCTION",
    endpoints: {
      "POST /api/linkedin-direct": "Scrape LinkedIn connections directly",
    },
    warning: "⚠️ This scraping method may violate LinkedIn's Terms of Service",
    recommendation: "Use LinkedIn's official data export for production use",
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password, degree = 1, connectionId, connectionName } = body

    // Gerekli alanları kontrol et
    if (!email || !password) {
      return NextResponse.json({ error: "Email ve şifre gerekli" }, { status: 400 })
    }

    // IP adresini al (rate limiting için)
    const ip = request.headers.get("x-forwarded-for") || "unknown"

    // Rate limiting kontrolü
    if (isRateLimited(ip)) {
      return NextResponse.json(
        {
          error: "Rate limit aşıldı",
          message: "Çok fazla istek gönderdiniz. Lütfen 15 dakika sonra tekrar deneyin.",
        },
        { status: 429 },
      )
    }

    console.log(`LinkedIn scraping başlatılıyor: ${email}, derece: ${degree}`)

    try {
      // LinkedIn'e giriş yap ve bağlantıları çek
      const connections = await scrapeLinkedInConnections(email, password, degree, connectionId)

      return NextResponse.json({
        success: true,
        connections,
        timestamp: new Date().toISOString(),
        degree,
        connectionName: connectionName || null,
      })
    } catch (error) {
      console.error("LinkedIn scraping hatası:", error.message)

      // LinkedIn'in CSV export özelliğini kullanmayı öneren mock veri döndür
      return NextResponse.json({
        error: error.message || "LinkedIn bağlantıları çekilemedi",
        suggestion: "LinkedIn'in CSV export özelliğini kullanmanızı öneririz",
        timestamp: new Date().toISOString(),
        success: false,
        mockData: true,
        connections: generateMockConnections(15),
      })
    }
  } catch (error) {
    console.error("API hatası:", error)

    return NextResponse.json(
      {
        error: error.message || "LinkedIn bağlantıları çekilemedi",
        suggestion: "Lütfen daha sonra tekrar deneyin veya CSV import özelliğini kullanın",
        timestamp: new Date().toISOString(),
        success: false,
      },
      { status: 500 },
    )
  }
}

// Rate limiting kontrolü
function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT.windowMs

  // IP için istekleri al veya yeni bir dizi oluştur
  const requests = RATE_LIMIT.requests.get(ip) || []

  // Zaman penceresi içindeki istekleri filtrele
  const recentRequests = requests.filter((time) => time > windowStart)

  // Yeni isteği ekle
  recentRequests.push(now)
  RATE_LIMIT.requests.set(ip, recentRequests)

  // Rate limit kontrolü
  return recentRequests.length > RATE_LIMIT.maxRequests
}

// LinkedIn'e giriş yapma ve bağlantıları çekme
async function scrapeLinkedInConnections(
  email: string,
  password: string,
  degree = 1,
  connectionId?: string,
): Promise<any[]> {
  // Rastgele bir user agent seç
  const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]

  // Ortak HTTP başlıkları
  const headers = {
    "User-Agent": userAgent,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0",
  }

  try {
    // Adım 1: LinkedIn giriş sayfasını yükle
    console.log("LinkedIn giriş sayfası yükleniyor...")
    const loginPageResponse = await fetch("https://www.linkedin.com/login", {
      method: "GET",
      headers,
    })

    if (!loginPageResponse.ok) {
      throw new Error(`LinkedIn giriş sayfası yüklenemedi: ${loginPageResponse.status}`)
    }

    const loginPageHtml = await loginPageResponse.text()
    const $ = cheerio.load(loginPageHtml)

    // CSRF token'ı bul
    const csrfToken = $('input[name="csrfToken"]').val() as string
    if (!csrfToken) {
      throw new Error("CSRF token bulunamadı")
    }

    // Çerezleri al
    const cookies = parseCookies(loginPageResponse.headers.get("set-cookie") || "")

    // Adım 2: Giriş formunu gönder
    console.log("LinkedIn'e giriş yapılıyor...")
    const loginResponse = await fetch("https://www.linkedin.com/checkpoint/lg/login-submit", {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: formatCookies(cookies),
      },
      body: new URLSearchParams({
        session_key: email,
        session_password: password,
        csrfToken: csrfToken,
        loginCsrfParam: csrfToken,
      }).toString(),
      redirect: "follow", // Yönlendirmeleri otomatik takip et
    })

    console.log("Login response status:", loginResponse.status)
    console.log("Login response URL:", loginResponse.url)

    // 303 yönlendirmesi veya diğer yönlendirmeler için
    if (loginResponse.status === 303 || loginResponse.status === 302 || loginResponse.status === 301) {
      const redirectUrl = loginResponse.headers.get("location")
      console.log("Redirecting to:", redirectUrl)

      if (!redirectUrl) {
        throw new Error("Yönlendirme URL'si bulunamadı")
      }

      // Yönlendirme çerezlerini al
      const redirectCookies = parseCookies(loginResponse.headers.get("set-cookie") || "")
      const allCookies = { ...cookies, ...redirectCookies }

      // Yönlendirme URL'sine git
      const redirectResponse = await fetch(
        redirectUrl.startsWith("http") ? redirectUrl : `https://www.linkedin.com${redirectUrl}`,
        {
          method: "GET",
          headers: {
            ...headers,
            Cookie: formatCookies(allCookies),
          },
          redirect: "follow",
        },
      )

      // Yeni çerezleri ekle
      const newCookies = parseCookies(redirectResponse.headers.get("set-cookie") || "")
      Object.assign(allCookies, newCookies)

      // Giriş başarılı mı kontrol et
      if (!allCookies["li_at"] && !allCookies["JSESSIONID"]) {
        const redirectHtml = await redirectResponse.text()

        if (redirectHtml.includes("captcha") || redirectHtml.includes("CAPTCHA")) {
          throw new Error("LinkedIn CAPTCHA doğrulaması gerektiriyor")
        }

        if (redirectHtml.includes("challenge") || redirectHtml.includes("verification")) {
          throw new Error("LinkedIn ek doğrulama gerektiriyor")
        }

        if (redirectHtml.includes("error") || redirectHtml.includes("incorrect")) {
          throw new Error("LinkedIn giriş başarısız - geçersiz kimlik bilgileri")
        }

        throw new Error("LinkedIn giriş başarısız - bilinmeyen hata")
      }

      // Adım 3: Bağlantılar sayfasını yükle
      console.log("Bağlantılar sayfası yükleniyor...")
      let connectionsUrl = "https://www.linkedin.com/mynetwork/invite-connect/connections/"

      // İkinci derece bağlantılar için
      if (degree === 2 && connectionId) {
        // Profil URL'si mi yoksa ID mi kontrol et
        if (connectionId.startsWith("http")) {
          connectionsUrl = `${connectionId}/connections/`
        } else {
          connectionsUrl = `https://www.linkedin.com/in/${connectionId}/connections/`
        }
      }

      const connectionsResponse = await fetch(connectionsUrl, {
        method: "GET",
        headers: {
          ...headers,
          Cookie: formatCookies(allCookies),
        },
      })

      if (!connectionsResponse.ok) {
        throw new Error(`Bağlantılar sayfası yüklenemedi: ${connectionsResponse.status}`)
      }

      const connectionsHtml = await connectionsResponse.text()

      // Oturum hala açık mı kontrol et
      if (connectionsHtml.includes("login") && connectionsHtml.includes("session_password")) {
        throw new Error("LinkedIn oturumu sona erdi")
      }

      // Adım 4: Bağlantıları HTML'den çıkar
      console.log("Bağlantılar çıkarılıyor...")
      const connections = extractConnectionsFromHtml(connectionsHtml)

      console.log(`${connections.length} bağlantı başarıyla çıkarıldı`)
      return connections
    } else if (loginResponse.ok) {
      // Başarılı giriş, çerezleri al
      const responseCookies = parseCookies(loginResponse.headers.get("set-cookie") || "")
      const allCookies = { ...cookies, ...responseCookies }

      // Giriş başarılı mı kontrol et
      if (!allCookies["li_at"] && !allCookies["JSESSIONID"]) {
        const loginResponseHtml = await loginResponse.text()

        if (loginResponseHtml.includes("captcha") || loginResponseHtml.includes("CAPTCHA")) {
          throw new Error("LinkedIn CAPTCHA doğrulaması gerektiriyor")
        }

        if (loginResponseHtml.includes("challenge") || loginResponseHtml.includes("verification")) {
          throw new Error("LinkedIn ek doğrulama gerektiriyor")
        }

        throw new Error("LinkedIn giriş başarısız - geçersiz kimlik bilgileri")
      }

      // Adım 3: Bağlantılar sayfasını yükle
      console.log("Bağlantılar sayfası yükleniyor...")
      let connectionsUrl = "https://www.linkedin.com/mynetwork/invite-connect/connections/"

      // İkinci derece bağlantılar için
      if (degree === 2 && connectionId) {
        // Profil URL'si mi yoksa ID mi kontrol et
        if (connectionId.startsWith("http")) {
          connectionsUrl = `${connectionId}/connections/`
        } else {
          connectionsUrl = `https://www.linkedin.com/in/${connectionId}/connections/`
        }
      }

      const connectionsResponse = await fetch(connectionsUrl, {
        method: "GET",
        headers: {
          ...headers,
          Cookie: formatCookies(allCookies),
        },
      })

      if (!connectionsResponse.ok) {
        throw new Error(`Bağlantılar sayfası yüklenemedi: ${connectionsResponse.status}`)
      }

      const connectionsHtml = await connectionsResponse.text()

      // Oturum hala açık mı kontrol et
      if (connectionsHtml.includes("login") && connectionsHtml.includes("session_password")) {
        throw new Error("LinkedIn oturumu sona erdi")
      }

      // Adım 4: Bağlantıları HTML'den çıkar
      console.log("Bağlantılar çıkarılıyor...")
      const connections = extractConnectionsFromHtml(connectionsHtml)

      console.log(`${connections.length} bağlantı başarıyla çıkarıldı`)
      return connections
    } else {
      throw new Error(`LinkedIn giriş başarısız: ${loginResponse.status}`)
    }
  } catch (error) {
    console.error("LinkedIn scraping hatası:", error)
    throw error
  }
}

// HTML'den bağlantıları çıkarma
function extractConnectionsFromHtml(html: string): any[] {
  const connections: any[] = []
  const $ = cheerio.load(html)

  // Farklı seçicileri dene (LinkedIn'in HTML yapısı değişebilir)
  const selectors = [
    ".mn-connection-card",
    ".connection-card",
    ".search-result",
    "[data-test-connection]",
    ".entity-result",
    ".scaffold-finite-scroll__content > .relative", // Yeni LinkedIn yapısı
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

  // Bağlantı bulunamadıysa, JavaScript ile yüklenen içerik olabilir
  if (connections.length === 0) {
    // JavaScript ile yüklenen içerik için veri çıkarma denemesi
    try {
      // LinkedIn'in sayfa içinde JSON veri yapısını ara
      const dataRegex = /\{"data":\{.*\}\}/g
      const matches = html.match(dataRegex)

      if (matches && matches.length > 0) {
        matches.forEach((match) => {
          try {
            const data = JSON.parse(match)

            // LinkedIn veri yapısında bağlantıları bul
            if (data.data && data.data.connections) {
              data.data.connections.forEach((conn) => {
                if (conn.firstName && conn.lastName) {
                  connections.push({
                    name: `${conn.firstName} ${conn.lastName}`,
                    title: conn.occupation || undefined,
                    company: conn.company || undefined,
                    location: conn.location || undefined,
                    profileUrl: conn.profileUrl || undefined,
                    id: conn.memberId || undefined,
                  })
                }
              })
            }
          } catch (e) {
            console.error("JSON ayrıştırma hatası:", e)
          }
        })
      }
    } catch (error) {
      console.error("JavaScript veri çıkarma hatası:", error)
    }
  }

  return connections
}

// Çerezleri ayrıştırma
function parseCookies(setCookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {}

  setCookieHeader.split(",").forEach((cookieString) => {
    const parts = cookieString.split(";")[0].trim().split("=")
    if (parts.length >= 2) {
      const name = parts[0]
      const value = parts.slice(1).join("=")
      cookies[name] = value
    }
  })

  return cookies
}

// Çerezleri formatlama
function formatCookies(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ")
}

// Mock bağlantılar oluştur
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
