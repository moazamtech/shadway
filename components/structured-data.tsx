'use client'

import { Website } from '@/lib/types'

interface StructuredDataProps {
  type: 'website' | 'organization' | 'collection' | 'creativework'
  data?: {
    website?: Website
    websites?: Website[]
  }
}

export function StructuredData({ type, data }: StructuredDataProps) {
  const getStructuredData = () => {
    const baseUrl = 'https://shadway.online'

    switch (type) {
      case 'organization':
        return {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Shadway',
          description: 'Curated Shadcn UI Website Collection - Discover beautiful websites and components built with Shadcn UI.',
          url: baseUrl,
          logo: `${baseUrl}/logo.png`,
          image: `${baseUrl}/og-image.png`,
          founder: {
            '@type': 'Person',
            name: 'Moazam Butt',
            url: 'https://x.com/loxtmozzi'
          },
          sameAs: [
            'https://x.com/loxtmozzi',
            'https://github.com/moazamtech/shadway'
          ],
          contactPoint: {
            '@type': 'ContactPoint',
            contactType: 'customer support',
            url: `${baseUrl}/submit`
          }
        }

      case 'website':
        return {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Shadway',
          description: 'Discover beautiful websites and components built with Shadcn UI. A curated collection of modern interfaces and design inspiration.',
          url: baseUrl,
          publisher: {
            '@type': 'Organization',
            name: 'Shadway',
            logo: {
              '@type': 'ImageObject',
              url: `${baseUrl}/logo.png`
            }
          },
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: `${baseUrl}/?search={search_term_string}`
            },
            'query-input': 'required name=search_term_string'
          }
        }

      case 'collection':
        const websites = data?.websites || []
        return {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Shadcn UI Website Collection',
          description: 'A curated collection of beautiful websites built with Shadcn UI components.',
          url: baseUrl,
          mainEntity: {
            '@type': 'ItemList',
            numberOfItems: websites.length,
            itemListElement: websites.map((website, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              item: {
                '@type': 'CreativeWork',
                name: website.name,
                description: website.description,
                url: website.url,
                image: website.image,
                category: website.category,
                keywords: website.tags?.join(', ') || website.category
              }
            }))
          }
        }

      case 'creativework':
        const website = data?.website
        if (!website) return null

        return {
          '@context': 'https://schema.org',
          '@type': 'CreativeWork',
          name: website.name,
          description: website.description,
          url: website.url,
          image: {
            '@type': 'ImageObject',
            url: website.image,
            width: 1200,
            height: 630
          },
          category: website.category,
          keywords: website.tags?.join(', ') || website.category,
          dateCreated: website.createdAt?.toISOString(),
          dateModified: website.updatedAt?.toISOString(),
          author: {
            '@type': 'Organization',
            name: 'Shadway'
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            url: `${baseUrl}/website/${website._id}`
          }
        }

      default:
        return null
    }
  }

  const structuredData = getStructuredData()

  if (!structuredData) return null

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData, null, 2)
      }}
    />
  )
}