import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Website } from '@/lib/types'
import { generateWebsiteSlug } from '@/lib/slug'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const baseUrl = 'https://shadway.online'

    if (action === 'ping-search-engines') {
      // Ping search engines about sitemap updates
      const searchEngines = [
        'https://www.google.com/ping?sitemap=',
        'https://www.bing.com/ping?sitemap='
      ]

      const sitemapUrl = `${baseUrl}/sitemap.xml`

      const pingResults = await Promise.allSettled(
        searchEngines.map(async (engine) => {
          const response = await fetch(`${engine}${encodeURIComponent(sitemapUrl)}`, {
            method: 'GET',
            headers: {
              'User-Agent': 'Shadway-Indexing-Bot/1.0'
            }
          })
          return { engine, status: response.status, ok: response.ok }
        })
      )

      return NextResponse.json({
        message: 'Search engines pinged about sitemap updates',
        results: pingResults.map(result =>
          result.status === 'fulfilled' ? result.value : { error: result.reason }
        ),
        sitemapUrl
      })
    }

    if (action === 'generate-urls') {
      // Generate all URLs for manual submission
      const { db } = await connectToDatabase()

      const websites = await db
        .collection<Website>('websites')
        .find({})
        .toArray()

      const categories = [...new Set(websites.map(w => w.category.toLowerCase()))]

      const urls = [
        // Static pages
        baseUrl,
        `${baseUrl}/submit`,
        `${baseUrl}/sponsor`,
        `${baseUrl}/template`,

        // Website pages
        ...websites.map(w => `${baseUrl}/website/${generateWebsiteSlug(w.name)}`),

        // Category pages
        ...categories.map(cat => `${baseUrl}/category/${cat}`)
      ]

      return NextResponse.json({
        total: urls.length,
        urls,
        instructions: {
          'Google Search Console': 'Go to URL Inspection tool and submit each URL',
          'Bing Webmaster Tools': 'Use Submit URLs feature',
          'IndexNow': 'Submit URLs using IndexNow API for instant indexing'
        }
      })
    }

    return NextResponse.json({
      message: 'Shadway Indexing API',
      availableActions: [
        'ping-search-engines - Ping Google and Bing about sitemap updates',
        'generate-urls - Get all URLs for manual submission'
      ],
      usage: `${baseUrl}/api/indexing?action=ping-search-engines`,
      sitemaps: [
        `${baseUrl}/sitemap.xml`,
        `${baseUrl}/sitemap-websites.xml`,
        `${baseUrl}/sitemap-categories.xml`,
        `${baseUrl}/sitemap-index.xml`
      ]
    })

  } catch (error) {
    console.error('Indexing API error:', error)
    return NextResponse.json(
      { error: 'Failed to process indexing request' },
      { status: 500 }
    )
  }
}