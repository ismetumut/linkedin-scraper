# LinkedIn Login Troubleshooting Guide

## Common Issues and Solutions

### 1. CSRF Token Extraction Failure

**Symptoms:**
- Error: "Could not extract CSRF token"
- Login page loads but token parsing fails

**Possible Causes:**
- LinkedIn changed their HTML structure
- ScrapingBee is being blocked
- Page is not fully loaded

**Solutions:**
\`\`\`typescript
// Try multiple extraction methods:
// Method 1: Standard input field
const csrfTokenMatch = html.match(/name="csrfToken"\s+value="([^"]+)"/)

// Method 2: JavaScript variable
const csrfTokenMatch2 = html.match(/csrfToken["']\s*:\s*["']([^"']+)["']/)

// Method 3: Hidden field with different quotes
const csrfTokenMatch3 = html.match(/name=["']csrfToken["']\s+value=["']([^"']+)["']/)
\`\`\`

### 2. Authentication Cookie Issues

**Symptoms:**
- Error: "No authentication cookies received"
- Login appears successful but no li_at or JSESSIONID cookie

**Possible Causes:**
- Incorrect credentials
- LinkedIn security challenge
- Cookie parsing issues

**Solutions:**
1. Verify credentials are correct
2. Check for CAPTCHA or verification requirements
3. Use manual cookie import method

### 3. ScrapingBee Configuration

**Required Parameters:**
\`\`\`javascript
{
  api_key: SCRAPINGBEE_API_KEY,
  url: targetUrl,
  render_js: "false", // LinkedIn doesn't need JS rendering for login
  premium_proxy: "true", // Required for LinkedIn
  country_code: "us", // Use consistent country
  cookies: existingCookies, // Include any existing cookies
  return_page_source: "true", // Get full HTML response
  wait: "1000-2000", // Wait for page to stabilize
  custom_google: "true" // Use Google Chrome user agent
}
\`\`\`

### 4. Rate Limiting and Blocking

**Symptoms:**
- Frequent CAPTCHA challenges
- IP blocks
- 429 or 403 errors

**Solutions:**
1. Add delays between requests (2-5 seconds)
2. Use premium proxies with ScrapingBee
3. Rotate user agents
4. Limit login attempts per hour

### 5. Manual Cookie Import Alternative

If automated login fails, use manual cookie import:

1. Log into LinkedIn manually in your browser
2. Open Developer Tools (F12)
3. Go to Application > Cookies
4. Copy the following cookies:
   - li_at
   - JSESSIONID
   - bcookie
   - bscookie
5. Format as: `li_at=VALUE;JSESSIONID=VALUE;bcookie=VALUE`
6. Use the manual cookie import endpoint

### 6. Debug Mode

Enable debug mode to get detailed information:

\`\`\`typescript
const DEBUG_MODE = true // Set in API route

// Response will include:
{
  success: false,
  error: "Error message",
  debug: {
    timestamp: "2024-01-25T10:00:00Z",
    steps: [...], // Detailed execution steps
    errors: [...] // Specific error information
  }
}
\`\`\`

### 7. Testing Individual Components

Use these endpoints to test each part:

1. `/api/test-scrapingbee` - Test ScrapingBee connection
2. `/api/test-login-flow` - Test complete login flow
3. `/api/manual-cookie-login` - Test manual cookie import
4. `/api/debug-cheerio` - Test HTML parsing

### 8. LinkedIn-Specific Challenges

**Two-Factor Authentication:**
- Not supported by automated login
- Use manual cookie import instead

**Security Checkpoints:**
- LinkedIn may require email/SMS verification
- Complete verification manually, then use cookies

**Geographic Restrictions:**
- Use consistent country_code in ScrapingBee
- Match the country of your LinkedIn account

## Recommended Approach

1. **Start with Manual Cookie Import:**
   - Most reliable method
   - Bypasses all security challenges
   - Cookies last 1-2 months

2. **Use Automated Login as Backup:**
   - For fresh sessions
   - When cookies expire
   - For testing purposes

3. **Monitor and Log:**
   - Enable debug mode
   - Check Vercel logs
   - Track success/failure rates

4. **Implement Fallbacks:**
   - Try automated login first
   - Fall back to manual cookie prompt
   - Provide clear error messages
