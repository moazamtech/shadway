import { Metadata } from "next"
import { generateSEOMetadata } from "@/lib/seo"

export const metadata: Metadata = generateSEOMetadata({
  title: "AI Component Generator - Create Shadcn UI Components",
  description: "Generate production-ready Shadcn UI components using AI. Describe any component you need and get instant, customizable React code.",
  keywords: ["component generator", "shadcn ui", "ai", "react", "component builder", "code generator"],
  url: "/component-generator"
})

export default function ComponentGeneratorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
