import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://shadway.online'

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/api/',
          '/private/',
          '/_next/',
          '/.*\\.json$',
          '/.*\\.xml$',
        ],
      },
      {
        userAgent: 'GPTBot',
        disallow: '/admin/',
      },
      {
        userAgent: 'ChatGPT-User',
        disallow: '/admin/',
      },
      {
        userAgent: 'CCBot',
        disallow: '/admin/',
      },
      {
        userAgent: 'anthropic-ai',
        disallow: '/admin/',
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  }
}