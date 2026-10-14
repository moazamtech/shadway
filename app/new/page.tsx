import { ComponentPublishForm } from "@/components/component-publish-form";
import { Button } from "@/components/ui/button";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Publish a component | Shadway",
  description: "Publish a self-contained shadcn-compatible React component to the Shadway exchange.",
};

export default function PublishComponentPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted-foreground">Publish</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Share a shadcn component</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Paste a self-contained TSX component. Shadway stores it as a registry item and exposes it at <code>/r/slug</code>.
            </p>
          </div>
          <Button variant="outline" asChild>
            <a href="/studio">Open full studio</a>
          </Button>
        </div>
        <ComponentPublishForm />
      </div>
    </main>
  );
}
