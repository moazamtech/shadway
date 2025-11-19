import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const revalidate = 3600

export async function GET(_req: Request, { params }: { params: Promise<{ name?: string }> }) {
  const { name } = await params
  if (!name) {
    return NextResponse.json({ error: "Missing component name" }, { status: 400 })
  }

  try {
    const registryDir = path.join(process.cwd(), "registry")
    const filename = name.replace(/\.json$/, "")
    const filePath = path.join(registryDir, `${filename}.json`)

    // security check
    if (!filePath.startsWith(registryDir)) {
      return NextResponse.json({ error: "Invalid component name" }, { status: 400 })
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 })
    }

    // raw file contents without JSON.stringify encoding
    const data = fs.readFileSync(filePath, "utf8")

    return new Response(data, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    })
  } catch (err) {
    console.error("Registry /r API error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
