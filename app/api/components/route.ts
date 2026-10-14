import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  listComponents,
  createComponent,
  isValidSlug,
} from "@/lib/db/components";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ items: [], count: 0, degraded: true });
  }

  try {
    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q") ?? undefined;
    const tag = searchParams.get("tag") ?? undefined;
    const category = searchParams.get("category") ?? undefined;
    const author = searchParams.get("author") ?? undefined;
    const sortParam = searchParams.get("sort");
    const sort =
      sortParam === "popular" ||
      sortParam === "installs" ||
      sortParam === "trending"
        ? sortParam
        : "latest";
    const limit = Number(searchParams.get("limit") || 24);

    const components = await listComponents({
      q,
      tag: tag ?? undefined,
      category: category ?? undefined,
      author: author ?? undefined,
      sort,
      limit,
    });

    return NextResponse.json({ items: components, count: components.length });
  } catch (error) {
    console.error("Failed to list components:", error);
    return NextResponse.json({ error: "Failed to list components" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json(
      { error: "Database is not configured. Set MONGODB_URI to enable publishing." },
      { status: 503 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();

    const title = String(body.title || body.name || "").trim();
    const code = String(body.code || "").trim();
    const description = String(body.description || "").trim();
    const requestedSlug = body.slug ? String(body.slug) : undefined;

    if (!title || code.length < 20) {
      return NextResponse.json(
        { error: "Title and substantial code are required" },
        { status: 400 }
      );
    }

    if (code.length > 200_000) {
      return NextResponse.json({ error: "Component code is too large" }, { status: 413 });
    }

    if (!/export\s+(default|function|const|class)/.test(code)) {
      return NextResponse.json(
        { error: "Component code must export something" },
        { status: 400 }
      );
    }

    let author;
    if (session?.user) {
      author = {
        userId: session.user.id || session.user.email || "unknown",
        name: session.user.name || session.user.email || "Unknown user",
        username: (session.user as { username?: string }).username || session.user.email?.split("@")[0] || "anonymous",
        avatar: session.user.image || undefined,
      };
    } else {
      const fallbackName = String(body.authorName || body.author || "Anonymous").trim();
      author = {
        userId: `anon-${Date.now()}`,
        name: fallbackName,
        username: slugify(fallbackName),
        avatar: undefined,
      };
    }

    const item = await createComponent({
      slug: requestedSlug && isValidSlug(requestedSlug) ? requestedSlug : undefined,
      name: String(body.name || title).replace(/\s+/g, "-"),
      title,
      description,
      code,
      demoCode: body.demoCode ? String(body.demoCode) : undefined,
      files: Array.isArray(body.files) ? body.files : undefined,
      thumbnailUrl: body.thumbnailUrl ? String(body.thumbnailUrl) : undefined,
      videoUrl: body.videoUrl ? String(body.videoUrl) : undefined,
      category: String(body.category || "ui"),
      tags: Array.isArray(body.tags) ? body.tags : [],
      dependencies: Array.isArray(body.dependencies) ? body.dependencies : [],
      devDependencies: Array.isArray(body.devDependencies) ? body.devDependencies : [],
      registryDependencies: Array.isArray(body.registryDependencies)
        ? body.registryDependencies
        : [],
      cssVars: body.cssVars,
      author,
      visibility: body.visibility === "unlisted" ? "unlisted" : "public",
      status: "published",
      featured: false,
      version: String(body.version || "1.0.0"),
      license: String(body.license || "MIT"),
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("Failed to create component:", error);
    return NextResponse.json({ error: "Failed to create component" }, { status: 500 });
  }
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
