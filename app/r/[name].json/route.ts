import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

// Explicitly run on Node.js and avoid static generation for dynamic params
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 3600 // Revalidate every hour

export async function GET(
  request: NextRequest,
  { params }: { params: { name?: string } }
) {
  const name = params?.name
  if (!name) {
    return NextResponse.json({ error: "Missing component name" }, { status: 400 })
  }

  try {
    const registryDir = path.join(process.cwd(), "registry")
    const filename = name.replace(/\.json$/, "") // Remove .json extension if provided

    // Security: prevent directory traversal
    const filePath = path.join(registryDir, `${filename}.json`)
    if (!filePath.startsWith(registryDir)) {
      return NextResponse.json({ error: "Invalid component name" }, { status: 400 })
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 })
    }

    const fileContent = fs.readFileSync(filePath, "utf-8")
    const jsonData = JSON.parse(fileContent)

    return NextResponse.json(jsonData, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (error) {
    console.error("Registry /r API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}