import { NextResponse } from "next/server"
import { saveComponent } from "@/lib/registry-utils"

export async function POST(req: Request) {
  try {
    const { name, title, description, category, code } = await req.json()

    if (!name || !code) {
      return NextResponse.json({ error: "Missing name or code" }, { status: 400 })
    }

    const result = await saveComponent({
      name,
      title,
      description,
      category,
      code
    })

    return NextResponse.json({
      success: true,
      message: `${name} added successfully to ${result.category} category.`,
      endpoint: result.path,
    })
  } catch (err: any) {
    console.error("Error saving component:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
