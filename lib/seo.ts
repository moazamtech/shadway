import { Metadata } from 'next'
import { Website } from './types'
import { generateWebsiteSlug } from './slug'

const baseUrl = 'https://shadway.online'
const siteName = 'Shadway'

interface SEOConfig {
  title?: string
  description?: string
  keywords?: string[]
  image?: string
  url?: string
  type?: 'website' | 'article' | 'profile'
  publishedTime?: string
  modifiedTime?: string
  author?: string
  section?: string
  tags?: string[]
  noIndex?: boolean
  canonical?: string
}

export function generateSEOMetadata(config: SEOConfig): Metadata {
  const {
    title,
    description,
    keywords = [],
    image = '/og-image.png',
    url = '/',
    type = 'website',
    publishedTime,
    modifiedTime,
    author,
    section,
    tags = [],
    noIndex = false,
    canonical
  } = config

  const fullTitle = title ? `${title} | ${siteName}` : `${siteName} - Curated Shadcn UI Website Collection`
  const fullDescription = description || 'Discover beautiful websites and components built with Shadcn UI. A curated collection of modern interfaces and design inspiration for developers and designers.'
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`
  const fullImage = image.startsWith('http') ? image : `${baseUrl}${image}`

  const allKeywords = [
    "shadcn ui",
    "shadcn ui figma",
    "shadcn/ui install​",
    "shadcn ui theme generator",
    "shadcn ui templates​",
    "react component library​",
    "shadcn card component",
    "shadcn install components",
    "music player component in react js",
    "react carousel component",
    "ui library",
    "react pure component",
    "react dynamic component",
    "design system",
    "nextjs",
    "tailwind css",
    "modern ui",
    "web design",
    "interface design",
    "shadcn figma​",
    "component library",
    ...keywords,
    ...tags
  ]

  const metadata: Metadata = {
    title: fullTitle,
    description: fullDescription,
    keywords: allKeywords,
    authors: [{ name: author || 'Moazam Butt', url: 'https://x.com/loxtmozzi' }],
    creator: author || 'Moazam Butt',
    publisher: siteName,
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: canonical || fullUrl,
    },
    openGraph: {
      type: type as any,
      locale: 'en_US',
      url: fullUrl,
      title: fullTitle,
      description: fullDescription,
      siteName,
      images: [
        {
          url: fullImage,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
      ...(author && { authors: [author] }),
      ...(section && { section }),
      ...(tags.length > 0 && { tags }),
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description: fullDescription,
      creator: '@loxtmozzi',
      images: [fullImage],
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }

  return metadata
}

export function generateWebsitePageSEO(website: Website): Metadata {
  return generateSEOMetadata({
    title: `${website.name} - ${website.category}`,
    description: `${website.description} Built with Shadcn UI. Explore this ${website.category.toLowerCase()} website and get inspired by modern interface design.`,
    keywords: [
      website.name.toLowerCase(),
      website.category.toLowerCase(),
      ...(website.tags || [])
    ],
    image: website.image,
    url: `/website/${generateWebsiteSlug(website.name)}`,
    type: 'article',
    publishedTime: website.createdAt?.toISOString(),
    modifiedTime: website.updatedAt?.toISOString(),
    section: website.category,
    tags: website.tags || [website.category]
  })
}

export function generateCategoryPageSEO(category: string, count: number): Metadata {
  const categoryTitle = category.charAt(0).toUpperCase() + category.slice(1)

  return generateSEOMetadata({
    title: `${categoryTitle} Websites`,
    description: `Discover ${count} amazing ${category.toLowerCase()} websites built with Shadcn UI. Get inspired by modern ${category.toLowerCase()} interfaces and design patterns.`,
    keywords: [
      `${category.toLowerCase()} websites`,
      `${category.toLowerCase()} ui`,
      `${category.toLowerCase()} design`,
      `shadcn ${category.toLowerCase()}`,
    ],
    url: `/category/${category.toLowerCase()}`,
    section: categoryTitle
  })
}

export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${baseUrl}${item.url}`
    }))
  }
}

export const defaultKeywords = [
  'shadcn ui',
  'shadcn/ui',
  'shadcn ui components',
  'shadcn ui examples',
  'shadcn ui templates',
  'react component library',
  'ui library',
  'design system',
  'nextjs components',
  'tailwind css',
  'modern ui',
  'web design',
  'interface design',
  'component library',
  'react ui',
  'typescript components',
  'radix ui',
  'headless ui',
  'accessible components',
  'responsive design'
]