"use client"

import { useState } from "react"

interface ManualCookieImportProps {
  onCookiesImported: (cookies: string) => void
}

export default function ManualCookieImport({ onCookiesImported }: ManualCookieImportProps) {
  const [cookies, setCookies] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleImport = async () => {
    if (!cookies.trim()) {
      setError("Please enter LinkedIn cookies")
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch("/api/manual-cookie-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cookies }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Failed to import cookies")
        return
      }

      setSuccess("Cookies imported successfully!")
      onCookiesImported(data.cookies)

      // Store in localStorage for future use
      localStorage.setItem("linkedinCookies", data.cookies)
    } catch (err) {
      setError("An error occurred while importing cookies")
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="text-lg font-medium mb-3">Manual Cookie Import</h3>

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-2">
          When automated login fails due to CAPTCHA or verification requirements, you can manually import your LinkedIn
          cookies:
        </p>
        <ol className="text-sm text-gray-700 list-decimal list-inside space-y-1">
          <li>Log into LinkedIn in your browser</li>
          <li>Open Developer Tools (F12 or right-click → Inspect)</li>
          <li>Go to Application → Cookies → linkedin.com</li>
          <li>Find and copy the values of these cookies: li_at, JSESSIONID, liap</li>
          <li>Format as: li_at=VALUE;JSESSIONID=VALUE;liap=VALUE</li>
        </ol>
      </div>

      <div className="mb-4">
        <label htmlFor="cookies" className="block text-sm font-medium text-gray-700 mb-1">
          LinkedIn Cookies
        </label>
        <textarea
          id="cookies"
          value={cookies}
          onChange={(e) => setCookies(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          rows={3}
          placeholder="li_at=VALUE;JSESSIONID=VALUE;liap=VALUE"
        />
      </div>

      {error && <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}

      {success && (
        <div className="mb-4 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">{success}</div>
      )}

      <button
        onClick={handleImport}
        disabled={isLoading}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isLoading ? "Importing..." : "Import Cookies"}
      </button>
    </div>
  )
}
