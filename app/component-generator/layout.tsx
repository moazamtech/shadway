import { Metadata } from "next";
import { generateSEOMetadata } from "@/lib/seo";

export const metadata: Metadata = generateSEOMetadata({
  title: "AI Component Generator | Generate Shadcn UI React Components",
  description:
    "Generate production-ready React and Next.js UI with AI. Describe your idea and get editable Shadcn UI components, Tailwind styles, and code previews instantly.",
  keywords: [
    "vibecode",
    "ai component generator",
    "shadcn ui",
    "react components",
    "ai code generator",
    "component builder",
    "tailwind css",
    "typescript",
    "next.js component generator",
    "shadcn ui generator",
    "ui code assistant",
    "react tailwind generator",
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
