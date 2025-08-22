import { NextResponse } from "next/server";

export async function HEAD() {
  return new Response(null, { 
    status: 200,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "ecosystem-platform",
  });
}