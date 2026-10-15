import type { Metadata } from "next";
import Link from "next/link";
import { Layers } from "lucide-react";
import { BundleCreate } from "@/components/marketplace/bundle-create";

export const metadata: Metadata = {
  title: "New bundle — Shadway",
  description: "Curate a set of components into an installable bundle.",
};

export default function NewBundlePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-3 lg:px-6">
          <Link href="/" className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            <span className="text-sm font-semibold tracking-tight">Shadway</span>
          </Link>
          <span className="text-sm text-muted-foreground">/</span>
          <Link
            href="/bundles"
            className="text-sm text-muted-foreground transition hover:text-foreground"
          >
            Bundles
          </Link>
        </div>
      </header>

      <BundleCreate />
    </main>
  );
}
