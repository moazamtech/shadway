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

    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Shadway - Curated Shadcn UI Website Collection</title>
    <description>Discover beautiful websites and components built with Shadcn UI. A curated collection of modern interfaces and design inspiration.</description>
    <link>${baseUrl}</link>
    <language>en-US</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${baseUrl}/og-image.png</url>
      <title>Shadway</title>
      <link>${baseUrl}</link>
      <width>1200</width>
      <height>630</height>
    </image>
    <generator>Shadway RSS Generator</generator>
    <webMaster>contact@shadway.online (Moazam Butt)</webMaster>
    <managingEditor>contact@shadway.online (Moazam Butt)</managingEditor>
    <copyright>© ${new Date().getFullYear()} Shadway. All rights reserved.</copyright>
    <category>Technology</category>
    <category>Web Design</category>
    <category>UI Components</category>
    ${websites.map(website => `
    <item>
      <title><![CDATA[${website.name} - ${website.category}]]></title>
      <description><![CDATA[${website.description}]]></description>
      <link>${website.url}</link>
      <guid isPermaLink="false">shadway-${website._id}</guid>
      <pubDate>${website.createdAt ? new Date(website.createdAt).toUTCString() : new Date().toUTCString()}</pubDate>
      <category><![CDATA[${website.category}]]></category>
      ${website.tags?.map(tag => `<category><![CDATA[${tag}]]></category>`).join('') || ''}
      <content:encoded><![CDATA[
        <div>
          <h2>${website.name}</h2>
          <p>${website.description}</p>
          <p><strong>Category:</strong> ${website.category}</p>
          ${website.tags ? `<p><strong>Tags:</strong> ${website.tags.join(', ')}</p>` : ''}
          <p><a href="${website.url}" target="_blank" rel="noopener noreferrer">Visit Website →</a></p>
          ${website.image ? `<img src="${website.image}" alt="${website.name} preview" style="max-width: 100%; height: auto; border-radius: 8px; margin-top: 16px;">` : ''}
        </div>
      ]]></content:encoded>
      <enclosure url="${website.image}" type="image/jpeg" length="0"/>
      <source url="${baseUrl}/feed.xml">Shadway</source>
    </item>`).join('')}
  </channel>
</rss>`

    return new NextResponse(rssXml, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Error generating RSS feed:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
