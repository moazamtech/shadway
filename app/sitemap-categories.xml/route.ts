import { NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Website } from '@/lib/types'

export async function GET() {
  try {
    const { db } = await connectToDatabase()
    const baseUrl = 'https://shadway.online'

    // Get all unique categories
    const categories = await db
      .collection<Website>('websites')
      .distinct('category')

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${categories.map(category => `  <url>
    <loc>${baseUrl}/category/${category.toLowerCase()}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')}
</urlset>`

    return new NextResponse(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Error generating categories sitemap:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}