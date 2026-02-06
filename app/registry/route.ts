import { NextResponse } from "next/server"
import registryData from "@/registry/registry.json"

export const dynamic = "force-static"

export async function GET() {
  return NextResponse.json(registryData, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  })
}
