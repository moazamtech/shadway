import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function GET() {
  const registryFile = path.join(process.cwd(), "registry", "registry.json")

  if (!fs.existsSync(registryFile)) {
    return NextResponse.json({ items: [] })
  }

  const json = JSON.parse(fs.readFileSync(registryFile, "utf8"))
  return NextResponse.json(json)
}
