import type { Metadata } from "next";
import Link from "next/link";
import { Layers } from "lucide-react";
import { generateSEOMetadata } from "@/lib/seo";
import { Button } from "@/components/ui/button";
import { BundleList } from "@/components/marketplace/bundle-list";

export const dynamic = "force-dynamic";

export const metadata: Metadata = generateSEOMetadata({
  title: "Bundles",
  description:
    "Curated packs of shadcn/ui components you can install with one shadcn add command.",
  url: "/bundles",
  keywords: ["shadcn bundles", "shadcn component packs", "install shadcn components"],
  type: "website",
});

export default function BundlesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3 lg:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            <span className="text-sm font-semibold tracking-tight">Shadway</span>
          </Link>

          <Link
            href="/collections"
            className="hidden items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground sm:flex"
          >
            Collections
          </Link>
          <Link
            href="/"
            className="hidden items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground sm:flex"
          >
            Browse components
          </Link>

          <Button asChild className="ml-auto" size="sm">
            <Link href="/bundles/new">New bundle</Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-8 lg:px-6">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-2xl font-semibold tracking-tight">Bundles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Curated packs of components that install together with a single
            <code className="mx-1 rounded bg-muted px-1.5 py-0.5 text-xs">
              npx shadcn@latest add
            </code>
            command.
          </p>
        </div>

        <BundleList />
      </div>
    </main>
  );
}
