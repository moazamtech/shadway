import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getComponentBySlug, incrementComponentMetric } from "@/lib/db/components";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!slug) {
    return NextResponse.json({ error: "Missing component slug" }, { status: 400 });
  }

  const decoded = decodeURIComponent(slug);

  // Graceful fallback for local/demo environments without MongoDB.
  if (!process.env.MONGODB_URI) {
    const registryPath = path.join(process.cwd(), "registry", `${decoded}.json`);
    if (fs.existsSync(registryPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(registryPath, "utf8"));
        const firstFile = Array.isArray(raw.files) ? raw.files[0] : null;
        return NextResponse.json({
          item: {
            slug: decoded,
            title: raw.title || raw.name || decoded,
            description: raw.description || "",
            author: { name: "Shadway", username: "shadway", avatar: undefined },
            tags: raw.categories ? [raw.categories] : [],
            dependencies: raw.dependencies || [],
            registryDependencies: raw.registryDependencies || [],
            code: firstFile?.content || "",
            installs: raw.installs || 0,
            views: raw.views || 0,
            likes: raw.likes || 0,
          },
        });
      } catch (error) {
        console.error("Failed to read static component:", error);
      }
    }
    return NextResponse.json({ error: "Component not found" }, { status: 404 });
  }

  try {
    const component = await getComponentBySlug(decoded);
    if (!component) {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }

    void incrementComponentMetric(component.slug, "views").catch(() => {});

    return NextResponse.json({ item: component });
  } catch (error) {
    console.error("Failed to fetch component:", error);
    return NextResponse.json({ error: "Failed to fetch component" }, { status: 500 });
  }
}
