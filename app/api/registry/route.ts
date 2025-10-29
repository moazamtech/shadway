import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export const dynamic = "force-static"
export const revalidate = 3600 // Revalidate every hour

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const component = searchParams.get("component")

  try {
    const registryDir = path.join(process.cwd(), "registry")

    if (component) {
      // Get specific component registry file
      const filePath = path.join(registryDir, `${component}.json`)

      // Security: prevent directory traversal
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
    } else {
      // Get all components (index)
      const indexPath = path.join(registryDir, "index.json")

      if (!fs.existsSync(indexPath)) {
        return NextResponse.json({ error: "Registry index not found" }, { status: 404 })
      }

      const fileContent = fs.readFileSync(indexPath, "utf-8")
      const jsonData = JSON.parse(fileContent)

      return NextResponse.json(jsonData, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
          "Access-Control-Allow-Origin": "*",
        },
      })
    }
  } catch (error) {
    console.error("Registry API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
