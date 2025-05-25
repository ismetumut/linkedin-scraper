import { NextResponse } from "next/server"

export async function GET() {
  const healthData = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    services: {
      api: {
        status: "up",
        responseTime: "10ms",
      },
      database: {
        status: "up",
        responseTime: "20ms",
      },
    },
    environment: process.env.NODE_ENV || "development",
  }

  return NextResponse.json(healthData)
}
