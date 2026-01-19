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

  // Ensure image URL is absolute and valid for OG tags
  let fullImage = image
  if (!image.startsWith('http')) {
    fullImage = image.startsWith('/') ? `${baseUrl}${image}` : `${baseUrl}/${image}`
  }

  // Validate image URL and fallback to default if invalid
  if (!fullImage.match(/\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i)) {
    fullImage = `${baseUrl}/og-image.png`
  }

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
  // Generate more specific and unique keywords based on website data
  const uniqueKeywords = generateUniqueWebsiteKeywords(website)

  // Generate a more detailed and unique description
  const uniqueDescription = generateUniqueWebsiteDescription(website)

  return generateSEOMetadata({
    title: `${website.name} - ${website.category} | Built with Shadcn UI`,
    description: uniqueDescription,
    keywords: uniqueKeywords,
    image: website.image,
    url: `/website/${generateWebsiteSlug(website.name)}`,
    type: 'article',
    publishedTime: website.createdAt?.toISOString(),
    modifiedTime: website.updatedAt?.toISOString(),
    section: website.category,
    tags: website.tags || [website.category]
  })
}

function generateUniqueWebsiteKeywords(website: Website): string[] {
  const baseKeywords = [
    website.name.toLowerCase(),
    `${website.name.toLowerCase()} website`,
    `${website.name.toLowerCase()} ${website.category.toLowerCase()}`,
    website.category.toLowerCase(),
    `${website.category.toLowerCase()} website`,
    `${website.category.toLowerCase()} ui`,
    `${website.category.toLowerCase()} design`,
    'shadcn ui',
    'shadcn',
    'ui design',
    'web design',
    'modern ui',
    'interface design',
    'react website',
    'nextjs website',
    'tailwind css website',
    ...(website.tags || []).map(tag => tag.toLowerCase()),
    ...(website.tags || []).map(tag => `${tag.toLowerCase()} ${website.category.toLowerCase()}`),
    `shadcn ${website.category.toLowerCase()}`,
    `${website.category.toLowerCase()} template`,
    `${website.category.toLowerCase()} example`,
    `${website.category.toLowerCase()} inspiration`,
    'responsive design',
    'modern design',
    'clean design',
    'beautiful ui',
    'component showcase'
  ]

  // Remove duplicates and limit to most relevant keywords
  const uniqueKeywords = Array.from(new Set(baseKeywords))
  return uniqueKeywords
}

function generateUniqueWebsiteDescription(website: Website): string {
  const categoryName = website.category.charAt(0).toUpperCase() + website.category.slice(1)
  const hasTags = website.tags && website.tags.length > 0
  const techStack = hasTags ? website.tags?.join(', ') : 'modern web technologies'

  // Use hash of website name to determine which description to use
  // This ensures consistency for the same website
  const nameHash = website.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const descriptionIndex = nameHash % 5

  // Generate more detailed descriptions based on content
  const descriptions = [
    `${website.description} This ${categoryName.toLowerCase()} website is built with Shadcn UI, React, and ${techStack}. Explore this modern ${categoryName.toLowerCase()} interface with responsive design, accessibility features, and beautiful components.`,

    `Discover ${website.name}, an impressive ${categoryName.toLowerCase()} website showcasing beautiful Shadcn UI components and ${techStack} integration. This ${categoryName.toLowerCase()} demonstrates best practices in responsive design, accessibility standards, and modern web development.`,

    `${website.description} This carefully curated ${categoryName.toLowerCase()} example features Shadcn UI components, ${techStack} stack, and production-ready code patterns. Perfect for developers seeking inspiration in ${categoryName.toLowerCase()} interface design and implementation.`,

    `${website.name} is a stunning ${categoryName.toLowerCase()} built with Shadcn UI and ${techStack}. Explore how this website implements modern design patterns, accessibility best practices, and responsive layouts for optimal ${categoryName.toLowerCase()} functionality.`,

    `Explore ${website.name}, a featured ${categoryName.toLowerCase()} built with Shadcn UI. This ${categoryName.toLowerCase()} website showcases best practices in component design, featuring ${techStack}, modern UI/UX principles, and clean, maintainable code architecture.`
  ]

  // Return the selected description (up to 160 chars for search engines)
  const selected = descriptions[descriptionIndex]
  return selected.length > 160 ? selected.substring(0, 160) + '...' : selected
}

function getCategoryDescription(category: string): string {
  const categoryDescriptions: { [key: string]: string } = {
    'dashboard': 'admin dashboard',
    'saas': 'SaaS application',
    'ecommerce': 'e-commerce platform',
    'blog': 'blogging platform',
    'portfolio': 'portfolio website',
    'landing page': 'landing page',
    'app': 'web application',
    'marketplace': 'marketplace platform',
    'community': 'community platform',
    'analytics': 'analytics dashboard',
    'social': 'social network'
  }

  return categoryDescriptions[category.toLowerCase()] || category
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