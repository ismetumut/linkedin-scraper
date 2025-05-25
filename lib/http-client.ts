import fetch from "node-fetch"
import * as cheerio from "cheerio"
import { delayManager } from "./delay-manager"
import { userAgentManager } from "./user-agent-manager"
import { logger } from "./logger"

interface RequestOptions {
  method?: string
  headers?: Record<string, string>
  body?: any
  cookies?: string
  timeout?: number
  followRedirects?: boolean
}

interface LinkedInConnection {
  name: string
  title?: string
  company?: string
  location?: string
  profileUrl?: string
  id?: string
  mutualConnections?: number
}

class HttpClient {
  private defaultTimeout = 30000 // 30 seconds

  async request(url: string, options: RequestOptions = {}) {
    const {
      method = "GET",
      headers = {},
      body,
      cookies,
      timeout = this.defaultTimeout,
      followRedirects = true,
    } = options

    // Apply random delay before request
    await delayManager.randomDelay()

    // Get a random user agent
    const userAgent = userAgentManager.getRandomUserAgent()

    // Prepare headers with anti-detection measures
    const requestHeaders: Record<string, string> = {
      "User-Agent": userAgent,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": "Windows",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
      Referer: "https://www.linkedin.com/",
      ...headers,
    }

    // Add cookies if provided
    if (cookies) {
      requestHeaders["Cookie"] = cookies
    }

    // Create AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const requestOptions: any = {
        method,
        headers: requestHeaders,
        redirect: followRedirects ? "follow" : "manual",
        signal: controller.signal,
      }

      // Add body if provided
      if (body) {
        if (typeof body === "object") {
          requestHeaders["Content-Type"] = "application/json"
          requestOptions.body = JSON.stringify(body)
        } else {
          requestOptions.body = body
        }
      }

      logger.info(`Making ${method} request to ${url}`, {
        url,
        method,
        userAgent: userAgent.substring(0, 30) + "...",
      })

      const response = await fetch(url, requestOptions)

      // Extract and store cookies
      const setCookieHeader = response.headers.get("set-cookie")
      const responseCookies = setCookieHeader ? this.parseCookies(setCookieHeader) : null

      // Get response data
      const contentType = response.headers.get("content-type") || ""
      let data

      if (contentType.includes("application/json")) {
        data = await response.json()
      } else if (contentType.includes("text/html")) {
        data = await response.text()
      } else {
        data = await response.text()
      }

      return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        cookies: responseCookies,
        data,
        url: response.url,
      }
    } catch (error) {
      if (error.name === "AbortError") {
        throw new Error(`Request to ${url} timed out after ${timeout}ms`)
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  private parseCookies(setCookieHeader: string): Record<string, string> {
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

  formatCookies(cookies: Record<string, string>): string {
    return Object.entries(cookies)
      .map(([name, value]) => `${name}=${value}`)
      .join("; ")
  }

  async loginToLinkedIn(email: string, password: string): Promise<Record<string, string> | null> {
    logger.info("Attempting to login to LinkedIn", { email })

    try {
      // Step 1: Get the login page to obtain CSRF token
      const loginPageResponse = await this.request("https://www.linkedin.com/login")

      if (loginPageResponse.status !== 200) {
        throw new Error(`Failed to load LinkedIn login page: ${loginPageResponse.status}`)
      }

      const $ = cheerio.load(loginPageResponse.data as string)
      const csrfToken = $('input[name="csrfToken"]').val() as string

      if (!csrfToken) {
        throw new Error("Could not find CSRF token on LinkedIn login page")
      }

      // Get initial cookies
      const initialCookies = loginPageResponse.cookies || {}

      // Step 2: Submit login form
      const loginResponse = await this.request("https://www.linkedin.com/checkpoint/lg/login-submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: this.formatCookies(initialCookies),
        },
        body: new URLSearchParams({
          session_key: email,
          session_password: password,
          csrfToken: csrfToken,
          loginCsrfParam: csrfToken,
        }).toString(),
      })

      // Check for successful login
      if (loginResponse.status === 200 || loginResponse.status === 302) {
        const allCookies = {
          ...initialCookies,
          ...(loginResponse.cookies || {}),
        }

        // Verify login success by checking for specific cookies
        if (allCookies["li_at"] || allCookies["JSESSIONID"]) {
          logger.info("LinkedIn login successful", { email })
          return allCookies
        }
      }

      // Check for CAPTCHA or verification
      if (loginResponse.data && typeof loginResponse.data === "string") {
        if (loginResponse.data.includes("captcha") || loginResponse.data.includes("CAPTCHA")) {
          throw new Error("LinkedIn login requires CAPTCHA verification")
        }

        if (loginResponse.data.includes("challenge") || loginResponse.data.includes("verification")) {
          throw new Error("LinkedIn requires additional verification")
        }
      }

      throw new Error("LinkedIn login failed - invalid credentials")
    } catch (error) {
      logger.error("LinkedIn login error", { error: error.message, email })
      throw error
    }
  }

  async getLinkedInConnections(cookies: Record<string, string>): Promise<LinkedInConnection[]> {
    logger.info("Fetching LinkedIn connections")

    try {
      // Format cookies for request
      const cookieString = this.formatCookies(cookies)

      // Request connections page
      const response = await this.request("https://www.linkedin.com/mynetwork/invite-connect/connections/", {
        cookies: cookieString,
      })

      if (response.status !== 200) {
        throw new Error(`Failed to load connections page: ${response.status}`)
      }

      const html = response.data as string

      // Check if we're still logged in
      if (html.includes("login") && html.includes("session_password")) {
        throw new Error("LinkedIn session expired")
      }

      // Parse connections from HTML
      const connections = this.parseConnectionsFromHtml(html)

      logger.info(`Successfully extracted ${connections.length} LinkedIn connections`)
      return connections
    } catch (error) {
      logger.error("Error fetching LinkedIn connections", { error: error.message })
      throw error
    }
  }

  async getSecondDegreeConnections(
    cookies: Record<string, string>,
    connectionId: string,
  ): Promise<LinkedInConnection[]> {
    logger.info("Fetching second-degree connections", { connectionId })

    try {
      // Format cookies for request
      const cookieString = this.formatCookies(cookies)

      // First get the profile page
      const profileUrl = connectionId.startsWith("http") ? connectionId : `https://www.linkedin.com/in/${connectionId}`

      const profileResponse = await this.request(profileUrl, { cookies: cookieString })

      if (profileResponse.status !== 200) {
        throw new Error(`Failed to load profile page: ${profileResponse.status}`)
      }

      // Parse HTML to find connections URL
      const profileHtml = profileResponse.data as string
      const $ = cheerio.load(profileHtml)

      // Look for connections link
      let connectionsUrl = ""
      $('a[href*="connections"]').each((_, element) => {
        const href = $(element).attr("href")
        if (href && href.includes("connections")) {
          connectionsUrl = href
          return false // break each loop
        }
      })

      if (!connectionsUrl) {
        logger.warn("No connections link found on profile page", { connectionId })
        return []
      }

      // Make sure URL is absolute
      if (!connectionsUrl.startsWith("http")) {
        connectionsUrl = `https://www.linkedin.com${connectionsUrl}`
      }

      // Fetch connections page
      const connectionsResponse = await this.request(connectionsUrl, { cookies: cookieString })

      if (connectionsResponse.status !== 200) {
        throw new Error(`Failed to load connections page: ${connectionsResponse.status}`)
      }

      const connectionsHtml = connectionsResponse.data as string

      // Parse connections from HTML
      const connections = this.parseConnectionsFromHtml(connectionsHtml)

      logger.info(`Successfully extracted ${connections.length} second-degree connections`, { connectionId })
      return connections
    } catch (error) {
      logger.error("Error fetching second-degree connections", {
        error: error.message,
        connectionId,
      })
      return [] // Return empty array instead of throwing for second-degree
    }
  }

  private parseConnectionsFromHtml(html: string): LinkedInConnection[] {
    const connections: LinkedInConnection[] = []
    const $ = cheerio.load(html)

    // Try multiple selector strategies for robustness
    const selectors = [
      ".mn-connection-card",
      ".connection-card",
      ".search-result",
      "[data-test-connection]",
      ".entity-result",
    ]

    selectors.forEach((selector) => {
      $(selector).each((_, element) => {
        try {
          // Extract name
          const nameElement = $(element).find(
            ".mn-connection-card__name, .connection-card__name, .search-result__result-link, [data-test-connection-name], .entity-result__title-text a",
          )
          const name = nameElement.text().trim()

          // Extract title
          const titleElement = $(element).find(
            ".mn-connection-card__occupation, .connection-card__occupation, .subline-level-1, [data-test-connection-occupation], .entity-result__primary-subtitle",
          )
          const title = titleElement.text().trim()

          // Extract company
          const companyElement = $(element).find(".entity-result__secondary-subtitle")
          const company = companyElement.text().trim()

          // Extract profile URL
          const linkElement = $(element).find('a[href*="/in/"]')
          const profileUrl = linkElement.attr("href") || ""

          // Extract ID from URL
          const id = profileUrl.split("/in/")[1]?.split("/")[0] || ""

          if (name) {
            connections.push({
              name,
              title: title || undefined,
              company: company || undefined,
              profileUrl: profileUrl.startsWith("http") ? profileUrl : `https://www.linkedin.com${profileUrl}`,
              id,
            })
          }
        } catch (error) {
          logger.error("Error parsing connection element", { error: error.message })
        }
      })
    })

    return connections
  }
}

export const httpClient = new HttpClient()
