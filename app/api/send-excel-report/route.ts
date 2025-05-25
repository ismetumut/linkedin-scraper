import { type NextRequest, NextResponse } from "next/server"
import sgMail from "@sendgrid/mail"

// Initialize SendGrid with API key
sgMail.setApiKey(process.env.SENDGRID_API_KEY!)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { to, subject, newFriends, excelData, reportDate } = body

    // Validate input
    if (!to || !newFriends || !excelData) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!process.env.SENDGRID_API_KEY) {
      return NextResponse.json({ error: "SendGrid API key not configured" }, { status: 500 })
    }

    // Create CSV content for Excel compatibility
    const csvContent = [
      excelData.headers.join(","),
      ...excelData.rows.map((row: any[]) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    // Convert to base64 for email attachment
    const csvBase64 = Buffer.from(csvContent).toString("base64")

    const emailData = {
      to: to,
      from: "linkedin-tracker@yourdomain.com", // Replace with your verified sender email
      subject: subject || `LinkedIn New Friends Report - ${new Date().toLocaleDateString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0077b5;">LinkedIn New Friends Report</h2>
          <p><strong>Report Date:</strong> ${new Date(reportDate).toLocaleDateString()}</p>
          <p><strong>New Friends Detected:</strong> ${newFriends.length}</p>
          
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #333; margin-top: 0;">Summary of New Connections:</h3>
            <ul style="list-style-type: none; padding: 0;">
              ${newFriends
                .slice(0, 10)
                .map(
                  (friend: any) => `
                <li style="padding: 8px 0; border-bottom: 1px solid #eee;">
                  <strong style="color: #0077b5;">${friend.name}</strong><br>
                  <span style="color: #666;">${friend.title || "No title"} ${friend.company ? `at ${friend.company}` : ""}</span><br>
                  <small style="color: #888;">Added by: ${friend.addedBy} | Detected: ${new Date(friend.detectedAt).toLocaleDateString()}</small>
                </li>
              `,
                )
                .join("")}
              ${newFriends.length > 10 ? `<li style="padding: 8px 0; font-style: italic; color: #666;">... and ${newFriends.length - 10} more connections (see Excel attachment)</li>` : ""}
            </ul>
          </div>
          
          <div style="background-color: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #1565c0;">
              📊 <strong>Complete data is available in the attached Excel file.</strong>
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 12px; color: #888; text-align: center;">
            This is an automated report from your LinkedIn Network Analyzer.<br>
            Generated on ${new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" })} (Istanbul Time)
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `linkedin_new_friends_${new Date().toISOString().split("T")[0]}.csv`,
          content: csvBase64,
          type: "text/csv",
          disposition: "attachment",
        },
      ],
    }

    // Send email using SendGrid
    await sgMail.send(emailData)

    console.log(`Excel report sent successfully to ${to} with ${newFriends.length} new friends`)

    return NextResponse.json({
      success: true,
      message: "Excel report sent successfully via SendGrid",
      friendsCount: newFriends.length,
      sentTo: to,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("SendGrid email sending error:", error)

    // Handle SendGrid specific errors
    if (error.response) {
      console.error("SendGrid error response:", error.response.body)
      return NextResponse.json(
        {
          error: "Failed to send email via SendGrid",
          details: error.response.body?.errors || error.message,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({ error: "Failed to send email report" }, { status: 500 })
  }
}
