import Link from "next/link";
import { notFound } from "next/navigation";
import { Layers } from "lucide-react";
import { listComponents } from "@/lib/db/components";
import { ComponentCard } from "@/components/marketplace/component-card";

export const dynamic = "force-dynamic";

export default async function AuthorPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const decoded = decodeURIComponent(username);

  const components = await listComponents({ author: decoded, limit: 60 }).catch(() => []);

  if (!components.length) {
    notFound();
  }

  const author = components[0].author;
  const totalInstalls = components.reduce((sum, item) => sum + (item.installs || 0), 0);
  const totalLikes = components.reduce((sum, item) => sum + (item.likes || 0), 0);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3 lg:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            <span className="text-sm font-semibold tracking-tight">Shadway</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-10 lg:px-6">
        <div className="mb-10 flex flex-wrap items-center gap-5">
          <span className="flex h-16 w-16 items-center justify-center rounded-full border bg-muted text-lg font-semibold">
            {(author.username || "?").slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {author.name || author.username}
            </h1>
            <p className="text-sm text-muted-foreground">@{author.username}</p>
            <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
              <span>
                <strong className="text-foreground">{components.length}</strong> components
              </span>
              <span>
                <strong className="text-foreground">{totalLikes}</strong> likes
              </span>
              <span>
                <strong className="text-foreground">{totalInstalls}</strong> installs
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {components.map((item) => (
            <ComponentCard key={item.slug} item={item} />
          ))}
        </div>
      </div>
    </main>
  );
}