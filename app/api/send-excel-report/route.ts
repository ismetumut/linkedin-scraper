import { NextResponse } from "next/server"
import sgMail from "@sendgrid/mail"

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY)
}

export async function POST(request: Request) {
  try {
    const { to, subject, newFriends, excelData, reportDate } = await request.json()

    if (!to || !subject || !newFriends || !excelData) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!process.env.SENDGRID_API_KEY) {
      return NextResponse.json({ error: "SendGrid API key not configured" }, { status: 500 })
    }

    // Create CSV content
    const csvContent = [
      excelData.headers.join(","),
      ...excelData.rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    // Create email with CSV attachment
    const msg = {
      to,
      from: "linkedin-tracker@example.com", // Replace with your verified sender
      subject,
      text: `LinkedIn New Friends Report - ${new Date(reportDate).toLocaleDateString()}`,
      html: `
        <h1>LinkedIn New Friends Report</h1>
        <p>Date: ${new Date(reportDate).toLocaleDateString()}</p>
        <p>Found ${newFriends.length} newly added connections.</p>
        <p>Please see the attached Excel file for details.</p>
      `,
      attachments: [
        {
          content: Buffer.from(csvContent).toString("base64"),
          filename: `linkedin_new_friends_${new Date().toISOString().split("T")[0]}.csv`,
          type: "text/csv",
          disposition: "attachment",
        },
      ],
    }

    // Send email
    await sgMail.send(msg)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error sending email:", error)
    return NextResponse.json({ error: "Failed to send email", details: error.message }, { status: 500 })
  }
}
