import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { metadataRateLimiter, getClientIP } from '@/lib/rate-limit';
import { JSDOM } from 'jsdom';
import { captureScreenshotAndUpload } from '@/lib/uploadOrScreenshot';

// Utility to extract meta content safely
const getMetaContent = (document: Document, name: string, property?: boolean): string => {
  const metaTag = document.querySelector(
    `meta[${property ? 'property' : 'name'}="${name}"]`
  ) as HTMLMetaElement;
  return metaTag?.content || '';
};

export async function GET(request: NextRequest) {
  try {
    // AUTH — restrict access to admins
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RATE LIMIT
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
          },
        }
      );
    }

    //URL VALIDATION
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');
    if (!url)
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });

    let normalizedUrl = url.startsWith('http') ? url : `https://${url}`;
    const parsedUrl = new URL(normalizedUrl);
    const hostname = parsedUrl.hostname.toLowerCase();

    // Prevent internal or unsafe URLs
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('10.') ||
      (hostname.startsWith('172.') &&
        parseInt(hostname.split('.')[1]) >= 16 &&
        parseInt(hostname.split('.')[1]) <= 31) ||
      hostname.includes('169.254.')
    ) {
      return NextResponse.json(
        { error: 'Invalid URL: Cannot access internal resources' },
        { status: 400 }
      );
    }

    // Allow only HTTP(S)
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return NextResponse.json(
        { error: 'Invalid URL: Only HTTP and HTTPS protocols are allowed' },
        { status: 400 }
      );
    }

    // FETCH HTML CONTENT
    let html = '';
    try {
      const response = await fetch(normalizedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MetadataBot/1.0)' },
      });
      if (!response.ok)
        throw new Error(`Fetch blocked: ${response.status} ${response.statusText}`);
      html = await response.text();
    } catch (err) {
      console.warn(`Fetch failed for ${normalizedUrl}. Using Puppeteer fallback...`);
      html = ''; // we won't fallback to puppeteer here (handled in screenshot logic)
    }

    // PARSE METADATA
    const dom = new JSDOM(html || '<html></html>');
    const { document } = dom.window;

    const title =
      getMetaContent(document, 'og:title', true) ||
      document.querySelector('title')?.textContent ||
      getMetaContent(document, 'twitter:title', true) ||
      'Untitled';

    const description =
      getMetaContent(document, 'og:description', true) ||
      getMetaContent(document, 'description') ||
      getMetaContent(document, 'twitter:description', true) ||
      'No description available';

    let ogImage =
      getMetaContent(document, 'og:image', true) ||
      getMetaContent(document, 'twitter:image', true) ||
      '';

    // Fix relative URLs
    if (ogImage && ogImage.startsWith('/')) {
      ogImage = `${parsedUrl.protocol}//${parsedUrl.host}${ogImage}`;
    }

    // SCREENSHOT FALLBACK (delegated to uploadOrScreenshot.ts)
    if (!ogImage) {
      ogImage = await captureScreenshotAndUpload(normalizedUrl);
    }

    // FAVICON DETECTION
    const faviconEl =
      (document.querySelector('link[rel="icon"]') as HTMLLinkElement) ||
      (document.querySelector('link[rel="shortcut icon"]') as HTMLLinkElement);

    let faviconUrl = faviconEl?.href || '';
    if (faviconUrl && faviconUrl.startsWith('/')) {
      faviconUrl = `${parsedUrl.protocol}//${parsedUrl.host}${faviconUrl}`;
    }

    // RESPONSE
    return NextResponse.json({
      title: title.trim(),
      description: description.trim(),
      ogImage: ogImage || '/placeholder-image.jpg',
      favicon: faviconUrl,
      url: normalizedUrl,
    });
  } catch (error: any) {
    console.error('Error fetching metadata:', error);
    return NextResponse.json(
      {
        title: 'Error fetching metadata',
        description: 'Could not fetch site metadata',
        ogImage: '/placeholder-image.jpg',
        favicon: '',
      },
      { status: 500 }
    );
  }
}