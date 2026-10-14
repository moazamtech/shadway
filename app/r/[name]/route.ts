import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getComponentBySlug } from "@/lib/db/components";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: Request, { params }: { params: Promise<{ name?: string }> }) {
  const { name } = await params;
  if (!name) {
    return NextResponse.json({ error: "Missing component name" }, { status: 400 });
  }

  const filename = decodeURIComponent(name).replace(/\.json$/, "");

  // Security: prevent directory traversal.
  const registryDir = path.join(process.cwd(), "registry");
  const filePath = path.join(registryDir, `${filename}.json`);
  if (filePath.startsWith(registryDir) && fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, "utf8");
      return new Response(data, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      });
    } catch (err) {
      console.error("Registry /r static API error:", err);
    }
  }

  // Dynamic shared components.
  try {
    const component = await getComponentBySlug(filename);
    if (!component || component.status !== "published" || component.visibility !== "public") {
      return NextResponse.json({ error: "Component not found" }, { status: 404 });
    }

    const registryItem = {
      $schema: "https://ui.shadcn.com/schema/registry-item.json",
      name: component.slug,
      type: "registry:component",
      title: component.title,
      description: component.description,
      dependencies: component.dependencies,
      devDependencies: component.devDependencies,
      registryDependencies: component.registryDependencies,
      cssVars: component.cssVars,
      files: [
        {
          path: `components/ui/${component.slug}.tsx`,
          content: component.code,
          type: "registry:component",
        },
        ...(component.files || []),
        ...(component.demoCode
          ? [
              {
                path: `components/demo/${component.slug}-demo.tsx`,
                content: component.demoCode,
                type: "registry:block" as const,
              },
            ]
          : []),
      ],
    };

    // Non-blocking install metric.
    const { incrementComponentMetric } = await import("@/lib/db/components");
    void incrementComponentMetric(component.slug, "installs").catch(() => {});

    return NextResponse.json(registryItem, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("Registry /r dynamic API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
