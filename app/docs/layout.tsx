import "@/app/globals.css";
import { BorderBeam } from "@/components/ui/borderbeam";
import { Header } from "./components/header";
import { DocsFooter } from "./components/footer";
import { Metadata } from "next";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata: Metadata = generateSEOMetadata({
  title: "UI Docs | Shadcn UI Blocks and Component Library",
  description:
    "Browse Shadway docs for categorized UI blocks, reusable components, previews, and install commands to ship faster with Shadcn UI.",
  keywords: [
    "shadcn docs",
    "ui component docs",
    "shadcn blocks",
    "component library docs",
    "react ui documentation",
    "tailwind ui blocks",
    "shadway docs",
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
        <div className="absolute inset-y-0 left-0 z-10 w-[2px] bg-border/70" />
        <div className="absolute inset-y-0 left-2 z-10 w-[2px] bg-border/40" />
        <div className="absolute inset-y-0 right-0 z-10 w-[2px] bg-border/70" />
        <div className="absolute inset-y-0 right-2 z-10 w-[2px] bg-border/40" />

        <Header />
        <main className="flex-1 min-h-[calc(100vh-4rem)]">{children}</main>
        <DocsFooter />
      </div>
    </div>
  );
}
