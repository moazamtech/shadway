import { MetadataRoute } from 'next'
import { connectToDatabase } from '@/lib/mongodb'
import { Website } from '@/lib/types'
import { generateWebsiteSlug } from '@/lib/slug'

// Helper function to escape XML entities
function escapeXml(str: string): string {
  if (!str) return str
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://shadway.online'

  // Static pages
  const staticPages = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1.0,
    },
    {
      url: `${baseUrl}/submit`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${baseUrl}/sponsor`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    {
      url: `${baseUrl}/template`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    },
  ]

  try {
    const { db } = await connectToDatabase()

    // Get all websites for dynamic pages
    const websites = await db
      .collection<Website>('websites')
      .find({})
      .sort({ updatedAt: -1 })
      .toArray()

    // Generate dynamic pages for each website (if you have individual pages)
    const websitePages = websites.map((website) => ({
      url: escapeXml(`${baseUrl}/website/${generateWebsiteSlug(website.name)}`),
      lastModified: website.updatedAt || website.createdAt || new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))

    // Category pages
    const categories = [...new Set(websites.map(w => w.category.toLowerCase()))]
    const categoryPages = categories.map((category) => ({
      url: escapeXml(`${baseUrl}/category/${encodeURIComponent(category)}`),
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

    return [...staticPages, ...websitePages, ...categoryPages]
  } catch (error) {
    console.error('Error generating sitemap:', error)
    return staticPages
  }
}