/**
 * Cookie validation and formatting utilities for ScrapingBee
 * ScrapingBee expects cookies in format: "name1=value1;name2=value2" (no spaces)
 */

export interface CookieValidationResult {
  isValid: boolean
  formatted: string
  errors: string[]
}

export function validateAndFormatCookies(cookies: string | Record<string, string>): CookieValidationResult {
  const errors: string[] = []
  let formatted = ""

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
        return { isValid: false, formatted: "", errors }
      }

      formatted = pairs.join(";")
    } else if (typeof cookies === "string") {
      // Validate and format string cookies
      if (!cookies.trim()) {
        errors.push("Cookie string is empty")
        return { isValid: false, formatted: "", errors }
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

          const [name, value] = trimmed.split("=")
          if (!name || !value) {
            errors.push(`Invalid cookie pair: ${trimmed}`)
            return false
          }

          return true
        })
        .map((pair) => pair.trim())

      if (pairs.length === 0) {
        errors.push("No valid cookie pairs found in string")
        return { isValid: false, formatted: "", errors }
      }

      formatted = pairs.join(";") // No spaces after semicolons
    } else {
      errors.push(`Invalid cookie type: ${typeof cookies}`)
      return { isValid: false, formatted: "", errors }
    }

    // Final validation
    if (!formatted.includes("=")) {
      errors.push("Formatted cookie string does not contain any valid pairs")
      return { isValid: false, formatted: "", errors }
    }

    return {
      isValid: errors.length === 0,
      formatted,
      errors,
    }
  } catch (error) {
    errors.push(`Exception during validation: ${error.message}`)
    return { isValid: false, formatted: "", errors }
  }
}

export function extractLinkedInCookies(cookieString: string): Record<string, string> {
  const importantCookies = ["li_at", "JSESSIONID", "liap", "lang", "bcookie", "bscookie"]
  const cookieMap: Record<string, string> = {}

  cookieString.split(/;\s*/).forEach((cookie) => {
    const [name, value] = cookie.split("=")
    if (name && value && importantCookies.includes(name)) {
      cookieMap[name] = value
    }
  })

  return cookieMap
}

export function hasRequiredLinkedInCookies(cookies: string): boolean {
  return cookies.includes("li_at=") || cookies.includes("JSESSIONID=")
}
