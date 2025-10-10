import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connectToDatabase } from '@/lib/mongodb'
import { Website } from '@/lib/types'
import { generateWebsitePageSEO, generateBreadcrumbSchema } from '@/lib/seo'
import { generateWebsiteSlug } from '@/lib/slug'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { StructuredData } from '@/components/structured-data'
import { VisitWebsiteButton } from '@/components/visit-website-button'
import { Badge } from '@/components/ui/badge'
import { Calendar, Globe, Tag, ExternalLink } from 'lucide-react'
import Image from 'next/image'

interface PageProps {
  params: Promise<{ slug: string }>
}

async function getWebsiteBySlug(slug: string): Promise<Website | null> {
  try {
    const { db } = await connectToDatabase()

    // Find website by matching the slug generated from name
    const websites = await db
      .collection<Website>('websites')
      .find({})
      .toArray()

    const website = websites.find(w => generateWebsiteSlug(w.name) === slug)

    if (!website) return null

    // Convert MongoDB document to plain object
    return {
      _id: website._id?.toString(),
      name: website.name,
      description: website.description,
      url: website.url,
      image: website.image,
      category: website.category,
      tags: website.tags,
      featured: website.featured,
      sequence: website.sequence,
      sponsor: website.sponsor,
      createdAt: website.createdAt,
      updatedAt: website.updatedAt,
    }
  } catch (error) {
    console.error('Error fetching website:', error)
    return null
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const website = await getWebsiteBySlug(slug)

  if (!website) {
    return {
      title: 'Website Not Found | Shadway',
      description: 'The requested website could not be found.',
    }
  }

  return generateWebsitePageSEO(website)
}

export default async function WebsitePage({ params }: PageProps) {
  const { slug } = await params
  const website = await getWebsiteBySlug(slug)

  if (!website) {
    notFound()
  }

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: '/' },
    { name: 'Websites', url: '/' },
    { name: website.name, url: `/website/${slug}` }
  ])

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-x-hidden">
      <StructuredData type="creativework" data={{ website }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema, null, 2)
        }}
      />

      {/* Background geometric pattern */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="background-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#background-grid)" />
        </svg>
      </div>

      <div className="relative flex flex-col justify-start items-center w-full">
        <div className="w-full max-w-none px-4 sm:px-6 md:px-8 lg:px-12 lg:max-w-[1270px] lg:w-[1360px] relative flex flex-col justify-start items-start">
          {/* Left vertical line with geometric elements */}
          <div className="w-[1px] h-full absolute left-4 sm:left-6 md:left-8 lg:left-0 top-0 bg-border z-0">
            <div className="absolute top-32 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
            <div className="absolute top-64 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
            <div className="absolute top-96 left-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
          </div>

          {/* Right vertical line with geometric elements */}
          <div className="w-[1px] h-full absolute right-4 sm:right-6 md:right-8 lg:right-0 top-0 bg-border z-0">
            <div className="absolute top-40 right-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
            <div className="absolute top-72 right-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
            <div className="absolute top-[400px] right-[-2px] w-1 h-1 bg-primary rounded-full opacity-60"></div>
          </div>

          {/* Left decorative dashed border */}
          <div
            className="absolute dark:opacity-[0.15] opacity-[0.2] left-[-60px] top-0 w-[60px] h-full border border-dashed dark:border-[#eee] border-[#000]/70 hidden xl:block"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-45deg, transparent, transparent 2px, currentcolor 2px, currentcolor 3px, transparent 3px, transparent 6px)",
            }}
          ></div>

          {/* Right decorative dashed border */}
          <div
            className="absolute dark:opacity-[0.15] opacity-[0.2] right-[-60px] top-0 w-[60px] h-full border border-dashed dark:border-[#eee] border-[#000]/70 hidden xl:block"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-45deg, transparent, transparent 2px, currentcolor 2px, currentcolor 3px, transparent 3px, transparent 6px)",
            }}
          ></div>

          <Navbar />

          <main className="w-full relative z-10 pt-32 pb-16">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8">
          {/* Breadcrumb */}
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground mb-8">
            <a href="/" className="hover:text-foreground transition-colors">Home</a>
            <span>/</span>
            <span>{website.name}</span>
          </nav>

          {/* Hero Section */}
          <div className="grid lg:grid-cols-2 gap-8 mb-12">
            {/* Content */}
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="secondary" className="mb-2">
                    {website.category}
                  </Badge>
                  {website.featured && (
                    <Badge variant="default" className="mb-2">
                      Featured
                    </Badge>
                  )}
                  {website.sponsor?.active && (
                    <Badge variant="outline" className="mb-2">
                      Sponsored
                    </Badge>
                  )}
                </div>
                <h1 className="text-4xl font-bold tracking-tight mb-4">
                  {website.name}
                </h1>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  {website.description}
                </p>
              </div>

              {/* Tags */}
              {website.tags && website.tags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  {website.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Meta Info */}
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>
                    Added {website.createdAt ? new Date(website.createdAt).toLocaleDateString() : 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  <span>{new URL(website.url).hostname}</span>
                </div>
              </div>

              {/* CTA Button */}
              <div className="pt-4">
                <VisitWebsiteButton
                  url={website.url}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
                />
              </div>
            </div>

            {/* Image Preview */}
            <div className="relative">
              <div className="aspect-[16/10] relative rounded-lg overflow-hidden border border-border bg-muted">
                <Image
                  src={website.image}
                  alt={`${website.name} preview`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority
                />
              </div>
            </div>
          </div>

          {/* Additional Details */}
          <div className="prose prose-gray dark:prose-invert max-w-none">
            <h2>About {website.name}</h2>
            <p>
              {website.name} is a beautiful example of modern web design built with Shadcn UI components.
              This {website.category.toLowerCase()} showcases the power and flexibility of the Shadcn UI library,
              demonstrating how developers can create stunning interfaces with accessible, customizable components.
            </p>

            {website.tags && website.tags.length > 0 && (
              <>
                <h3>Technologies & Features</h3>
                <p>
                  This website demonstrates expertise in {website.tags.join(', ').toLowerCase()},
                  making it a great reference for developers looking to build similar projects.
                </p>
              </>
            )}

            <h3>Why It's Featured</h3>
            <p>
              We've included {website.name} in our curated collection because it represents
              excellent design principles, user experience, and technical implementation.
              It's a great source of inspiration for developers and designers working with
              modern web technologies.
            </p>
          </div>
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  )
}