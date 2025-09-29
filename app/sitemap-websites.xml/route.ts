import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Website } from '@/lib/types'

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

export async function GET() {
  try {
    const { db } = await connectToDatabase()
    const baseUrl = 'https://shadway.online'

    // Get all websites
    const websites = await db
      .collection<Website>('websites')
      .find({})
      .sort({ updatedAt: -1 })
      .toArray()

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${websites.map(website => `  <url>
    <loc>${baseUrl}/website/${website._id}</loc>
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