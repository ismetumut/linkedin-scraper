/**
 * Enhanced cookie validation and formatting utilities
 * Addresses the root cause of invalid cookie format errors
 */

export interface CookieValidationResult {
  isValid: boolean
  formatted: string
  errors: string[]
  authCookies: {
    hasLiAt: boolean
    hasJSESSIONID: boolean
  }
}

export function validateAndFormatCookies(cookies: string | Record<string, string>): CookieValidationResult {
  const errors: string[] = []
  let formatted = ""
  const authCookies = {
    hasLiAt: false,
    hasJSESSIONID: false,
  }

  try {
    if (typeof cookies === "object" && cookies !== null) {
      // Convert object to string
      const pairs = Object.entries(cookies)
        .filter(([name, value]) => {
          if (!name || !value) {
            errors.push(`Invalid cookie pair: ${name}=${value}`)
            return false
          }
          return true
        })
        .map(([name, value]) => `${name}=${value}`)

      if (pairs.length === 0) {
        errors.push("No valid cookie pairs found in object")
        return { isValid: false, formatted: "", errors, authCookies }
      }

      formatted = pairs.join(";") // No spaces after semicolons for ScrapingBee
    } else if (typeof cookies === "string") {
      // Validate and format string cookies
      if (!cookies.trim()) {
        errors.push("Cookie string is empty")
        return { isValid: false, formatted: "", errors, authCookies }
      }

      // Split by semicolon and validate each pair
      const pairs = cookies
        .split(/;\s*/) // Split by semicolon with optional spaces
        .filter((pair) => {
          const trimmed = pair.trim()
          if (!trimmed) return false

          if (!trimmed.includes("=")) {
            errors.push(`Invalid cookie format (missing =): ${trimmed}`)
            return false
          }

          const [name, value] = trimmed.split("=", 2) // Limit to 2 parts to handle values with =
          if (!name || value === undefined) {
            errors.push(`Invalid cookie pair: ${trimmed}`)
            return false
          }

          return true
        })
        .map((pair) => {
          const [name, ...valueParts] = pair.trim().split("=")
          // Join value parts in case the value contains = characters
          return `${name}=${valueParts.join("=")}`
        })

      if (pairs.length === 0) {
        errors.push("No valid cookie pairs found in string")
        return { isValid: false, formatted: "", errors, authCookies }
      }

      formatted = pairs.join(";") // No spaces after semicolons for ScrapingBee
    } else {
      errors.push(`Invalid cookie type: ${typeof cookies}`)
      return { isValid: false, formatted: "", errors, authCookies }
    }

    // Check for authentication cookies
    authCookies.hasLiAt = formatted.includes("li_at=")
    authCookies.hasJSESSIONID = formatted.includes("JSESSIONID=")

    // Final validation
    if (!formatted.includes("=")) {
      errors.push("Formatted cookie string does not contain any valid pairs")
      return { isValid: false, formatted: "", errors, authCookies }
    }

    return {
      isValid: errors.length === 0 && (authCookies.hasLiAt || authCookies.hasJSESSIONID),
      formatted,
      errors,
      authCookies,
    }
  } catch (error) {
    errors.push(`Exception during validation: ${error.message}`)
    return { isValid: false, formatted: "", errors, authCookies }
  }
}

/**
 * Extracts important LinkedIn cookies from a cookie string
 * LinkedIn requires specific cookies for authentication
 */
export function extractLinkedInCookies(cookieString: string): Record<string, string> {
  // These are the critical cookies for LinkedIn authentication
  const importantCookies = [
    "li_at", // Primary auth token
    "JSESSIONID", // Session ID
    "liap", // LinkedIn API
    "li_mc", // Member cookie
    "bcookie", // Browser ID
    "bscookie", // Secure browser ID
    "lang", // Language preference
    "lidc", // LinkedIn Data consent
  ]

  const cookieMap: Record<string, string> = {}

  cookieString.split(/;\s*/).forEach((cookie) => {
    const [name, ...valueParts] = cookie.split("=")
    const value = valueParts.join("=") // Handle values containing = character

    if (name && value && (importantCookies.includes(name) || name.startsWith("li_"))) {
      cookieMap[name] = value
    }
  })

  return cookieMap
}

/**
 * Checks if the cookie string contains the required authentication cookies
 */
export function hasRequiredLinkedInCookies(cookies: string): boolean {
  return cookies.includes("li_at=") || cookies.includes("JSESSIONID=")
}

/**
 * Formats cookies for ScrapingBee which requires a specific format
 * This is critical as ScrapingBee rejects cookies with spaces after semicolons
 */
export function formatCookiesForScrapingBee(cookies: string | Record<string, string>): string {
  if (typeof cookies === "object" && cookies !== null) {
    return Object.entries(cookies)
      .filter(([name, value]) => name && value)
      .map(([name, value]) => `${name}=${value}`)
      .join(";") // No spaces after semicolons
  }

  if (typeof cookies === "string") {
    return cookies
      .split(/;\s*/) // Split by semicolon with optional spaces
      .filter((pair) => pair.includes("="))
      .map((pair) => pair.trim())
      .join(";") // No spaces after semicolons
  }

  return ""
}
