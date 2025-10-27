import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

export async function POST(req: NextRequest) {
  try {
    const { name, code } = await req.json();

    if (!name || !code) {
      return NextResponse.json(
        { error: "Component name and code are required" },
        { status: 400 }
      );
    }

    // Sanitize component name
    const sanitizedName = name.replace(/[^a-zA-Z0-9-_]/g, "");

    if (!sanitizedName) {
      return NextResponse.json(
        { error: "Invalid component name" },
        { status: 400 }
      );
    }

    // Create generated/components directory if it doesn't exist
    const componentsDir = join(process.cwd(), "generated", "components");

    try {
      await mkdir(componentsDir, { recursive: true });
    } catch (error: any) {
      // Ignore if directory already exists
      if (error.code !== "EEXIST") {
        throw error;
      }
    }

    // Write component file
    const filePath = join(componentsDir, `${sanitizedName}.tsx`);
    await writeFile(filePath, code, "utf-8");

    return NextResponse.json({
      success: true,
      name: sanitizedName,
      path: `generated/components/${sanitizedName}.tsx`,
    });
  } catch (error: any) {
    console.error("Error saving component:", error);
    return NextResponse.json(
      { error: "Failed to save component", details: error.message },
      { status: 500 }
    );
  }
}
