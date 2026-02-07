import { LandingHeader } from "@/components/landing/header";
import { LandingHero } from "@/components/landing/hero";
import { Metadata } from "next";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata: Metadata = generateSEOMetadata({
  title: "Shadway Home | Shadcn UI Inspiration, Templates, and Components",
  description:
    "Explore Shadway's curated library of modern websites, UI blocks, and production-ready components built with Shadcn UI, Tailwind CSS, and Next.js.",
  keywords: [
    "shadcn ui examples",
    "shadcn ui inspiration",
    "shadcn templates",
    "nextjs ui components",
    "tailwind css components",
    "react ui blocks",
    "website design inspiration",
    "ui component showcase",
  ],
  url: "/",
});

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative mx-auto w-full max-w-7xl">
        {/* Continuous vertical rails — header to footer */}
        <div className="absolute inset-y-0 left-0 z-10 w-[2px] bg-border/70" />
        <div className="absolute inset-y-0 left-2 z-10 w-[2px] bg-border/40" />
        <div className="absolute inset-y-0 right-0 z-10 w-[2px] bg-border/70" />
        <div className="absolute inset-y-0 right-2 z-10 w-[2px] bg-border/40" />
        <LandingHeader />
        <LandingHero />
      </div>
    </div>
  );
}
