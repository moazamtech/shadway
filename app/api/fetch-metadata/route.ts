import { NextRequest, NextResponse } from 'next/server';
import { JSDOM } from 'jsdom';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    let normalizedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      normalizedUrl = `https://${url}`;
    }

    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${normalizedUrl}: ${response.statusText}`);
    }

    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    const getMetaContent = (name: string, property?: string): string => {
      const metaTag = document.querySelector(
        `meta[${property ? 'property' : 'name'}="${name}"]`
      ) as HTMLMetaElement;
      return metaTag?.content || '';
    };

    const title =
      getMetaContent('og:title', true) ||
      document.querySelector('title')?.textContent ||
      getMetaContent('twitter:title', true) ||
      'Untitled';

    const description =
      getMetaContent('og:description', true) ||
      getMetaContent('description') ||
      getMetaContent('twitter:description', true) ||
      'No description available';

    let ogImage =
      getMetaContent('og:image', true) ||
      getMetaContent('twitter:image', true) ||
      '';

    if (ogImage && ogImage.startsWith('/')) {
      const baseUrl = new URL(normalizedUrl);
      ogImage = `${baseUrl.protocol}//${baseUrl.host}${ogImage}`;
    }

    const favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement ||
                   document.querySelector('link[rel="shortcut icon"]') as HTMLLinkElement;
    let faviconUrl = favicon?.href || '';

    if (faviconUrl && faviconUrl.startsWith('/')) {
      const baseUrl = new URL(normalizedUrl);
      faviconUrl = `${baseUrl.protocol}//${baseUrl.host}${faviconUrl}`;
    }

    return NextResponse.json({
      title: title.trim(),
      description: description.trim(),
      ogImage: ogImage || '/placeholder-image.jpg',
      favicon: faviconUrl,
      url: normalizedUrl,
    });

  } catch (error) {
    console.error('Error fetching metadata:', error);

    return NextResponse.json({
      title: 'Error fetching title',
      description: 'Could not fetch site metadata',
      ogImage: '/placeholder-image.jpg',
      favicon: '',
    });
  }
}