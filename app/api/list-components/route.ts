import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import { join } from "path";

/**
 * Node's filesystem errors carry a `code`, and only `ENOENT` means the
 * directory was never created. The code is read off an unknown error rather
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

export async function GET() {
  try {
    const componentsDir = join(process.cwd(), "generated", "components");

    try {
      const files = await readdir(componentsDir);
      const components = files
        .filter((file) => file.endsWith(".tsx"))
        .map((file) => file.replace(".tsx", ""));

      return NextResponse.json({ components });
    } catch (error) {
      // If directory doesn't exist yet, return empty array
      if (hasCode(error) && error.code === "ENOENT") {
        return NextResponse.json({ components: [] });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error listing components:", error);
    return NextResponse.json(
      {
        error: "Failed to list components",
        details: messageOf(error),
      },
      { status: 500 }
    );
  }
}
