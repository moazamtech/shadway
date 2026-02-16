import "@/app/globals.css";
import { LandingHeader } from "@/components/landing/header";
import { DocsFooter } from "./components/footer";
import { Metadata } from "next";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata: Metadata = generateSEOMetadata({
  title: "UI Blocks | Shadcn UI Blocks and Component Library",
  description:
    "Browse Shadway blocks for categorized UI components, reusable bricks, previews, and install commands to ship faster with Shadcn UI.",
  keywords: [
    "shadcn blocks",
    "ui block gallery",
    "shadcn component library",
    "react ui blocks",
    "tailwind ui bricks",
    "shadway blocks",
  ],
  url: "/docs",
});

export default function BlockLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative mx-auto w-full max-w-7xl">
        {/* Continuous vertical rails — header to footer */}
        <div className="absolute inset-y-0 left-0 z-100 w-[2px] bg-border/70" />
        <div className="absolute inset-y-0 left-2 z-100 w-[2px] bg-border/40" />
        <div className="absolute inset-y-0 right-0 z-100 w-[2px] bg-border/70" />
        <div className="absolute inset-y-0 right-2 z-100 w-[2px] bg-border/40" />

        <LandingHeader />
        <main className="flex-1 min-h-[calc(100vh-4rem)]">{children}</main>
        <DocsFooter />
      </div>
    </div>
  );
}
