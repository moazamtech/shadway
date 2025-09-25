import { Metadata } from "next"
import { generateSEOMetadata } from "@/lib/seo"

export const metadata: Metadata = generateSEOMetadata({
  title: "Premium Shadcn UI Templates",
  description: "Discover premium and free Shadcn UI templates. High-quality, professional templates built with modern components for your next project.",
  keywords: ["shadcn ui templates", "react templates", "nextjs templates", "ui kit", "premium templates"],
  url: "/template"
})

export default function TemplateLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}