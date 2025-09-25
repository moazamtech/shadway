import { Metadata } from "next"
import { generateSEOMetadata } from "@/lib/seo"

export const metadata: Metadata = generateSEOMetadata({
  title: "Submit Your Website",
  description: "Share your beautiful Shadcn UI website with our community. Help others discover amazing interfaces and get inspired by modern design patterns.",
  keywords: ["submit website", "shadcn ui showcase", "website submission", "ui gallery", "design showcase"],
  url: "/submit"
})

export default function SubmitLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}