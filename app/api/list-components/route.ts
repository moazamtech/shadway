import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import { join } from "path";

export async function GET() {
  try {
    const componentsDir = join(process.cwd(), "generated", "components");

    try {
      const files = await readdir(componentsDir);
      const components = files
        .filter((file) => file.endsWith(".tsx"))
        .map((file) => file.replace(".tsx", ""));

      return NextResponse.json({ components });
    } catch (error: any) {
      // If directory doesn't exist yet, return empty array
      if (error.code === "ENOENT") {
        return NextResponse.json({ components: [] });
      }
      throw error;
    }
  } catch (error: any) {
    console.error("Error listing components:", error);
    return NextResponse.json(
      { error: "Failed to list components", details: error.message },
      { status: 500 }
    );
  }
}
