import { NextResponse } from 'next/server'
import { listWebsites } from '@/lib/db/content'
import { Website } from '@/lib/types'

/**
 * The moment a website was added, as a number.
 *
 * A website with no date is older than every website that has one, which is
 * what a missing date has always meant: it belongs at the end of a list, not
 * at the front of it.
 */
function addedAt(website: Website): number {
  return website.createdAt ? new Date(website.createdAt).getTime() : 0
}

/**
 * The fifty newest websites, newest first.
 *
 * The accessor hands back the catalogue in the order the pages show it, and
 * that order is the one a curator chose. A feed promises something else, that
 * it moves, so the order is put back here and the fifty most recent are the
 * ones that go out.
 */
function newestWebsites(websites: Website[]): Website[] {
  return [...websites].sort((a, b) => addedAt(b) - addedAt(a)).slice(0, 50)
}

export async function GET() {
  try {
    const websites = newestWebsites(await listWebsites())

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
