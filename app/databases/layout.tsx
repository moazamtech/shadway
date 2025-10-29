import type { Metadata } from "next"
import { generateSEOMetadata } from "@/lib/seo"

const databasesKeywords = [
  // Primary keywords
  "best nextjs database",
  "nextjs database solutions",
  "nextjs database options",
  "top nextjs databases",
  "nextjs database comparison",

  // Specific database types
  "nextjs sql database",
  "nextjs nosql database",
  "nextjs postgresql",
  "nextjs mongodb",
  "nextjs firebase",
  "nextjs supabase",
  "nextjs prisma",
  "nextjs drizzle orm",
  "nextjs neon database",
  "nextjs redis",
  "nextjs vector database",
  "nextjs graph database",

  // Feature-based keywords
  "nextjs real-time database",
  "nextjs serverless database",
  "nextjs cloud database",
  "nextjs headless database",

  // Use case keywords
  "nextjs api database",
  "nextjs rest api database",
  "nextjs graphql database",
  "nextjs orm nextjs",
  "nextjs database tutorial",
  "nextjs database setup",

  // Comparison keywords
  "postgresql vs mongodb nextjs",
  "supabase vs firebase nextjs",
  "prisma vs drizzle orm",

  // Integration keywords
  "nextjs vercel database",
  "nextjs serverless functions database",
  "nextjs edge functions database",
  "nextjs typescript database",
  "nextjs react database",

  // Architecture keywords
  "nextjs scalable database",
  "nextjs production database",
  "nextjs high performance database",
  "nextjs web3 database",

  // Related keywords
  "shadcn ui database",
  "react database",
  "modern web development database",
  "full stack nextjs",
  "backend database solutions"
]

export const metadata: Metadata = generateSEOMetadata({
  title: "Best Next.js Databases & Solutions - Comparison Guide 2024",
  description: "Explore the best databases for Next.js applications. Compare PostgreSQL, MongoDB, Firebase, Supabase, Prisma, Drizzle ORM, and 20+ database solutions optimized for modern web development. Find the perfect database for your Next.js project with detailed insights and setup guides.",
  keywords: databasesKeywords,
  image: "/og-image.png",
  url: "/databases",
  type: "website",
  noIndex: false,
  canonical: "https://shadway.online/databases"
})

export default function DatabasesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
