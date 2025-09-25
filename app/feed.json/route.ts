import { NextRequest, NextResponse } from 'next/server'
import { connectToDatabase } from '@/lib/mongodb'
import { Website } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase()

    // Get all websites sorted by creation date
    const websites = await db
      .collection<Website>('websites')
      .find({})
      .sort({ createdAt: -1 })
      .limit(50) // Limit to last 50 items
      .toArray()

    const baseUrl = 'https://shadway.online'

    const jsonFeed = {
      version: 'https://jsonfeed.org/version/1.1',
      title: 'Shadway - Curated Shadcn UI Website Collection',
      description: 'Discover beautiful websites and components built with Shadcn UI. A curated collection of modern interfaces and design inspiration.',
      home_page_url: baseUrl,
      feed_url: `${baseUrl}/feed.json`,
      language: 'en-US',
      icon: `${baseUrl}/favicon-32x32.png`,
      favicon: `${baseUrl}/favicon-16x16.png`,
      authors: [
        {
          name: 'Moazam Butt',
          url: 'https://x.com/loxtmozzi'
        }
      ],
      items: websites.map(website => ({
        id: `shadway-${website._id}`,
        title: `${website.name} - ${website.category}`,
        content_html: `
          <div>
            <h2>${website.name}</h2>
            <p>${website.description}</p>
            <p><strong>Category:</strong> ${website.category}</p>
            ${website.tags ? `<p><strong>Tags:</strong> ${website.tags.join(', ')}</p>` : ''}
            <p><a href="${website.url}" target="_blank" rel="noopener noreferrer">Visit Website →</a></p>
            ${website.image ? `<img src="${website.image}" alt="${website.name} preview" style="max-width: 100%; height: auto; border-radius: 8px; margin-top: 16px;">` : ''}
          </div>
        `,
        content_text: `${website.name} - ${website.description}. Category: ${website.category}${website.tags ? '. Tags: ' + website.tags.join(', ') : ''}. Visit: ${website.url}`,
        summary: website.description,
        url: website.url,
        external_url: website.url,
        image: website.image,
        date_published: website.createdAt ? new Date(website.createdAt).toISOString() : new Date().toISOString(),
        date_modified: website.updatedAt ? new Date(website.updatedAt).toISOString() : undefined,
        tags: website.tags || [website.category],
        language: 'en-US'
      }))
    }

    return NextResponse.json(jsonFeed, {
      headers: {
        'Content-Type': 'application/feed+json; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Error generating JSON feed:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}