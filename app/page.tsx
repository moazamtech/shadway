import { Suspense } from "react";
import { Metadata } from "next";
import { ComponentExchangeHome } from "@/components/component-exchange-home";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata: Metadata = generateSEOMetadata({
  title: "Shadway | shadcn Component Exchange",
  description:
    "A live registry of installable shadcn-compatible React components, with real previews, dependency-aware installs, and publisher profiles.",
  keywords: [
    "shadcn registry",
    "shadcn components",
    "react component exchange",
    "installable ui components",
    "tailwind css components",
    "component sharing platform",
  ],
  url: "/",
});

export default function HomePage() {
  return (
    <Suspense>
      <ComponentExchangeHome />
    </Suspense>
  );
}
