import { ComponentPublishForm } from "@/components/component-publish-form";
import { AppShell } from "@/components/marketplace/app-shell";
import { Button } from "@/components/ui/button";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Publish a component | Shadway",
  description: "Publish a self-contained shadcn-compatible React component to the Shadway exchange.",
};

/**
 * The quick way to publish.
 *
 * The studio is the tool; this is the shortcut, and it lives inside the same
 * shell as everything else in the marketplace — the rail on the canvas, the
 * page in the panel beside it. A page that looks like a different product is
 * a page people do not trust with their work.
 */
export default function PublishComponentPage() {
  return (
    <AppShell
      toolbar={
        <>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Publish
            </p>
            <h1 className="truncate text-sm font-semibold tracking-tight">
              Share a shadcn component
            </h1>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" asChild>
            <Link href="/studio">Open the studio</Link>
          </Button>
        </>
      }
    >
      <div className="px-4 py-6 lg:px-6 lg:py-8">
        <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
          Paste a self-contained TSX component. Shadway stores it as a registry
          item and exposes it at <code className="font-mono text-xs">/r/slug</code>,
          ready for the shadcn CLI to install.
        </p>
        <ComponentPublishForm />
      </div>
    </AppShell>
  );
}
