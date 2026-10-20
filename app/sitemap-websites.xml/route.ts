import { NextResponse } from 'next/server'
import { listWebsites } from '@/lib/db/content'
import { Website } from '@/lib/types'
import { generateWebsiteSlug } from '@/lib/slug'

// Helper function to escape XML entities
function escapeXml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * The moment a website was last touched, as a number.
 *
 * A website with no date is older than every website that has one, which is
 * what a missing date has always meant: it belongs at the end of a list, not
 * at the front of it.
 */
function touchedAt(website: Website): number {
  return website.updatedAt ? new Date(website.updatedAt).getTime() : 0
}

/**
 * The websites, the ones that were touched last first.
 *
 * The accessor hands back the catalogue in the order the pages show it, and
 * that order is the one a curator chose. A sitemap is a promise about what
 * changed, so the order is put back here and the pages a crawler visits
 * first are the ones that moved.
 */
function recentlyTouched(websites: Website[]): Website[] {
  return [...websites].sort((a, b) => touchedAt(b) - touchedAt(a))
}

export async function GET() {
  try {
    const baseUrl = 'https://shadway.online'

    // Get all websites
    const websites = recentlyTouched(await listWebsites())

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${websites.map(website => `  <url>
    <loc>${baseUrl}/website/${generateWebsiteSlug(website.name)}</loc>
    <lastmod>${website.updatedAt ? new Date(website.updatedAt).toISOString() : new Date(website.createdAt || new Date()).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
    <image:image>
      <image:loc>${escapeXml(website.image)}</image:loc>
      <image:title>${escapeXml(website.name)}</image:title>
      <image:caption>${escapeXml(website.description)}</image:caption>
    </image:image>
  </url>`).join('\n')}
</urlset>`

    return new NextResponse(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Error generating websites sitemap:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
