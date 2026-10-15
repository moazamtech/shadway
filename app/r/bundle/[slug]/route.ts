import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getBundleBySlug,
  getBundleComponents,
  hasBundleAccess,
  isBundleFree,
} from "@/lib/db/bundles";
import { incrementComponentMetric, type ComponentDocument } from "@/lib/db/components";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves an entire curated bundle as a single shadcn registry item, so a pack
 * installs with one command:
 *
 *   npx shadcn@latest add https://shadway.online/r/bundle/<slug>
 *
 * 21st does not support this — its bundles are a licensing wrapper and each
 * component must be installed on its own. Bundling the files here means the
 * curation a curator did is the thing a consumer actually gets.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ error: "Database is not configured" }, { status: 503 });
  }

  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);
    const viewerId = session?.user?.id;

    const bundle = await getBundleBySlug(slug, viewerId);
    if (!bundle) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    const isAuthor = Boolean(viewerId && bundle.author.userId === viewerId);
    if (!bundle.isPublic && !isAuthor) {
      return NextResponse.json({ error: "Bundle not found" }, { status: 404 });
    }

    const components = await getBundleComponents(bundle.componentSlugs);

    if (!components.length) {
      return NextResponse.json(
        { error: "This bundle has no installable components yet" },
        { status: 409 }
      );
    }

    // Paid packs need proof of purchase. A CLI install is unauthenticated, so
    // the honest answer is to refuse and point at the page that can sell it.
    if (!hasBundleAccess(bundle, bundle.plans, bundle.purchase, viewerId)) {
      return NextResponse.json(
        {
          error: "This bundle is a paid pack",
          purchaseUrl: `/bundles/${bundle.slug}`,
          hint: "Buy the bundle on the site, then install the components individually.",
        },
        { status: 403 }
      );
    }

    const dependencies = new Set<string>();
    const devDependencies = new Set<string>();
    const registryDependencies = new Set<string>();
    // Same shape the single-component /r/[name] route emits, merged across the pack.
    const cssVars: NonNullable<ComponentDocument["cssVars"]> = {};

    // Namespaced per bundle so two packs can share a component name safely.
    const files = components.flatMap((component) => {
      for (const dep of component.dependencies ?? []) dependencies.add(dep);
      for (const dep of component.devDependencies ?? []) devDependencies.add(dep);
      for (const dep of component.registryDependencies ?? []) {
        registryDependencies.add(dep);
      }
      if (component.cssVars) {
        Object.assign(cssVars, component.cssVars);
      }

      return [
        {
          path: `components/bundles/${bundle.slug}/${component.slug}.tsx`,
          content: component.code,
          type: "registry:component" as const,
        },
        ...(component.files ?? []).map((file) => ({
          path: `components/bundles/${bundle.slug}/${file.path.replace(/^components\//, "")}`,
          content: file.content,
          type: file.type as "registry:component",
        })),
        ...(component.demoCode
          ? [
              {
                path: `components/bundles/${bundle.slug}/${component.slug}-demo.tsx`,
                content: component.demoCode,
                type: "registry:block" as const,
              },
            ]
          : []),
      ];
    });

    // Non-blocking install metrics.
    void Promise.all(
      components.map((component) =>
        incrementComponentMetric(component.slug, "installs").catch(() => {})
      )
    );

    const registryItem = {
      $schema: "https://ui.shadcn.com/schema/registry-item.json",
      name: bundle.slug,
      type: "registry:block",
      title: bundle.name,
      description: bundle.description,
      dependencies: [...dependencies],
      devDependencies: [...devDependencies],
      registryDependencies: [...registryDependencies],
      ...(Object.keys(cssVars).length ? { cssVars } : {}),
      files,
      meta: {
        bundle: {
          slug: bundle.slug,
          componentCount: components.length,
          free: isBundleFree(bundle.plans),
          author: bundle.author.username,
        },
      },
    };

    return NextResponse.json(registryItem, {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Registry bundle error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
