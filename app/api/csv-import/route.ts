import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const csvContent = await file.text()
    const lines = csvContent.split("\n")

    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV file must have at least a header and one data row" }, { status: 400 })
    }

    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))
    const connections = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = line.split(",").map((v) => v.trim().replace(/"/g, ""))

      if (values.length >= headers.length) {
        const connection: any = {}

        headers.forEach((header, index) => {
          const value = values[index] || ""

          // Map common CSV headers to our format
          switch (header.toLowerCase()) {
            case "first name":
            case "firstname":
            case "name":
              connection.name = value
              break
            case "last name":
            case "lastname":
              connection.name = connection.name ? `${connection.name} ${value}` : value
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

        if (connection.name) {
          connections.push(connection)
        }
      }
    }

    return NextResponse.json({
      success: true,
      connections,
      count: connections.length,
      message: `Successfully imported ${connections.length} connections`,
    })
  } catch (error) {
    console.error("CSV import error:", error)
    return NextResponse.json({ error: "Failed to process CSV file" }, { status: 500 })
  }
}
