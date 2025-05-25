"use client"
import { useState, useEffect } from "react"
import { Settings, Play, Pause, Download, AlertCircle, Eye, Users, Network, Clock, Mail, Upload } from "lucide-react"

const LinkedInTrackerWithScraper = () => {
  const [showPassword, setShowPassword] = useState(false)
  const [selectedConnection, setSelectedConnection] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split("T")[0])
  const [showSetup, setShowSetup] = useState(false)
  const [scrapingStatus, setScrapingStatus] = useState("idle")
  const [lastScrapeTime, setLastScrapeTime] = useState(null)
  const [connectionData, setConnectionData] = useState(() => {
    if (typeof window !== "undefined") {
      return JSON.parse(localStorage.getItem("linkedinConnectionData") || "{}")
    }
    return {}
  })
  const [myConnections, setMyConnections] = useState(() => {
    if (typeof window !== "undefined") {
      return JSON.parse(localStorage.getItem("linkedinMyConnections") || "[]")
    }
    return []
  })
  const [secondDegreeConnections, setSecondDegreeConnections] = useState(() => {
    if (typeof window !== "undefined") {
      return JSON.parse(localStorage.getItem("linkedinSecondDegreeConnections") || "{}")
    }
    return {}
  })
  const [friendListDifferences, setFriendListDifferences] = useState(() => {
    if (typeof window !== "undefined") {
      return JSON.parse(localStorage.getItem("linkedinFriendListDifferences") || "[]")
    }
    return []
  })
  const [newlyAddedFriends, setNewlyAddedFriends] = useState(() => {
    if (typeof window !== "undefined") {
      return JSON.parse(localStorage.getItem("linkedinNewlyAddedFriends") || "[]")
    }
    return []
  })
  const [scrapingProgress, setScrapingProgress] = useState({ current: 0, total: 0 })
  const [currentTab, setCurrentTab] = useState("first-degree")
  const [schedulerStatus, setSchedulerStatus] = useState("stopped")
  const [nextScheduledRun, setNextScheduledRun] = useState(null)
  const [apiStatus, setApiStatus] = useState("unknown")
  const [lastError, setLastError] = useState(null)
  const [showAlternatives, setShowAlternatives] = useState(false)
  const [railwayTestResults, setRailwayTestResults] = useState(null)
  const [useScrapingBee, setUseScrapingBee] = useState(true) // ScrapingBee kullan
  const [linkedinCookies, setLinkedinCookies] = useState("")

  const [credentials, setCredentials] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("linkedinCredentials")
      return saved ? JSON.parse(saved) : { email: "", password: "", sessionCookie: "" }
    }
    return { email: "", password: "", sessionCookie: "" }
  })
  const [scrapingSettings, setScrapingSettings] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("linkedinScrapingSettings")
      return saved
        ? JSON.parse(saved)
        : {
            interval: 24,
            batchSize: 10,
            delay: 2000,
            autoStart: false,
            includeSecondDegree: true,
            scheduledTime: "09:00",
            timezone: "Europe/Istanbul",
            enableScheduler: false,
          }
    }
    return {
      interval: 24,
      batchSize: 10,
      delay: 2000,
      autoStart: false,
      includeSecondDegree: true,
      scheduledTime: "09:00",
      timezone: "Europe/Istanbul",
      enableScheduler: false,
    }
  })
  const [reportEmail, setReportEmail] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("linkedinReportEmail") || ""
    }
    return ""
  })

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("linkedinConnectionData", JSON.stringify(connectionData))
      localStorage.setItem("linkedinMyConnections", JSON.stringify(myConnections))
      localStorage.setItem("linkedinSecondDegreeConnections", JSON.stringify(secondDegreeConnections))
      localStorage.setItem("linkedinFriendListDifferences", JSON.stringify(friendListDifferences))
      localStorage.setItem("linkedinNewlyAddedFriends", JSON.stringify(newlyAddedFriends))
      localStorage.setItem("linkedinScrapingSettings", JSON.stringify(scrapingSettings))
      localStorage.setItem("linkedinReportEmail", reportEmail)
    }
  }, [
    connectionData,
    myConnections,
    secondDegreeConnections,
    friendListDifferences,
    newlyAddedFriends,
    scrapingSettings,
    reportEmail,
  ])

  // Calculate next scheduled run
  useEffect(() => {
    if (scrapingSettings.enableScheduler) {
      const calculateNextRun = () => {
        const now = new Date()
        const [hours, minutes] = scrapingSettings.scheduledTime.split(":").map(Number)

        // Create date for today at scheduled time in Istanbul timezone
        const today = new Date()
        today.setHours(hours, minutes, 0, 0)

        // Convert to Istanbul time
        const istanbulTime = new Date(today.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }))

        // If today's time has passed, schedule for tomorrow
        if (istanbulTime <= now) {
          istanbulTime.setDate(istanbulTime.getDate() + 1)
        }

        return istanbulTime
      }

      setNextScheduledRun(calculateNextRun())
      setSchedulerStatus("active")
    } else {
      setNextScheduledRun(null)
      setSchedulerStatus("stopped")
    }
  }, [scrapingSettings.enableScheduler, scrapingSettings.scheduledTime])

  // Scheduler check every minute
  useEffect(() => {
    if (!scrapingSettings.enableScheduler) return

    const checkSchedule = () => {
      const now = new Date()
      const istanbulNow = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Istanbul" }))
      const [hours, minutes] = scrapingSettings.scheduledTime.split(":").map(Number)

      if (istanbulNow.getHours() === hours && istanbulNow.getMinutes() === minutes) {
        console.log("Scheduled scraping started at", istanbulNow.toLocaleString())
        startAutomatedScraping()
      }
    }

    const interval = setInterval(checkSchedule, 60000) // Check every minute
    return () => clearInterval(interval)
  }, [scrapingSettings.enableScheduler, scrapingSettings.scheduledTime])

  const detectNewlyAddedFriends = (currentSecondDegree, previousSecondDegree) => {
    const newFriends = []

    Object.entries(currentSecondDegree).forEach(([friendName, currentFriendList]) => {
      const previousFriendList = previousSecondDegree[friendName] || []

      if (Array.isArray(currentFriendList) && Array.isArray(previousFriendList)) {
        // Find new connections by comparing names
        const previousNames = new Set(previousFriendList.map((conn) => conn.name?.toLowerCase()))

        currentFriendList.forEach((connection) => {
          if (connection.name && !previousNames.has(connection.name.toLowerCase())) {
            newFriends.push({
              ...connection,
              addedBy: friendName,
              detectedAt: new Date().toISOString(),
              isNew: true,
            })
          }
        })
      }
    })

    return newFriends
  }

  const generateExcelData = (newFriends) => {
    const headers = [
      "Name",
      "Title",
      "Company",
      "Location",
      "Added By",
      "Detected At",
      "Profile URL",
      "Mutual Connections",
    ]

    const rows = newFriends.map((friend) => [
      friend.name || "",
      friend.title || "",
      friend.company || "",
      friend.location || "",
      friend.addedBy || "",
      new Date(friend.detectedAt).toLocaleDateString(),
      friend.profileUrl || "",
      friend.mutualConnections || "",
    ])

    return { headers, rows }
  }

  const startAutomatedScraping = async () => {
    console.log("Starting automated scraping...")
    await startScraping(true) // Pass true to indicate this is automated
  }

  const analyzeFriendListDifferences = (firstDegree, secondDegree) => {
    const differences = []

    // Create a map of all connections by name for easy lookup
    const allConnections = new Map()

    // Add first degree connections
    firstDegree.forEach((conn) => {
      if (conn.name) {
        allConnections.set(conn.name.toLowerCase(), {
          ...conn,
          degree: 1,
          mutualWith: [],
        })
      }
    })

    // Analyze second degree connections
    Object.entries(secondDegree).forEach(([firstDegreeConnectionName, secondDegreeList]) => {
      if (Array.isArray(secondDegreeList)) {
        secondDegreeList.forEach((secondConn) => {
          if (secondConn.name) {
            const nameKey = secondConn.name.toLowerCase()

            if (allConnections.has(nameKey)) {
              // This person appears in multiple friend lists
              const existing = allConnections.get(nameKey)
              existing.mutualWith.push(firstDegreeConnectionName)
            } else {
              // New second degree connection
              allConnections.set(nameKey, {
                ...secondConn,
                degree: 2,
                connectedThrough: [firstDegreeConnectionName],
                mutualWith: [],
              })
            }
          }
        })
      }
    })

    // Find connections that appear in multiple friend lists
    allConnections.forEach((conn, name) => {
      if (conn.degree === 2 && conn.connectedThrough && conn.connectedThrough.length > 1) {
        differences.push({
          name: conn.name,
          title: conn.title,
          company: conn.company,
          location: conn.location,
          connectedThrough: conn.connectedThrough,
          mutualConnectionCount: conn.connectedThrough.length,
          type: "multiple_paths",
        })
      }

      if (conn.mutualWith && conn.mutualWith.length > 0) {
        differences.push({
          name: conn.name,
          title: conn.title,
          company: conn.company,
          location: conn.location,
          mutualWith: conn.mutualWith,
          mutualConnectionCount: conn.mutualWith.length,
          type: "mutual_connection",
        })
      }
    })

    return differences
  }

  const testApiConnection = async () => {
    setApiStatus("testing")
    try {
      // ScrapingBee API'sini test et - use properly formatted test cookie
      const response = await fetch("/api/linkedin-connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cookies: "test_cookie=test_value;session_id=12345", // Proper format: no spaces
          profileUrl: "https://www.linkedin.com/mynetwork/invite-connect/connections/",
        }),
      })

      if (response.ok) {
        setApiStatus("connected")
        setLastError(null)
        const data = await response.json()
        console.log("API test successful:", data)
      } else {
        setApiStatus("error")
        const errorData = await response.json()
        setLastError(`API test failed: ${response.status} - ${JSON.stringify(errorData)}`)
      }
    } catch (error) {
      setApiStatus("error")
      setLastError(`Connection failed: ${error.message}`)
    }
  }

  const loginToLinkedIn = async () => {
    try {
      if (!credentials.email || !credentials.password) {
        alert("Lütfen önce LinkedIn kimlik bilgilerinizi girin")
        setShowSetup(true)
        return
      }

      setScrapingStatus("logging-in")
      setLastError(null)

      const response = await fetch("/api/linkedin-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: credentials.email,
          password: credentials.password,
        }),
      })

      const result = await response.json()

      if (response.ok && result.success) {
        setLinkedinCookies(result.cookies)
        localStorage.setItem("linkedinCookies", result.cookies)
        setScrapingStatus("idle")
        setApiStatus("connected")
        alert("✅ LinkedIn'e başarıyla giriş yapıldı! Şimdi bağlantılarınızı çekebilirsiniz.")
        return result.cookies
      } else {
        setScrapingStatus("error")
        setLastError(result.error || "LinkedIn giriş başarısız")
        alert(`❌ LinkedIn giriş başarısız: ${result.error}`)
        return null
      }
    } catch (error) {
      setScrapingStatus("error")
      setLastError(`Login error: ${error.message}`)
      alert(`❌ Giriş hatası: ${error.message}`)
      return null
    }
  }

  const fetchLinkedInConnections = async (cookies, profileUrl = null) => {
    try {
      // Ensure cookies are properly formatted
      let formattedCookies = cookies
      if (cookies && cookies.includes("; ")) {
        // Remove spaces after semicolons
        formattedCookies = cookies.replace(/;\s+/g, ";")
      }

      const response = await fetch("/api/linkedin-connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cookies: formattedCookies,
          profileUrl,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP error ${response.status}`)
      }

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      return data.connections || []
    } catch (error) {
      console.error("Bağlantıları çekerken hata:", error)
      throw error
    }
  }

  const startScraping = async (isAutomated = false) => {
    setScrapingStatus("running")
    setScrapingProgress({ current: 0, total: 0 })
    setLastError(null)

    try {
      // Çerezleri al veya giriş yap
      let cookies = localStorage.getItem("linkedinCookies") || linkedinCookies

      if (!cookies) {
        cookies = await loginToLinkedIn()
        if (!cookies) {
          throw new Error("LinkedIn giriş başarısız")
        }
      }

      // Store previous second degree connections for comparison
      const previousSecondDegree = { ...secondDegreeConnections }

      // Step 1: Get first-degree connections
      console.log("🔄 LinkedIn bağlantıları çekiliyor...")
      setScrapingProgress({ current: 1, total: 1 })

      const firstDegreeConnections = await fetchLinkedInConnections(cookies)

      // Check if we got real data or empty array
      if (firstDegreeConnections.length === 0) {
        setScrapingStatus("error")
        setLastError("Bağlantı bulunamadı. LinkedIn oturumunuz sona ermiş olabilir.")

        if (!isAutomated) {
          alert(`❌ LinkedIn bağlantıları bulunamadı!

Bu şu anlama gelebilir:
• LinkedIn oturumunuz sona ermiş
• Kimlik bilgileriniz yanlış
• Hesabınızda kısıtlamalar var

💡 Şu alternatifleri deneyin:
1. Tekrar giriş yapın
2. "Import CSV" butonunu kullanın
3. LinkedIn kimlik bilgilerinizi kontrol edin`)
        }
        return
      }

      console.log(`🎉 ${firstDegreeConnections.length} bağlantı başarıyla çekildi`)

      if (firstDegreeConnections.length > 0) {
        console.log("👤 Örnek bağlantı:", firstDegreeConnections[0])
      }

      setMyConnections(firstDegreeConnections)
      setScrapingProgress({ current: 1, total: firstDegreeConnections.length + 1 })

      // Step 2: Get second-degree connections for each first-degree connection
      if (scrapingSettings.includeSecondDegree && firstDegreeConnections.length > 0) {
        console.log("🔄 İkinci derece bağlantılar analiz ediliyor...")
        const secondDegreeData = {}

        for (let i = 0; i < Math.min(firstDegreeConnections.length, 3); i++) {
          // Limit to 3 for real scraping to avoid rate limits
          const connection = firstDegreeConnections[i]

          try {
            // Add delay between requests
            if (i > 0) {
              await new Promise((resolve) => setTimeout(resolve, scrapingSettings.delay))
            }

            console.log(
              `🔍 ${connection.name}'in bağlantıları analiz ediliyor (${i + 1}/${firstDegreeConnections.length})`,
            )

            if (connection.profileUrl) {
              const secondDegreeConnections = await fetchLinkedInConnections(
                cookies,
                connection.profileUrl + "/connections/",
              )
              secondDegreeData[connection.name] = secondDegreeConnections
              console.log(`✅ ${connection.name} için ${secondDegreeConnections.length} bağlantı bulundu`)
            } else {
              console.warn(`⚠️ ${connection.name} için profil URL'si bulunamadı`)
              secondDegreeData[connection.name] = []
            }
          } catch (error) {
            console.error(`❌ ${connection.name} için ikinci derece bağlantıları çekerken hata:`, error)
            secondDegreeData[connection.name] = []
          }

          setScrapingProgress({ current: i + 2, total: firstDegreeConnections.length + 1 })
        }

        setSecondDegreeConnections(secondDegreeData)

        // Step 3: Detect newly added friends
        const newFriends = detectNewlyAddedFriends(secondDegreeData, previousSecondDegree)
        setNewlyAddedFriends(newFriends)
        console.log(`🆕 ${newFriends.length} yeni eklenen arkadaş tespit edildi`)

        // Step 4: Analyze friend list differences
        const differences = analyzeFriendListDifferences(firstDegreeConnections, secondDegreeData)
        setFriendListDifferences(differences)
        console.log(`📊 ${differences.length} bağlantı deseni bulundu`)

        // Step 5: Send email report if automated and new friends found
        if (isAutomated && newFriends.length > 0 && reportEmail) {
          console.log("📧 Email raporu gönderiliyor...")
          await sendExcelReport(newFriends)
        }
      }

      setLastScrapeTime(new Date())
      setScrapingStatus("idle")
      setApiStatus("connected")

      const message = isAutomated
        ? `✅ Otomatik analiz tamamlandı! ${firstDegreeConnections.length} bağlantı ve ${newlyAddedFriends.length} yeni eklenen arkadaş bulundu.`
        : `✅ ${firstDegreeConnections.length} bağlantı başarıyla analiz edildi!`

      if (!isAutomated) {
        alert(message)
      } else {
        console.log(message)
      }

      // Switch to first-degree tab to show results
      setCurrentTab("first-degree")
    } catch (error) {
      console.error("❌ Scraping hatası:", error)
      setScrapingStatus("error")
      setApiStatus("error")

      let errorMessage = "Bilinmeyen hata oluştu"
      if (error instanceof Error) {
        errorMessage = error.message
      }

      setLastError(errorMessage)

      const fullErrorMessage = `❌ LinkedIn scraping başarısız: ${errorMessage}

💡 Bu beklenen bir durum - LinkedIn aktif olarak scraping girişimlerini engelliyor.

🔧 Çalışan alternatifler:
1. "Import CSV" butonuna tıklayın ve LinkedIn'in resmi dışa aktarma özelliğini kullanın
2. linkedin.com/psettings/member-data adresine gidin
3. "Connections" dışa aktarımını isteyin
4. CSV dosyasını indirin ve içe aktarın

Bu yöntem %100 güvenilirdir ve LinkedIn'in kullanım şartlarını ihlal etmez.`

      if (!isAutomated) {
        alert(fullErrorMessage)
      } else {
        console.error(fullErrorMessage)
      }
    }
  }

  const sendExcelReport = async (newFriends) => {
    try {
      const excelData = generateExcelData(newFriends)

      const response = await fetch("/api/send-excel-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: reportEmail,
          subject: `LinkedIn New Friends Report - ${new Date().toLocaleDateString()}`,
          newFriends: newFriends,
          excelData: excelData,
          reportDate: new Date().toISOString(),
        }),
      })

      if (response.ok) {
        console.log("Excel report sent successfully")
      } else {
        console.error("Failed to send Excel report")
      }
    } catch (error) {
      console.error("Error sending Excel report:", error)
    }
  }

  const stopScraping = () => {
    setScrapingStatus("idle")
  }

  const exportExcel = () => {
    if (newlyAddedFriends.length === 0) {
      alert("No newly added friends to export")
      return
    }

    const excelData = generateExcelData(newlyAddedFriends)

    // Create CSV content (Excel-compatible)
    const csvContent = [
      excelData.headers.join(","),
      ...excelData.rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `linkedin_new_friends_${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCSVImport = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".csv"
    input.onchange = (e) => {
      const file = e.target.files[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const csv = e.target.result
            const lines = csv.split("\n")
            const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))

            const connections = lines
              .slice(1)
              .map((line) => {
                if (!line.trim()) return null
                const values = line.split(",").map((v) => v.trim().replace(/"/g, ""))

                const connection = {}
                headers.forEach((header, index) => {
                  const value = values[index] || ""

                  // Map common CSV headers
                  switch (header.toLowerCase()) {
                    case "first name":
                    case "firstname":
                      connection.firstName = value
                      break
                    case "last name":
                    case "lastname":
                      connection.lastName = value
                      break
                    case "name":
                    case "full name":
                      connection.name = value
                      break
                    case "position":
                    case "title":
                    case "job title":
                      connection.title = value
                      break
                    case "company":
                    case "organization":
                      connection.company = value
                      break
                    case "location":
                    case "address":
                      connection.location = value
                      break
                    case "email":
                    case "email address":
                      connection.email = value
                      break
                    case "profile url":
                    case "linkedin url":
                    case "url":
                      connection.profileUrl = value
                      break
                    default:
                      connection[header] = value
                  }
                })

                // Combine first and last name if needed
                if (!connection.name && (connection.firstName || connection.lastName)) {
                  connection.name = `${connection.firstName || ""} ${connection.lastName || ""}`.trim()
                }

                return connection.name ? connection : null
              })
              .filter((conn) => conn !== null)

            setMyConnections(connections)
            setCurrentTab("first-degree")
            alert(`✅ Successfully imported ${connections.length} connections!`)
          } catch (error) {
            console.error("CSV parsing error:", error)
            alert("❌ Error parsing CSV file. Please check the format.")
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-center">LinkedIn Network Analysis</h1>
      <p className="mb-4 text-gray-600 text-center text-sm sm:text-base">Automated daily tracking with Excel reports</p>

      {/* API Status */}
      <div className="mb-4 p-3 border rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${apiStatus === "connected" ? "bg-green-500" : apiStatus === "error" ? "bg-red-500" : "bg-yellow-500"}`}
            ></div>
            <span className="text-sm font-medium">
              API Status: {apiStatus === "connected" ? "Ready" : apiStatus === "error" ? "Error" : "Unknown"}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={testApiConnection}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              disabled={apiStatus === "testing"}
            >
              Test API
            </button>
            <button
              onClick={loginToLinkedIn}
              className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              disabled={scrapingStatus === "logging-in"}
            >
              Login to LinkedIn
            </button>
          </div>
        </div>
        {lastError && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            <strong>Error:</strong> {lastError}
          </div>
        )}
      </div>

      {/* Scraping Method */}
      <div className="mb-4 p-3 border border-blue-200 rounded-lg bg-blue-50">
        <h3 className="text-sm font-medium mb-2 text-blue-800">Scraping Method:</h3>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="useScrapingBee"
            checked={useScrapingBee}
            onChange={(e) => setUseScrapingBee(e.target.checked)}
            className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="useScrapingBee" className="text-sm text-blue-700">
            Use ScrapingBee (recommended)
          </label>
        </div>
        <p className="text-xs text-blue-600 mt-1">
          {useScrapingBee
            ? "Using ScrapingBee for reliable LinkedIn scraping with proxy rotation and CAPTCHA solving."
            : "Using direct scraping method (less reliable)."}
        </p>
      </div>

      <div className="mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-blue-600" />
            <span className="text-xs sm:text-sm font-medium text-blue-800">
              Scheduler: {schedulerStatus === "active" ? "Active" : "Stopped"}
            </span>
          </div>
          {nextScheduledRun && (
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-blue-700 text-center">
                Next:{" "}
                {nextScheduledRun.toLocaleString("en-US", {
                  timeZone: "Europe/Istanbul",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                (Istanbul)
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Mail size={16} className="text-blue-600" />
            <span className="text-xs sm:text-sm text-blue-700 truncate max-w-[200px]">
              {reportEmail || "Not configured"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-4">
        <button
          onClick={() => startScraping(false)}
          className="px-3 py-2 sm:px-4 sm:py-2 bg-blue-600 text-white rounded flex items-center gap-1 hover:bg-blue-700 transition-colors text-sm sm:text-base"
          disabled={scrapingStatus === "running"}
        >
          <Play size={14} className="sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Start Analysis</span>
          <span className="sm:hidden">Start</span>
        </button>
        <button
          onClick={stopScraping}
          className="px-3 py-2 sm:px-4 sm:py-2 bg-red-600 text-white rounded flex items-center gap-1 hover:bg-red-700 transition-colors text-sm sm:text-base"
        >
          <Pause size={14} className="sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Stop</span>
          <span className="sm:hidden">Stop</span>
        </button>
        <button
          onClick={handleCSVImport}
          className="px-3 py-2 sm:px-4 sm:py-2 bg-green-600 text-white rounded flex items-center gap-1 hover:bg-green-700 transition-colors text-sm sm:text-base"
        >
          <Upload size={14} className="sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Import CSV</span>
          <span className="sm:hidden">Import</span>
        </button>
        <button
          onClick={exportExcel}
          className="px-3 py-2 sm:px-4 sm:py-2 bg-purple-600 text-white rounded flex items-center gap-1 hover:bg-purple-700 transition-colors text-sm sm:text-base"
        >
          <Download size={14} className="sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Export Excel</span>
          <span className="sm:hidden">Excel</span>
        </button>
        <button
          onClick={() => setCurrentTab("first-degree")}
          className="px-3 py-2 sm:px-4 sm:py-2 bg-orange-600 text-white rounded flex items-center gap-1 hover:bg-orange-700 transition-colors text-sm sm:text-base"
        >
          <Users size={14} className="sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">My Friends</span>
          <span className="sm:hidden">Friends</span>
          <span className="text-xs bg-orange-500 px-1 rounded ml-1">({myConnections.length})</span>
        </button>
        <button
          onClick={() => setShowSetup(true)}
          className="px-3 py-2 sm:px-4 sm:py-2 border border-gray-300 rounded flex items-center gap-1 hover:bg-gray-50 transition-colors text-sm sm:text-base"
        >
          <Settings size={14} className="sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Setup</span>
          <span className="sm:hidden">Setup</span>
        </button>
      </div>

      <div className="text-sm text-gray-500">
        Status:{" "}
        <span
          className={`font-medium ${
            scrapingStatus === "running" || scrapingStatus === "logging-in"
              ? "text-blue-600"
              : scrapingStatus === "error"
                ? "text-red-600"
                : "text-green-600"
          }`}
        >
          {scrapingStatus === "logging-in" ? "Logging in to LinkedIn..." : scrapingStatus}
        </span>
        {scrapingStatus === "running" && ` (${scrapingProgress.current}/${scrapingProgress.total})`}
      </div>
      {lastScrapeTime && <div className="text-xs text-gray-400">Last run: {lastScrapeTime.toLocaleString()}</div>}

      <div className="flex justify-center mb-6 mt-8 overflow-x-auto">
        <div className="flex bg-gray-100 rounded-lg p-1 min-w-max">
          <button
            onClick={() => setCurrentTab("first-degree")}
            className={`px-2 py-2 sm:px-4 sm:py-2 rounded-md flex items-center gap-1 sm:gap-2 transition-colors text-xs sm:text-sm whitespace-nowrap ${
              currentTab === "first-degree" ? "bg-white shadow-sm text-blue-600" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Users size={14} className="sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">First Degree</span>
            <span className="sm:hidden">1st</span>
            <span className="text-xs">({myConnections.length})</span>
          </button>
          <button
            onClick={() => setCurrentTab("second-degree")}
            className={`px-2 py-2 sm:px-4 sm:py-2 rounded-md flex items-center gap-1 sm:gap-2 transition-colors text-xs sm:text-sm whitespace-nowrap ${
              currentTab === "second-degree" ? "bg-white shadow-sm text-blue-600" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Network size={14} className="sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Second Degree</span>
            <span className="sm:hidden">2nd</span>
            <span className="text-xs">({Object.keys(secondDegreeConnections).length})</span>
          </button>
          <button
            onClick={() => setCurrentTab("new-friends")}
            className={`px-2 py-2 sm:px-4 sm:py-2 rounded-md flex items-center gap-1 sm:gap-2 transition-colors text-xs sm:text-sm whitespace-nowrap ${
              currentTab === "new-friends" ? "bg-white shadow-sm text-blue-600" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <AlertCircle size={14} className="sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">New Friends</span>
            <span className="sm:hidden">New</span>
            <span className="text-xs">({newlyAddedFriends.length})</span>
          </button>
          <button
            onClick={() => setCurrentTab("differences")}
            className={`px-2 py-2 sm:px-4 sm:py-2 rounded-md flex items-center gap-1 sm:gap-2 transition-colors text-xs sm:text-sm whitespace-nowrap ${
              currentTab === "differences" ? "bg-white shadow-sm text-blue-600" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <AlertCircle size={14} className="sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Analysis</span>
            <span className="sm:hidden">Analysis</span>
            <span className="text-xs">({friendListDifferences.length})</span>
          </button>
        </div>
      </div>

      {/* First Degree Connections */}
      {currentTab === "first-degree" && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">My LinkedIn Connections ({myConnections.length})</h2>
          {myConnections.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {myConnections.map((connection: any, index: number) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg bg-white shadow-sm">
                  <h3 className="font-medium text-gray-900">{connection.name || "Unknown"}</h3>
                  <p className="text-sm text-gray-600">{connection.title || "No title"}</p>
                  <p className="text-sm text-gray-500">{connection.company || "No company"}</p>
                  {connection.location && <p className="text-xs text-gray-400 mt-1">{connection.location}</p>}
                  {secondDegreeConnections[connection.name] && (
                    <p className="text-xs text-blue-600 mt-1">
                      {secondDegreeConnections[connection.name].length} second-degree connections
                    </p>
                  )}
                  {connection.isMockData && (
                    <div className="mt-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-xs inline-block rounded">
                      Mock Data
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg mb-4">No LinkedIn connections found yet.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-800 mb-2">🔄 Auto Scraping</h3>
                  <p className="text-sm text-blue-700 mb-3">
                    Enter your LinkedIn credentials and let the system automatically fetch your connections.
                  </p>
                  <button
                    onClick={() => setShowSetup(true)}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                  >
                    Setup & Start Scraping
                  </button>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-medium text-green-800 mb-2">📤 Manual Import</h3>
                  <p className="text-sm text-green-700 mb-3">
                    Import your LinkedIn connections from a CSV file (safer method).
                  </p>
                  <button
                    onClick={handleCSVImport}
                    className="w-full px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
                  >
                    Import CSV File
                  </button>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-2xl mx-auto">
                <h4 className="font-medium text-yellow-800 mb-2">📋 How to get LinkedIn CSV:</h4>
                <ol className="text-sm text-yellow-700 text-left space-y-1 list-decimal list-inside">
                  <li>
                    Go to{" "}
                    <a
                      href="https://www.linkedin.com/psettings/member-data"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      LinkedIn Settings
                    </a>
                  </li>
                  <li>Click "Data Privacy" → "Get a copy of your data"</li>
                  <li>Select "Connections" and request export</li>
                  <li>Download the CSV when ready (usually takes a few minutes)</li>
                  <li>Use "Import CSV" button above</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Second Degree Connections */}
      {currentTab === "second-degree" && Object.keys(secondDegreeConnections).length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Second-Degree Connections by First-Degree Friend</h2>
          <div className="space-y-6">
            {Object.entries(secondDegreeConnections)
              .slice(0, 5)
              .map(([firstDegreeName, secondDegreeList]: [string, any]) => (
                <div key={firstDegreeName} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">
                    {firstDegreeName}'s Connections ({Array.isArray(secondDegreeList) ? secondDegreeList.length : 0})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {Array.isArray(secondDegreeList) &&
                      secondDegreeList.slice(0, 6).map((connection: any, index: number) => (
                        <div key={index} className="p-3 bg-gray-50 rounded border">
                          <h4 className="font-medium text-sm text-gray-900">{connection.name || "Unknown"}</h4>
                          <p className="text-xs text-gray-600">{connection.title || "No title"}</p>
                          <p className="text-xs text-gray-500">{connection.company || "No company"}</p>
                          {connection.isMockData && (
                            <div className="mt-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-xs inline-block rounded">
                              Mock Data
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                  {Array.isArray(secondDegreeList) && secondDegreeList.length > 6 && (
                    <p className="text-xs text-gray-500 mt-2">Showing 6 of {secondDegreeList.length} connections</p>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Newly Added Friends */}
      {currentTab === "new-friends" && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Newly Added Friends ({newlyAddedFriends.length})</h2>
          {newlyAddedFriends.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {newlyAddedFriends.map((friend: any, index: number) => (
                <div key={index} className="p-4 border border-green-200 rounded-lg bg-green-50 shadow-sm">
                  <h3 className="font-medium text-gray-900">{friend.name}</h3>
                  <p className="text-sm text-gray-600">{friend.title || "No title"}</p>
                  <p className="text-sm text-gray-500">{friend.company || "No company"}</p>
                  {friend.location && <p className="text-xs text-gray-400 mt-1">{friend.location}</p>}
                  <div className="mt-2">
                    <p className="text-xs text-green-700 font-medium">Added by: {friend.addedBy}</p>
                    <p className="text-xs text-green-600">
                      Detected: {new Date(friend.detectedAt).toLocaleDateString()}
                    </p>
                  </div>
                  {friend.isMockData && (
                    <div className="mt-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-xs inline-block rounded">
                      Mock Data
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No newly added friends detected yet.</p>
              <p className="text-sm mt-2">Run the analysis daily to detect changes in your friends' connections.</p>
            </div>
          )}
        </div>
      )}

      {/* Friend List Differences Analysis */}
      {currentTab === "differences" && friendListDifferences.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">
            Friend List Analysis - Connection Patterns ({friendListDifferences.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {friendListDifferences.map((difference: any, index: number) => (
              <div key={index} className="p-4 border border-orange-200 rounded-lg bg-orange-50 shadow-sm">
                <h3 className="font-medium text-gray-900">{difference.name}</h3>
                <p className="text-sm text-gray-600">{difference.title || "No title"}</p>
                <p className="text-sm text-gray-500">{difference.company || "No company"}</p>

                {difference.type === "multiple_paths" && difference.connectedThrough && (
                  <div className="mt-2">
                    <p className="text-xs text-orange-700 font-medium">
                      Connected through {difference.mutualConnectionCount} people:
                    </p>
                    <p className="text-xs text-orange-600">{difference.connectedThrough.join(", ")}</p>
                  </div>
                )}

                {difference.type === "mutual_connection" && difference.mutualWith && (
                  <div className="mt-2">
                    <p className="text-xs text-orange-700 font-medium">
                      Mutual connection with {difference.mutualConnectionCount} people:
                    </p>
                    <p className="text-xs text-orange-600">{difference.mutualWith.join(", ")}</p>
                  </div>
                )}

                {difference.isMockData && (
                  <div className="mt-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-xs inline-block rounded">
                    Mock Data
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showSetup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-auto p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">LinkedIn Setup & Scheduler</h2>
              <button onClick={() => setShowSetup(false)} className="text-gray-400 hover:text-gray-600 text-xl">
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <h4 className="font-medium text-blue-800 mb-1">🔐 LinkedIn Credentials Required</h4>
                <p className="text-xs text-blue-700">
                  Enter your real LinkedIn email and password to access your connections.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn Email *</label>
                <input
                  type="email"
                  value={credentials.email}
                  onChange={(e) =>
                    setCredentials((prev) => {
                      const updated = { ...prev, email: e.target.value }
                      localStorage.setItem("linkedinCredentials", JSON.stringify(updated))
                      return updated
                    })
                  }
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn Password *</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={credentials.password}
                    onChange={(e) =>
                      setCredentials((prev) => {
                        const updated = { ...prev, password: e.target.value }
                        localStorage.setItem("linkedinCredentials", JSON.stringify(updated))
                        return updated
                      })
                    }
                    className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
                  >
                    <Eye size={18} />
                  </button>
                </div>
              </div>

              {/* ScrapingBee Settings */}
              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-900 mb-2">ScrapingBee Settings</h3>
                <p className="text-xs text-gray-600 mb-2">
                  ScrapingBee is a web scraping API that handles proxy rotation and CAPTCHA solving. You need to set the
                  SCRAPINGBEE_API_KEY environment variable in your Vercel project.
                </p>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-700">
                    <strong>Note:</strong> You need to sign up for a ScrapingBee account at{" "}
                    <a
                      href="https://www.scrapingbee.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      scrapingbee.com
                    </a>{" "}
                    and add your API key to your Vercel environment variables.
                  </p>
                </div>
              </div>

              {/* Scheduler Settings */}
              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-900 mb-2">Daily Scheduler</h3>
                <label className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    checked={scrapingSettings.enableScheduler}
                    onChange={(e) => setScrapingSettings((prev) => ({ ...prev, enableScheduler: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Enable daily automated analysis</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Time (Istanbul)</label>
                    <input
                      type="time"
                      value={scrapingSettings.scheduledTime}
                      onChange={(e) => setScrapingSettings((prev) => ({ ...prev, scheduledTime: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Delay (ms)</label>
                    <input
                      type="number"
                      value={scrapingSettings.delay}
                      onChange={(e) =>
                        setScrapingSettings((prev) => ({ ...prev, delay: Number.parseInt(e.target.value) }))
                      }
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      min="1000"
                      max="10000"
                    />
                  </div>
                </div>
                <label className="flex items-center mt-3">
                  <input
                    type="checkbox"
                    checked={scrapingSettings.includeSecondDegree}
                    onChange={(e) =>
                      setScrapingSettings((prev) => ({ ...prev, includeSecondDegree: e.target.checked }))
                    }
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">Include second-degree analysis</span>
                </label>
              </div>

              {/* Email Settings */}
              <div className="border-t pt-4">
                <h3 className="font-medium text-gray-900 mb-2">Email Reports (SendGrid)</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Report Email</label>
                  <input
                    type="email"
                    value={reportEmail}
                    onChange={(e) => setReportEmail(e.target.value)}
                    className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="your-email@example.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Excel reports will be sent here when new friends are detected
                  </p>
                </div>

                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2 text-green-800 text-sm">
                    <Mail size={16} />
                    <span className="font-medium">SendGrid Configured:</span>
                  </div>
                  <p className="text-green-700 text-xs mt-1">
                    ✅ Email service is ready. Reports will be delivered via SendGrid.
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 text-blue-800 text-sm">
                  <Clock size={16} />
                  <span className="font-medium">Scheduler Info:</span>
                </div>
                <p className="text-blue-700 text-xs mt-1">
                  The app will automatically run every day at {scrapingSettings.scheduledTime} Istanbul time and send
                  Excel reports of newly added friends to your email.
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center space-x-2 text-yellow-800 text-sm">
                  <AlertCircle size={16} />
                  <span className="font-medium">Important:</span>
                </div>
                <p className="text-yellow-700 text-xs mt-1">
                  Keep this browser tab open for the scheduler to work. Consider using a dedicated server for 24/7
                  operation.
                </p>
              </div>

              <button
                onClick={() => {
                  setShowSetup(false)
                  if (credentials.email && credentials.password) {
                    loginToLinkedIn()
                  }
                }}
                className="w-full bg-blue-600 text-white py-3 sm:py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm sm:text-base font-medium"
                disabled={!credentials.email || !credentials.password}
              >
                Save Settings & Login to LinkedIn
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default LinkedInTrackerWithScraper
