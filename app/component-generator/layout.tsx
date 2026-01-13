import { Metadata } from "next";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata: Metadata = generateSEOMetadata({
  title:
    "Shadway - AI Component Generator | Create Beautiful React Components",
  description:
    "Generate production-ready React components with AI. Shadway creates beautiful, responsive components using Shadcn colors and modern design patterns. Just describe what you need and get instant, customizable code.",
  keywords: [
    "vibecode",
    "ai component generator",
    "shadcn ui",
    "react components",
    "ai code generator",
    "component builder",
    "tailwind css",
    "typescript",
  ],
  url: "/component-generator",
});

export default function ComponentGeneratorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
