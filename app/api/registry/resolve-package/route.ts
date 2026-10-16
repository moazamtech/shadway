import { NextResponse } from "next/server";

export const runtime = "nodejs";

type PackageInfo = {
  name: string;
  version: string;
  description?: string;
};

const cache = new Map<string, { version: string; description?: string } | null>();

async function fetchPackage(name: string): Promise<{ version: string; description?: string } | null> {
  if (cache.has(name)) return cache.get(name) ?? null;

  try {
    const response = await fetch(`https://registry.npmjs.org/${name}`, {
      headers: { accept: "application/vnd.npm.install-v1+json" },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      cache.set(name, null);
      return null;
    }

    const data = await response.json();
    const version = data?.["dist-tags"]?.latest as string | undefined;
    const result = version ? { version, description: data.description } : null;
    cache.set(name, result);
    return result;
  } catch {
    cache.set(name, null);
    return null;
  }
}

/**
 * Resolves npm package names against the registry so the studio can offer
 * one-click installs for any import the author writes.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const names: string[] = Array.isArray(body?.names)
      ? body.names
      : String(body?.name ?? "")
          .split(/[\s,]+/)
          .map((n) => n.trim())
          .filter(Boolean);

    if (!names.length) {
      return NextResponse.json({ error: "Provide a package name or names[]" }, { status: 400 });
    }

    // Resolve concurrently. These are independent npm requests, so a serial
    // loop made the endpoint's latency the sum of up to 25 round trips.
    const results = (
      await Promise.all(
        names.slice(0, 25).map(async (name): Promise<PackageInfo | null> => {
          const info = await fetchPackage(name);
          return info ? { name, ...info } : null;
        })
      )
    ).filter((result): result is PackageInfo => result !== null);

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Package resolve failed:", error);
    return NextResponse.json({ error: "Failed to resolve package" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const info = await fetchPackage(name);
  if (!info) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }
  return NextResponse.json({ name, ...info });
}