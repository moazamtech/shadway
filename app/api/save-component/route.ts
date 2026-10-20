import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { requireSession } from "@/lib/auth/require-session";

/**
 * Node's filesystem errors carry a `code`, and only `EEXIST` means the
 * directory is already there. The code is read off an unknown error rather
 * than assumed, because a failure without one is a different failure.
 */
function hasCode(error: unknown): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  );
}

/** The message on an unknown error, when it has one. */
function messageOf(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  /**
   * This writes a file into the deployment's own source tree, so it is not a
   * public endpoint: without a session anybody could put a file on the disk
   * and have it served by the next build. The studio is behind a login, and
   * this is the studio's save.
   */
  const { response } = await requireSession();
  if (response) return response;

  try {
    const { name, code } = (await req.json()) as {
      name?: string;
      code?: string;
    };

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
    } catch (error) {
      // Ignore if directory already exists
      if (!hasCode(error) || error.code !== "EEXIST") {
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
  } catch (error) {
    console.error("Error saving component:", error);
    return NextResponse.json(
      { error: "Failed to save component", details: messageOf(error) },
      { status: 500 }
    );
  }
}
