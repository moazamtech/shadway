import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"

export async function POST(req: Request) {
  try {
    const { name, title, description, code } = await req.json()

    if (!name || !code) {
      return NextResponse.json({ error: "Missing name or code" }, { status: 400 })
    }

    // Ensure /registry exists
    const registryDir = path.join(process.cwd(), "registry")
    if (!fs.existsSync(registryDir)) fs.mkdirSync(registryDir, { recursive: true })

    // Make a folder for the component (for backup/reference)
    const compDir = path.join(registryDir, name)
    fs.mkdirSync(compDir, { recursive: true })

    // Save the component code into registry/{name}/{name}.tsx
    const filePath = path.join(compDir, `${name}.tsx`)
    fs.writeFileSync(filePath, code)

    // Create per-component JSON with proper `path` and `content`
    const item = {
      name,
      type: "registry:component",
      title: title || name,
      description: description || "",
      files: [
        {
          path: `components/ui/${name}.tsx`, // Destination for Shadcn
          content: code,                     // Embed actual code
          type: "registry:component",
        },
      ],
      dependencies: [],
      registryDependencies: [],
    }

    // Save component registry JSON
    fs.writeFileSync(
      path.join(registryDir, `${name}.json`),
      JSON.stringify(item, null, 2)
    )

    // 6️⃣ Update the main registry index
    const registryFile = path.join(registryDir, "registry.json")
    const registry = fs.existsSync(registryFile)
      ? JSON.parse(fs.readFileSync(registryFile, "utf8"))
      : { name: "my-registry", items: [] }

    if (!registry.items.some((i: any) => i.name === name)) {
      registry.items.push({ name, type: "registry:component" })
    }

    fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2))

    return NextResponse.json({
      success: true,
      message: `${name} added successfully.`,
      endpoint: `/r/${name}.json`,
    })
  } catch (err: any) {
    console.error("Error saving component:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
