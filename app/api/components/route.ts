import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function POST(req: Request) {
  try {
    const { name, title, description, code } = await req.json()

    if (!name || !code) {
      return NextResponse.json({ error: "Missing name or code" }, { status: 400 })
    }

    const registryDir = path.join(process.cwd(), "registry")
    if (!fs.existsSync(registryDir)) fs.mkdirSync(registryDir, { recursive: true })

    const compDir = path.join(registryDir, name)
    fs.mkdirSync(compDir, { recursive: true })

    // 1️⃣ Save the actual component file
    fs.writeFileSync(path.join(compDir, `${name}.tsx`), code)

    // 2️⃣ Make the per-component JSON
    const item = {
      name,
      type: "registry:component",
      title: title || name,
      description: description || "",
      files: [
        { path: `registry/${name}/${name}.tsx`, type: "registry:component" }
      ],
      dependencies: [],
      registryDependencies: []
    }

    fs.writeFileSync(
      path.join(registryDir, `${name}.json`),
      JSON.stringify(item, null, 2)
    )

    // 3️⃣ Update the main registry.json
    const registryFile = path.join(registryDir, "registry.json")
    const registry = fs.existsSync(registryFile)
      ? JSON.parse(fs.readFileSync(registryFile, "utf8"))
      : { name: "my-registry", items: [] }

    if (!registry.items.some((i: any) => i.name === name)) {
      registry.items.push({ name, type: "registry:component" })
    }

    fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2))

    return NextResponse.json({ success: true, message: `${name} added.` })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
