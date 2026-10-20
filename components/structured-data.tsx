'use client'

import Script from 'next/script'
import { Website } from '@/lib/types'
import { generateWebsiteSlug } from '@/lib/slug'

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
            url: `${baseUrl}/website/${generateWebsiteSlug(website.name)}`
          }
        }

      default:
        return null
    }
  }

  const structuredData = getStructuredData()

  if (!structuredData) return null

  /**
   * The data a reader's search engine reads, and nothing else.
   *
   * It is a `next/script` rather than a script element of our own because
   * React will not run a script it renders on the client — and a script
   * rendered on the client is a console error on every navigation, which
   * buries the errors that matter. The strategy puts the document in the
   * page itself, where a crawler and a browser both find it.
   */
  return (
    <Script
      id="shadway-structured-data"
      type="application/ld+json"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData, null, 2)
      }}
    />
  )
}