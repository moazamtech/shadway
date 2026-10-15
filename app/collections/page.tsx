import Link from "next/link";
import { Layers, Library } from "lucide-react";
import { listCollections, ensureStarterCollections } from "@/lib/db/marketplace";
import { listComponents } from "@/lib/db/components";
import { ComponentCard } from "@/components/marketplace/component-card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  await ensureStarterCollections().catch(() => {});
  const collections = await listCollections().catch(() => []);

  const categoryMap: Record<string, string[]> = {
    essentials: ["ui"],
    "marketing-blocks": ["block", "marketing"],
    animation: ["animation"],
  };

  const enriched = await Promise.all(
    collections.map(async (collection) => {
      let items = [];

      if (collection.componentSlugs.length) {
        const all = await listComponents({ limit: 60 }).catch(() => []);
        items = all.filter((item) => collection.componentSlugs.includes(item.slug));
      } else {
        const categories = categoryMap[collection.slug] ?? [];
        const all = await listComponents({ limit: 60 }).catch(() => []);
        items = all.filter(
          (item) =>
            categories.includes(item.category) ||
            item.tags.some((tag) => categories.includes(tag))
        );
      }

      return { ...collection, items: items.slice(0, 8) };
    })
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3 lg:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            <span className="text-sm font-semibold tracking-tight">Shadway</span>
          </Link>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium">Collections</span>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-10 lg:px-6">
        <div className="mb-8 flex items-center gap-3">
          <Library className="h-5 w-5" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Collections</h1>
            <p className="text-sm text-muted-foreground">
              Curated shelves of components for the job you are doing.
            </p>
          </div>
        </div>

        <div className="space-y-12">
          {enriched.map((collection) => (
            <section key={collection.slug}>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <h2 className="text-lg font-semibold tracking-tight">{collection.title}</h2>
                {collection.featured && <Badge>Featured</Badge>}
                <span className="text-sm text-muted-foreground">{collection.description}</span>
              </div>

              {collection.items.length ? (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {collection.items.map((item) => (
                    <ComponentCard
                      key={item.slug}
                      item={{
                        slug: item.slug,
                        title: item.title,
                        description: item.description,
                        thumbnailUrl: item.thumbnailUrl,
                        videoUrl: item.videoUrl,
                        author: item.author,
                        tags: item.tags,
                        installs: item.installs,
                        views: item.views,
                        likes: item.likes,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Nothing in this collection yet.
                </p>
              )}
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}