import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const registryDir = path.join(process.cwd(), "registry")

    if (!fs.existsSync(registryDir)) {
      return NextResponse.json({ name: "shadway", items: [] })
    }

    const items: any[] = []

    for (const file of fs.readdirSync(registryDir)) {
      if (file.endsWith(".json") && file !== "registry.json") {
        const filePath = path.join(registryDir, file)
        const json = JSON.parse(fs.readFileSync(filePath, "utf8"))

        if (json?.name && json?.type === "registry:component") {
          items.push({ name: json.name, type: "registry:component" })
        }
      }
    }

    const registry = {
      name: "shadway",
      items,
    }

    return new Response(JSON.stringify(registry, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (err) {
    console.error("Error building registry index:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
