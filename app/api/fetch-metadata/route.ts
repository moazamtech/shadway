import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { metadataRateLimiter, getClientIP } from '@/lib/rate-limit';
import { JSDOM } from 'jsdom';

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Only allow authenticated admin users
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // SECURITY: Rate limiting to prevent abuse
    const clientIP = getClientIP(request);
    const rateLimitResult = metadataRateLimiter.check(clientIP);

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          }
        }
      );
    }
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url) {
      return NextResponse.json(
        { error: 'URL parameter is required' },
        { status: 400 }
      );
    }

    // SECURITY: Validate URL to prevent SSRF attacks
    let normalizedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      normalizedUrl = `https://${url}`;
    }

    // SECURITY: Block internal/private IPs and localhost
    try {
      const urlObj = new URL(normalizedUrl);
      const hostname = urlObj.hostname.toLowerCase();

      // Block localhost and internal IPs
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname.startsWith('192.168.') ||
        hostname.startsWith('10.') ||
        hostname.startsWith('172.16.') ||
        hostname.startsWith('172.17.') ||
        hostname.startsWith('172.18.') ||
        hostname.startsWith('172.19.') ||
        hostname.startsWith('172.20.') ||
        hostname.startsWith('172.21.') ||
        hostname.startsWith('172.22.') ||
        hostname.startsWith('172.23.') ||
        hostname.startsWith('172.24.') ||
        hostname.startsWith('172.25.') ||
        hostname.startsWith('172.26.') ||
        hostname.startsWith('172.27.') ||
        hostname.startsWith('172.28.') ||
        hostname.startsWith('172.29.') ||
        hostname.startsWith('172.30.') ||
        hostname.startsWith('172.31.') ||
        hostname.includes('169.254.')
      ) {
        return NextResponse.json(
          { error: 'Invalid URL: Cannot access internal resources' },
          { status: 400 }
        );
      }

      // Only allow HTTP and HTTPS
      if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
        return NextResponse.json(
          { error: 'Invalid URL: Only HTTP and HTTPS protocols are allowed' },
          { status: 400 }
        );
      }
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
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